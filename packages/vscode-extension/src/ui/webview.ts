import * as vscode from "vscode";
import type { Card } from "@lineu/lib";

type WebviewMode = "deal" | "collection";

export class CardsViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private cards: Card[] = [];
  private mode: WebviewMode = "deal";
  private onFavorite?: (card: Card) => Promise<void>;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.onDidReceiveMessage(
      async (message: { type?: string; id?: string }) => {
        if (message?.type === "favorite" && this.onFavorite) {
          const card = this.cards.find((item) => item.id === message.id);
          if (card) {
            await this.onFavorite(card);
          }
        }
      }
    );

    this.refresh();
  }

  update(cards: Card[], mode: WebviewMode, onFavorite?: (card: Card) => Promise<void>) {
    this.cards = cards;
    this.mode = mode;
    this.onFavorite = onFavorite;
    this.refresh();
  }

  reveal() {
    this.view?.show?.(true);
  }

  private refresh() {
    if (!this.view) {
      return;
    }
    this.view.webview.html = buildHtml(this.view.webview, {
      cards: this.cards,
      mode: this.mode,
    });
  }
}

function buildHtml(
  webview: vscode.Webview,
  options: {
    cards: Card[];
    mode: WebviewMode;
  }
): string {
  const nonce = createNonce();
  const data = JSON.stringify({
    cards: options.cards,
    mode: options.mode,
  });
  const csp = `default-src 'none'; style-src ${
    webview.cspSource
  } 'unsafe-inline'; script-src 'nonce-${nonce}';`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Knowledge Cards</title>
    <style>
      :root {
        color-scheme: light dark;
      }
      body {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        padding: 16px;
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .title {
        font-size: 18px;
        font-weight: 600;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }
      .card {
        border-radius: 10px;
        padding: 12px;
        background: rgba(120, 120, 120, 0.1);
        border: 1px solid rgba(120, 120, 120, 0.3);
      }
      .card.type-bug {
        border-left: 4px solid #f85149;
      }
      .card.type-best_practice {
        border-left: 4px solid #3fb950;
      }
      .card.type-knowledge {
        border-left: 4px solid #58a6ff;
      }
      .type-badge {
        display: inline-block;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        margin-bottom: 8px;
        text-transform: uppercase;
        font-weight: 600;
      }
      .type-badge.type-bug {
        background: rgba(248, 81, 73, 0.2);
        color: #f85149;
      }
      .type-badge.type-best_practice {
        background: rgba(63, 185, 80, 0.2);
        color: #3fb950;
      }
      .type-badge.type-knowledge {
        background: rgba(88, 166, 255, 0.2);
        color: #58a6ff;
      }
      .card h3 {
        margin: 0 0 8px;
        font-size: 15px;
      }
      .card p {
        margin: 0 0 10px;
        font-size: 12px;
        line-height: 1.4;
      }
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 8px;
      }
      .tag {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 6px;
        background: rgba(120, 120, 120, 0.2);
      }
      .meta {
        font-size: 11px;
        opacity: 0.7;
        margin-bottom: 8px;
      }
      .refs {
        font-size: 11px;
        opacity: 0.7;
        margin-bottom: 8px;
        word-break: break-all;
      }
      .empty {
        font-size: 13px;
        opacity: 0.8;
        padding: 12px;
        border-radius: 10px;
        border: 1px dashed rgba(120, 120, 120, 0.4);
      }
      .actions {
        display: flex;
        gap: 8px;
      }
      button {
        border: none;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
      }
      button.primary {
        background: #1f6feb;
        color: #fff;
      }
      button.secondary {
        background: transparent;
        color: inherit;
        border: 1px solid rgba(120, 120, 120, 0.4);
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="title">
        ${options.mode === "deal" ? "Card Deal" : "Card Collection"}
      </div>
      <div class="count">${options.cards.length} card(s)</div>
    </div>
    <div id="cards" class="cards"></div>
    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const data = ${data};
      const container = document.getElementById("cards");

      function renderCard(card) {
        const wrapper = document.createElement("div");
        wrapper.className = "card" + (card.type ? " type-" + card.type : "");
        wrapper.dataset.cardId = card.id;

        if (card.type) {
          const typeBadge = document.createElement("span");
          typeBadge.className = "type-badge type-" + card.type;
          typeBadge.textContent = card.type.replace("_", " ");
          wrapper.appendChild(typeBadge);
        }

        const title = document.createElement("h3");
        title.textContent = card.title;
        wrapper.appendChild(title);

        const summary = document.createElement("p");
        summary.textContent = card.summary;
        wrapper.appendChild(summary);

        const tags = document.createElement("div");
        tags.className = "tags";
        (card.tags || []).forEach((tag) => {
          const chip = document.createElement("span");
          chip.className = "tag";
          chip.textContent = tag;
          tags.appendChild(chip);
        });
        wrapper.appendChild(tags);

        const meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = "Source: " + card.source;
        wrapper.appendChild(meta);

        if (card.codeRefs && card.codeRefs.length > 0) {
          const refs = document.createElement("div");
          refs.className = "refs";
          refs.textContent =
            "Files: " + card.codeRefs.map((ref) => ref.path).join(", ");
          wrapper.appendChild(refs);
        }

        if (data.mode === "deal") {
          const actions = document.createElement("div");
          actions.className = "actions";

          const favorite = document.createElement("button");
          favorite.className = "primary";
          favorite.textContent = "Favorite";
          favorite.addEventListener("click", () => {
            vscode.postMessage({ type: "favorite", id: card.id });
          });

          const discard = document.createElement("button");
          discard.className = "secondary";
          discard.textContent = "Discard";
          discard.addEventListener("click", () => {
            wrapper.remove();
          });

          actions.appendChild(favorite);
          actions.appendChild(discard);
          wrapper.appendChild(actions);
        }

        return wrapper;
      }

      if (data.cards.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent =
          data.mode === "deal"
            ? "No cards yet. Run the capture command to draw cards."
            : "No saved cards yet.";
        container.appendChild(empty);
      } else {
        data.cards.forEach((card) => {
          container.appendChild(renderCard(card));
        });
      }
    </script>
  </body>
</html>`;
}

function createNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 16; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
