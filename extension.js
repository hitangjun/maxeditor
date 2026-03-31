const vscode = require('vscode');

let isMaximized = false;
let statusBarItem;

/**
 * 插件激活入口
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    // 从持久化存储恢复状态
    isMaximized = context.workspaceState.get('isMaximized', false);

    // 创建状态栏指示器
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

/**
 * 切换最大化/恢复
 * @param {vscode.ExtensionContext} context
 */
async function toggleMaximize(context) {
    try {
        if (!isMaximized) {
            await maximizeEditor();
        } else {
            await restoreEditor();
        }

        updateStatusBar();
        await context.workspaceState.update('isMaximized', isMaximized);
    } catch (error) {
        vscode.window.showErrorMessage(`Max Editor: ${error.message}`);
    }
}

/**
 * 最大化编辑器：关闭侧边栏、面板、辅助栏
 * close 命令是幂等的，已关闭的不会出错
 */
async function maximizeEditor() {
    await vscode.commands.executeCommand('workbench.action.closeSidebar');
    await vscode.commands.executeCommand('workbench.action.closePanel');
    await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');
    isMaximized = true;
}

/**
 * 恢复编辑器布局：仅恢复侧边栏（最常用的面板）
 * 不恢复底部面板和辅助栏，因为无法准确判断最大化前它们是否可见
 * 避免使用 toggle 命令防止状态反转
 */
async function restoreEditor() {
    // 使用 focusSideBar 确保侧边栏打开（不是 toggle，不会反向操作）
    await vscode.commands.executeCommand('workbench.action.focusSideBar');
    // 恢复后将焦点移回编辑器
    await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
    isMaximized = false;
}

/**
 * 更新状态栏显示
 */
function updateStatusBar() {
    if (isMaximized) {
        statusBarItem.text = '$(screen-normal) 恢复布局';
        statusBarItem.tooltip = 'Max Editor: 点击恢复编辑器布局 (Ctrl+Shift+M)';
    } else {
        statusBarItem.text = '$(screen-full) 最大化';
        statusBarItem.tooltip = 'Max Editor: 点击最大化编辑器 (Ctrl+Shift+M)';
    }
}

function deactivate() {}

module.exports = { activate, deactivate };
