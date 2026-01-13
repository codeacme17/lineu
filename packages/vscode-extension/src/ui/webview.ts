import * as vscode from "vscode";
import type { Card } from "@lineu/lib";

type WebviewMode = "deal" | "collection";

type UiCard = Card & {
  isMock?: boolean;
};

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
    <title>Lineu</title>
    <style>
      :root {
        color-scheme: light dark;
        --bg: #0c0e12;
        --panel: #161922;
        --panel-soft: #12151c;
        --border: rgba(255, 255, 255, 0.08);
        --text: #edf1f7;
        --muted: rgba(237, 241, 247, 0.6);
        --accent: #4cc9f0;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: "SF Pro Text", "Segoe UI", sans-serif;
        background: radial-gradient(circle at top, rgba(76, 201, 240, 0.08), transparent 50%),
          var(--bg);
        color: var(--text);
      }
      .frame {
        padding: 12px 8px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100vh;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .brand {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 12px;
        flex: 1 1 auto;
        min-height: 420px;
        position: relative;
      }
      .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .panel-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .panel-title {
        font-size: 12px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .tag-filter {
        border: 1px solid var(--border);
        background: transparent;
        color: var(--muted);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        appearance: none;
      }
      .icon {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .edit-toggle {
        border: 1px solid var(--border);
        background: transparent;
        color: var(--muted);
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 11px;
        cursor: pointer;
      }
      .edit-toggle.active {
        color: #041319;
        background: var(--accent);
        border-color: transparent;
      }
      .saved-list {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
      }
      .saved-card {
        width: 100%;
        border-radius: 18px;
        padding: 12px 14px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: linear-gradient(140deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.01));
        font-size: 13px;
        color: var(--text);
        position: relative;
      }
      .saved-card-title {
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      .saved-tags {
        align-items: center;
        margin-top: 6px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .saved-tag {
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: var(--muted);
      }
      .saved-card {
        position: relative;
        overflow: hidden;
      }
      .saved-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .saved-delete {
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: transparent;
        color: var(--muted);
        font-size: 11px;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: 999px;
        display: none;
      }
      .saved-list.editing .saved-delete {
        display: inline-flex;
      }
      .tag-add {
        border: 1px dashed rgba(255, 255, 255, 0.2);
        background: transparent;
        color: var(--muted);
        width: 22px;
        height: 22px;
        border-radius: 999px;
        display: none;
        align-items: center;
        justify-content: center;
        cursor: pointer;
      }
      .saved-list.editing .tag-add {
        display: inline-flex;
      }
      .tag-input {
        border: 1px dashed rgba(255, 255, 255, 0.2);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 10px;
        color: var(--text);
        background: transparent;
        outline: none;
        width: 70px;
        display: none;
      }
      .saved-list.editing .tag-input {
        display: inline-flex;
      }
      .empty {
        margin-top: 12px;
        font-size: 12px;
        color: var(--muted);
      }
      .deck {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 10px 12px 12px;
        margin-top: auto;
        flex: 0 0 230px;
        display: flex;
        flex-direction: column;
      }
      .deck-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
      }
      .deck-title {
        font-size: 12px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .deck-hint {
        font-size: 11px;
        color: var(--accent);
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .deck-hint.visible {
        opacity: 1;
      }
      .deck-hand {
        display: flex;
        flex-direction: column;
        gap: 10px;
        overflow-y: auto;
        padding-bottom: 4px;
        padding-right: 16px;
        flex: 1 1 auto;
      }
      .deck-card {
        width: calc(100% - 16px);
        padding: 10px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: linear-gradient(140deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
        position: relative;
        transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
        cursor: grab;
        overflow: hidden;
      }
      .deck-card:hover {
        transform: translateX(6px);
        border-color: var(--accent);
        background: linear-gradient(140deg, rgba(76, 201, 240, 0.14), rgba(255, 255, 255, 0.02));
      }
      .deck-card .title {
        font-size: 13px;
        margin-bottom: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .deck-card .summary {
        font-size: 11px;
        color: var(--muted);
        opacity: 0;
        max-height: 0;
        transition: opacity 0.2s ease, max-height 0.2s ease, margin-top 0.2s ease;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 0;
      }
      .deck-card:hover .summary {
        opacity: 1;
        max-height: 40px;
        margin-top: 6px;
      }
      .saved-panel.drop-ready::after {
        content: "Drop to save";
        position: absolute;
        inset: 12px;
        border: 1px dashed rgba(76, 201, 240, 0.6);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--accent);
        font-size: 12px;
        background: rgba(12, 14, 18, 0.75);
        pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div class="frame">
      <section class="panel saved-panel" id="saved-panel">
        <div class="panel-header">
          <div class="panel-title">Saved Stack</div>
          <div class="panel-actions">
            <button id="edit-toggle" class="edit-toggle" aria-label="Edit mode" title="Edit">
              <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <select id="tag-filter" class="tag-filter">
              <option value="all">All</option>
            </select>
          </div>
        </div>
        <div id="saved-list" class="saved-list"></div>
        <div id="saved-empty" class="empty" style="display:none;">No saved cards yet.</div>
      </section>

      <section class="deck">
        <div class="deck-header">
          <div class="deck-title">Incoming</div>
          <div id="deck-hint" class="deck-hint">Drag to save</div>
        </div>
        <div id="deck-hand" class="deck-hand"></div>
      </section>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const data = ${data};

      const mockDeck = [
        {
          id: "mock-deck-1",
          title: "Auth token refresh bug",
          summary: "Resolved token refresh race by serializing refresh calls.",
          tags: ["auth", "bug"],
          source: "context",
          createdAt: "2024-04-20T10:12:00Z",
          type: "bug",
          isMock: true,
        },
        {
          id: "mock-deck-2",
          title: "Stream parsing insight",
          summary: "Buffered partial JSON chunks to avoid parse errors.",
          tags: ["stream", "json"],
          source: "diff",
          createdAt: "2024-04-20T10:20:00Z",
          type: "knowledge",
          isMock: true,
        },
        {
          id: "mock-deck-3",
          title: "UI latency fix",
          summary: "Moved heavy work off the main thread and throttled updates.",
          tags: ["ui", "perf"],
          source: "both",
          createdAt: "2024-04-20T10:30:00Z",
          type: "best_practice",
          isMock: true,
        },
      ];

      const mockSaved = [
        {
          id: "mock-saved-1",
          title: "Cache invalidation",
          summary: "Scoped cache keys by workspace and reset on logout.",
          tags: ["cache", "best_practice"],
          source: "context",
          createdAt: "2024-04-18T09:10:00Z",
          type: "best_practice",
          isMock: true,
        },
        {
          id: "mock-saved-2",
          title: "Streaming parser",
          summary: "Buffered partial chunks to avoid JSON parse errors.",
          tags: ["stream", "json"],
          source: "diff",
          createdAt: "2024-04-17T12:30:00Z",
          type: "knowledge",
          isMock: true,
        },
        {
          id: "mock-saved-3",
          title: "Retry backoff",
          summary: "Exponential backoff with jitter stabilized API retries.",
          tags: ["retry", "resilience"],
          source: "both",
          createdAt: "2024-04-16T16:45:00Z",
          type: "knowledge",
          isMock: true,
        },
      ];

      const incomingCards = Array.isArray(data.cards) ? data.cards : [];
      const deck = data.mode === "deal"
        ? (incomingCards.length ? incomingCards : mockDeck)
        : mockDeck;
      const saved = data.mode === "collection"
        ? incomingCards
        : [];

      const savedPanelEl = document.getElementById("saved-panel");
      const savedListEl = document.getElementById("saved-list");
      const savedEmptyEl = document.getElementById("saved-empty");
      const deckHandEl = document.getElementById("deck-hand");
      const deckHintEl = document.getElementById("deck-hint");
      const tagFilterEl = document.getElementById("tag-filter");
      const editToggleEl = document.getElementById("edit-toggle");

      const state = {
        saved: saved.slice(),
        deck: deck.slice(),
        activeTag: "all",
        editMode: false,
      };

      
      
      
      function renderSaved() {
        savedListEl.innerHTML = "";
        const filtered = state.activeTag === "all"
          ? state.saved
          : state.saved.filter((card) => (card.tags || []).includes(state.activeTag));

        if (!filtered.length) {
          savedEmptyEl.style.display = "block";
        } else {
          savedEmptyEl.style.display = "none";
        }

        filtered.forEach((card) => {
          const wrapper = document.createElement("div");
          wrapper.className = "saved-card";
          wrapper.dataset.cardId = card.id;
          wrapper.draggable = state.editMode;

          const title = document.createElement("div");
          title.className = "saved-card-title";
          title.textContent = card.title;

          const tagRow = document.createElement("div");
          tagRow.className = "saved-tags";

          (card.tags || []).forEach((tag) => {
            const chip = document.createElement("div");
            chip.className = "saved-tag";
            chip.textContent = tag;
            tagRow.appendChild(chip);
          });

          const header = document.createElement("div");
          header.className = "saved-card-header";

          const remove = document.createElement("button");
          remove.className = "saved-delete";
          remove.setAttribute("title", "Delete");
          remove.setAttribute("aria-label", "Delete");
          remove.innerHTML = "<svg class=\"icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M3 6h18\"/><path d=\"M8 6V4h8v2\"/><path d=\"M6 6l1 14h10l1-14\"/><path d=\"M10 11v6\"/><path d=\"M14 11v6\"/></svg>";
          remove.addEventListener("click", (event) => {
            event.stopPropagation();
            const index = state.saved.findIndex((item) => item.id === card.id);
            if (index >= 0) {
              state.saved.splice(index, 1);
              renderFilterOptions();
              renderSaved();
            }
          });

          header.appendChild(title);
          header.appendChild(remove);

          const addBtn = document.createElement("button");
          addBtn.className = "tag-add";
          addBtn.setAttribute("title", "Add tag");
          addBtn.setAttribute("aria-label", "Add tag");
          addBtn.innerHTML = "<svg class=\"icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14\"/><path d=\"M5 12h14\"/></svg>";

          const input = document.createElement("input");
          input.className = "tag-input";
          input.placeholder = "";
          input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            const value = input.value.trim();
            if (!value) return;
            card.tags = Array.isArray(card.tags) ? card.tags : [];
            if (!card.tags.includes(value)) {
              card.tags.push(value);
            }
            input.value = "";
            renderFilterOptions();
            renderSaved();
          });

          tagRow.appendChild(addBtn);
          tagRow.appendChild(input);

          addBtn.addEventListener("click", () => {
            input.focus();
          });

          wrapper.appendChild(header);
          wrapper.appendChild(tagRow);
          savedListEl.appendChild(wrapper);
        });

        savedListEl.classList.toggle("editing", state.editMode);
      }

      function renderFilterOptions() {
        tagFilterEl.innerHTML = "";
        const tags = new Set();
        state.saved.forEach((card) => {
          (card.tags || []).forEach((tag) => tags.add(tag));
        });
        const tagList = ["all", ...Array.from(tags)];
        tagList.forEach((tag) => {
          const option = document.createElement("option");
          option.value = tag;
          option.textContent = tag === "all" ? "All" : tag;
          if (tag === state.activeTag) {
            option.selected = true;
          }
          tagFilterEl.appendChild(option);
        });
      }

      function renderDeck() {
        deckHandEl.innerHTML = "";
        if (!state.deck.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "No incoming cards yet.";
          deckHandEl.appendChild(empty);
          return;
        }

        state.deck.forEach((card) => {
          const wrapper = document.createElement("div");
          wrapper.className = "deck-card";
          wrapper.draggable = true;
          wrapper.dataset.cardId = card.id;

          const title = document.createElement("div");
          title.className = "title";
          title.textContent = card.title;

          const summary = document.createElement("div");
          summary.className = "summary";
          summary.textContent = card.summary;

          wrapper.appendChild(title);
          wrapper.appendChild(summary);

          wrapper.addEventListener("mouseenter", () => {
            deckHintEl.classList.add("visible");
          });
          wrapper.addEventListener("mouseleave", () => {
            deckHintEl.classList.remove("visible");
          });
          wrapper.addEventListener("dragstart", (event) => {
            event.dataTransfer.setData("text/plain", card.id);
          });

          deckHandEl.appendChild(wrapper);
        });
      }

      tagFilterEl.addEventListener("change", (event) => {
        state.activeTag = event.target.value;
        renderSaved();
      });

      savedPanelEl.addEventListener("dragover", (event) => {
        event.preventDefault();
        savedPanelEl.classList.add("drop-ready");
      });

      savedPanelEl.addEventListener("drop", (event) => {
        event.preventDefault();
        savedPanelEl.classList.remove("drop-ready");
        const id = event.dataTransfer.getData("text/plain");
        const cardIndex = state.deck.findIndex((card) => card.id === id);
        if (cardIndex >= 0) {
          const [card] = state.deck.splice(cardIndex, 1);
          state.saved.unshift(card);
          vscode.postMessage({ type: "favorite", id: card.id });
          renderSaved();
          renderDeck();
        }
      });

      savedPanelEl.addEventListener("dragleave", () => {
        savedPanelEl.classList.remove("drop-ready");
      });

      editToggleEl.addEventListener("click", () => {
        state.editMode = !state.editMode;
        editToggleEl.classList.toggle("active", state.editMode);
        editToggleEl.setAttribute("title", state.editMode ? "Done" : "Edit");
        editToggleEl.setAttribute("aria-label", state.editMode ? "Done" : "Edit");
        renderSaved();
      });

      savedListEl.addEventListener("dragstart", (event) => {
        if (!state.editMode) return;
        const target = event.target.closest(".saved-card");
        if (!target) return;
        event.dataTransfer.setData("text/plain", target.dataset.cardId);
        target.classList.add("dragging");
      });

      savedListEl.addEventListener("dragend", (event) => {
        const target = event.target.closest(".saved-card");
        if (target) target.classList.remove("dragging");
      });

      savedListEl.addEventListener("dragover", (event) => {
        if (!state.editMode) return;
        event.preventDefault();
        const after = getDragAfterElement(savedListEl, event.clientY);
        const draggingId = event.dataTransfer.getData("text/plain");
        if (!draggingId) return;
        const draggedIndex = state.saved.findIndex((item) => item.id === draggingId);
        if (draggedIndex < 0) return;
        const [dragged] = state.saved.splice(draggedIndex, 1);
        if (!after) {
          state.saved.push(dragged);
        } else {
          const afterId = after.dataset.cardId;
          const afterIndex = state.saved.findIndex((item) => item.id === afterId);
          state.saved.splice(afterIndex, 0, dragged);
        }
        renderSaved();
      });

      function getDragAfterElement(container, y) {
        const items = [...container.querySelectorAll(".saved-card:not(.dragging)")];
        return items.reduce(
          (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
              return { offset, element: child };
            }
            return closest;
          },
          { offset: Number.NEGATIVE_INFINITY, element: null }
        ).element;
      }

      renderFilterOptions();
      renderSaved();
      renderDeck();
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
