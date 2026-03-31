const vscode = require('vscode');

let savedState = null;
let isMaximized = false;

function activate(context) {
    // 注册命令
    let disposable = vscode.commands.registerCommand('maxeditor.toggleMaximize', async () => {
        await toggleMaximize();
    });
    context.subscriptions.push(disposable);
}

async function toggleMaximize() {
    if (!isMaximized) {
        await maximizeEditor();
    } else {
        await restoreEditor();
    }
}

async function maximizeEditor() {
    try {
        savedState = {
            sidebarVisible: true,
            panelVisible: true,
            auxiliaryBarVisible: true
        };

        await vscode.commands.executeCommand('workbench.action.closeSidebar');
        await vscode.commands.executeCommand('workbench.action.closePanel');
        await vscode.commands.executeCommand('workbench.action.closeAuxiliaryBar');

        isMaximized = true;
        vscode.window.showInformationMessage('编辑器已最大化');
    } catch (error) {
        vscode.window.showErrorMessage(`最大化失败: ${error.message}`);
    }
}

async function restoreEditor() {
    try {
        if (!savedState) {
            savedState = {
                sidebarVisible: true,
                panelVisible: true,
                auxiliaryBarVisible: true
            };
        }

        if (savedState.sidebarVisible) {
            await vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
        }

        if (savedState.panelVisible) {
            await vscode.commands.executeCommand('workbench.action.togglePanel');
        }

        if (savedState.auxiliaryBarVisible) {
            await vscode.commands.executeCommand('workbench.action.toggleAuxiliaryBar');
        }

        isMaximized = false;
        savedState = null;
        vscode.window.showInformationMessage('布局已恢复');
    } catch (error) {
        vscode.window.showErrorMessage(`恢复失败: ${error.message}`);
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
