import { useState, useCallback } from "react";
import type { Card } from "../types";

interface DeckPanelProps {
  cards: Card[];
  onCardClick?: (card: Card) => void;
}

export function DeckPanel({ cards, onCardClick }: DeckPanelProps) {
  const [showHint, setShowHint] = useState(false);

  return (
    <section className="deck">
      <div className="deck-header">
        <div className="deck-title">
          Incoming
          <span className="notice-icon" title="Will refresh on next MCP call or Hook trigger">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span className="notice-tooltip">
              Will refresh on next MCP call or Hook trigger
            </span>
          </span>
        </div>
        <div className={`deck-hint ${showHint ? "visible" : ""}`}>
          Drag to save
        </div>
      </div>

      <div className="deck-hand">
        {cards.length === 0 ? (
          <div className="empty">No incoming cards yet.</div>
        ) : (
          cards.map((card) => (
            <DeckCard
              key={card.id}
              card={card}
              onHover={setShowHint}
              onClick={() => onCardClick?.(card)}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface DeckCardProps {
  card: Card;
  onHover: (hovering: boolean) => void;
  onClick?: () => void;
}

function DeckCard({ card, onHover, onClick }: DeckCardProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", card.id);
    },
    [card.id]
  );

  return (
    <div
      className="deck-card"
      draggable
      onDragStart={handleDragStart}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onClick}
    >
      <div className="title">{card.title}</div>
      <div className="summary">{card.summary}</div>
    </div>
  );
}
