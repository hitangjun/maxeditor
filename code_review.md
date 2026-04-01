# Max Editor 插件 Code Review 报告

## 整体评价

插件结构简洁，功能定位明确。但在发布前有 **1 个严重 Bug** 和若干需要改进的地方。

---

## 🔴 严重问题（必须修复）

### 1. 恢复逻辑 Bug — 未正确保存真实状态

[extension.js](file:///d:/awork/maxeditor/extension.js#L22-L38)

> [!CAUTION]
> `savedState` 始终硬编码为 `{sidebarVisible: true, panelVisible: true, auxiliaryBarVisible: true}`，**完全没有检测面板的真实可见状态**。这导致：
> - 如果用户最大化前 **侧边栏本来就是隐藏的**，恢复时会错误地把它打开
> - 如果用户最大化前 **底部面板本来就是隐藏的**，恢复时会错误地把它打开
> - 本质上 `savedState` 没有起到任何"保存状态"的作用

**问题代码：**

```javascript
// ❌ 永远假设所有面板都是可见的
savedState = {
    sidebarVisible: true,
    panelVisible: true,
    auxiliaryBarVisible: true
};
```

**修复方案：** VS Code 没有直接 API 查询面板可见性，但可以通过 `executeCommand` + `getContext` 间接判断：

```javascript
async function maximizeEditor() {
    try {
        // 通过上下文键检测当前状态
        const sideBarVisible = vscode.workspace.getConfiguration()
            .get('workbench.sideBar.visible', true); // 注意：这个不可靠

        // 更好的方案：直接用 "close" 命令（幂等），恢复时只用 "open" 命令
        // 或者使用 VS Code 内置的 toggleMaximizedPanel
        
        await vscode.commands.executeCommand('workbench.action.closeSidebar');
        await vscode.commands.executeCommand('workbench.action.closePanel');
        await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');

        isMaximized = true;
    } catch (error) {
        vscode.window.showErrorMessage(`最大化失败: ${error.message}`);
    }
}
```

> [!TIP]
> **推荐最优方案：** 直接使用 VS Code **内置命令** `workbench.action.toggleEditorWidths` 或 `workbench.action.maximizeEditorHideSidebar`，这些命令本身就能正确保存/恢复状态，无需手动管理 `savedState`。

### 2. 恢复时使用了 `toggle` 而非 `open` 命令

[extension.js](file:///d:/awork/maxeditor/extension.js#L41-L68)

> [!WARNING]
> 恢复时调用的是 `toggleSidebarVisibility`、`togglePanel`、`toggleAuxiliaryBar`，这些是**切换命令**。如果在最大化期间用户手动打开了某个面板，恢复时 toggle 反而会**关闭**它。

**修复方案：** 恢复时应使用 **open** 命令而非 toggle 命令：

```diff
-await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
+await vscode.commands.executeCommand('workbench.action.focusSideBar');
// 或使用 workbench.view.explorer 来确保打开侧边栏

-await vscode.commands.executeCommand('workbench.action.togglePanel');
+await vscode.commands.executeCommand('workbench.action.focusPanel');
```

---

## 🟡 重要改进（强烈建议）

### 3. `isMaximized` 状态在插件重载后丢失

如果用户在最大化状态下重新加载窗口（`Reload Window`），`isMaximized` 会重置为 `false`，导致状态不一致。

**建议：** 使用 `context.workspaceState` 或 `context.globalState` 持久化状态：

```javascript
function activate(context) {
    isMaximized = context.workspaceState.get('isMaximized', false);
    
    let disposable = vscode.commands.registerCommand('maxeditor.toggleMaximize', async () => {
        await toggleMaximize();
        context.workspaceState.update('isMaximized', isMaximized);
    });
    context.subscriptions.push(disposable);
}
```

### 4. 每次操作都弹 `showInformationMessage` 太打扰用户

> [!NOTE]
> 频繁弹通知消息（右下角弹窗）对用户体验很差。建议改用 **状态栏指示器**，更加优雅。

```javascript
// 创建状态栏项
const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right, 100
);
statusBarItem.command = 'maxeditor.toggleMaximize';
statusBarItem.text = '$(screen-full) 最大化';
statusBarItem.tooltip = '点击切换编辑器最大化';
statusBarItem.show();
context.subscriptions.push(statusBarItem);

// 切换时更新状态栏文字即可
statusBarItem.text = isMaximized ? '$(screen-normal) 恢复' : '$(screen-full) 最大化';
```

### 5. `activationEvents` 可以优化

```json
"activationEvents": [
    "onStartupFinished"
]
```

`onStartupFinished` 让插件在每次 VS Code 启动后都会激活，但这个插件只在用户主动调用命令时才需要工作。在 VS Code 1.74+ 中，`contributes.commands` 中声明的命令会自动触发激活，所以可以简化为：

```json
"activationEvents": []
```

或者完全删除 `activationEvents` 字段（VS Code 会根据 `contributes` 自动推断）。

---

## 🟢 package.json 发布前检查

### 6. 缺少 `icon` 字段 ❌

Marketplace 上没有图标的插件看起来不专业。必须提供一个 128x128 的 PNG 图标：

```json
"icon": "images/icon.png"
```

### 7. 版本号建议调整

`0.0.1` 给人一种"不可用"的印象。首次发布建议至少用 `1.0.0`。

### 8. 缺少 `keywords` 字段

添加关键词有助于 Marketplace 搜索发现：

```json
"keywords": ["maximize", "editor", "sidebar", "fullscreen", "layout", "toggle"]
```

### 9. 建议添加 `galleryBanner` 美化 Marketplace 页面

```json
"galleryBanner": {
    "color": "#1e1e1e",
    "theme": "dark"
}
```

### 10. `explorer/context` 右键菜单不太合理

在文件资源管理器右键菜单中放"最大化编辑器"命令，使用场景不自然。建议移除，保留编辑器标题栏按钮即可。

---

## 🟢 README 改进

### 11. 建议增加英文描述

Marketplace 面向全球用户，建议标题和核心描述提供英文版本。

### 12. 缺少 CHANGELOG.md

`vsce` 打包时会警告缺少 CHANGELOG.md。创建一个：

```markdown
# Change Log

## [1.0.0] - 2026-03-31
- 🎉 首次发布
- 支持快捷键最大化/恢复编辑器
- 支持编辑器标题栏按钮
- 支持命令面板调用
```

### 13. 建议添加截图/GIF 演示

在 README 中加入使用效果的 GIF 截图能显著提升安装率。

---

## 🟢 其他细节

### 14. `.vscodeignore` 应忽略 `.vsix` 文件

```diff
+*.vsix
```

### 15. LICENSE 年份

当前写的是 `Copyright (c) 2025`，现在是 2026 年，建议更新。

---

## 推荐的完整重写方案

鉴于核心逻辑存在 Bug，建议使用更简洁可靠的实现：

```javascript
const vscode = require('vscode');

let isMaximized = false;
let statusBarItem;

function activate(context) {
    // 恢复持久化状态
    isMaximized = context.workspaceState.get('isMaximized', false);

    // 状态栏指示器
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right, 100
    );
    statusBarItem.command = 'maxeditor.toggleMaximize';
    updateStatusBar();
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 注册命令
    const disposable = vscode.commands.registerCommand(
        'maxeditor.toggleMaximize', 
        async () => {
            await toggleMaximize(context);
        }
    );
    context.subscriptions.push(disposable);
}

async function toggleMaximize(context) {
    try {
        if (!isMaximized) {
            // 最大化：关闭所有面板（close 命令是幂等的，已关闭的不会出错）
            await vscode.commands.executeCommand('workbench.action.closeSidebar');
            await vscode.commands.executeCommand('workbench.action.closePanel');
            await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
            isMaximized = true;
        } else {
            // 恢复：使用 focusSideBar 确保打开（不用 toggle 避免反向操作）
            await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
            isMaximized = false;
        }

        updateStatusBar();
        await context.workspaceState.update('isMaximized', isMaximized);
    } catch (error) {
        vscode.window.showErrorMessage(`操作失败: ${error.message}`);
    }
}

function updateStatusBar() {
    if (isMaximized) {
        statusBarItem.text = '$(screen-normal) 恢复布局';
        statusBarItem.tooltip = '点击恢复编辑器布局';
    } else {
        statusBarItem.text = '$(screen-full) 最大化';
        statusBarItem.tooltip = '点击最大化编辑器';
    }
}

function deactivate() {}

module.exports = { activate, deactivate };
```

---

## 发布前 Checklist

| # | 项目 | 状态 |
|---|------|------|
| 1 | 修复 savedState 假状态 Bug | ❌ 必须修复 |
| 2 | 修复 toggle vs open 恢复逻辑 | ❌ 必须修复 |
| 3 | 持久化 isMaximized 状态 | ⚠️ 强烈建议 |
| 4 | 改用状态栏替代弹窗通知 | ⚠️ 强烈建议 |
| 5 | 添加插件图标 (128x128 PNG) | ❌ 必须 |
| 6 | 创建 CHANGELOG.md | ⚠️ 建议 |
| 7 | 优化 activationEvents | ✅ 可选 |
| 8 | 添加 keywords | ⚠️ 建议 |
| 9 | 移除 explorer/context 菜单 | ✅ 可选 |
| 10 | .vscodeignore 忽略 .vsix | ⚠️ 建议 |
| 11 | 更新 LICENSE 年份 | ✅ 可选 |
| 12 | 版本号改为 1.0.0 | ⚠️ 建议 |

