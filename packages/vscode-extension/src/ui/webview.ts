import * as vscode from "vscode";
import type { Card } from "@lineu/lib";

type WebviewMode = "deal" | "collection";

interface OnboardingState {
  mcpConfigured: boolean;
  commandsConfigured: boolean;
}

export class CardsViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private cards: Card[] = [];
  private mode: WebviewMode = "deal";
  private onFavorite?: (card: Card) => Promise<void>;
  private onOnboardingAction?: (action: string, data?: unknown) => Promise<void>;
  private onboardingState: OnboardingState = {
    mcpConfigured: false,
    commandsConfigured: false,
  };
  private showOnboarding = false;
  private currentProject = "";
  private projects: string[] = [];

  constructor(private readonly extensionUri: vscode.Uri) {}

  setProjectInfo(currentProject: string, projects: string[]) {
    this.currentProject = currentProject;
    this.projects = projects;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "webview-ui", "dist"),
      ],
    };

    webviewView.webview.onDidReceiveMessage(
      async (message: {
        type?: string;
        id?: string;
        tags?: string[];
        action?: string;
        data?: unknown;
      }) => {
        switch (message?.type) {
          case "favorite":
            if (this.onFavorite && message.id) {
              const card = this.cards.find((item) => item.id === message.id);
              if (card) {
                await this.onFavorite(card);
              }
            }
            break;
          case "ready":
            // Webview 准备好了，发送初始数据
            this.sendUpdate();
            break;
          case "delete":
            // TODO: 实现删除逻辑
            break;
          case "updateTags":
            // TODO: 实现更新标签逻辑
            break;
          case "onboardingAction":
            if (this.onOnboardingAction && message.action) {
              await this.onOnboardingAction(message.action, message.data);
            }
            break;
        }
      }
    );

    this.refresh();
  }

  update(
    cards: Card[],
    mode: WebviewMode,
    onFavorite?: (card: Card) => Promise<void>
  ) {
    this.cards = cards;
    this.mode = mode;
    this.onFavorite = onFavorite;
    this.refresh();
    this.sendUpdate();
  }

  setOnboardingHandler(handler: (action: string, data?: unknown) => Promise<void>) {
    this.onOnboardingAction = handler;
  }

  updateOnboardingState(state: OnboardingState) {
    this.onboardingState = state;
    this.view?.webview.postMessage({
      type: "onboardingState",
      state: this.onboardingState,
    });
  }

  showOnboardingView() {
    this.showOnboarding = true;
    this.view?.webview.postMessage({
      type: "showOnboarding",
    });
  }

  hideOnboardingView() {
    this.showOnboarding = false;
    this.view?.webview.postMessage({
      type: "hideOnboarding",
    });
  }

  reveal() {
    this.view?.show?.(true);
  }

  private sendUpdate() {
    if (!this.view) return;
    this.view.webview.postMessage({
      type: "update",
      data: {
        cards: this.cards,
        mode: this.mode,
        onboardingState: this.onboardingState,
        showOnboarding: this.showOnboarding,
        currentProject: this.currentProject,
        projects: this.projects,
      },
    });
    // 重置标记
    this.showOnboarding = false;
  }

  private refresh() {
    if (!this.view) {
      return;
    }
    this.view.webview.html = this.buildHtml(this.view.webview);
  }

  private buildHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview-ui", "dist", "main.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "webview-ui", "dist", "style.css")
    );

    const nonce = createNonce();
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    // 注入初始数据到 window 对象
    const initialData = JSON.stringify({
      cards: this.cards,
      mode: this.mode,
      onboardingState: this.onboardingState,
      showOnboarding: this.showOnboarding,
      currentProject: this.currentProject,
      projects: this.projects,
    });

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link href="${styleUri}" rel="stylesheet" />
    <title>Lineu</title>
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}">
      window.__INITIAL_DATA__ = ${initialData};
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function createNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
