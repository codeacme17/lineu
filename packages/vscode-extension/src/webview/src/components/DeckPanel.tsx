import { useState, useCallback } from "react";
import type { Card } from "../types";

interface DeckPanelProps {
  cards: Card[];
  onCardClick?: (card: Card) => void;
}

export function DeckPanel({ cards, onCardClick }: DeckPanelProps) {
  const [showHint, setShowHint] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  return (
    <section className="deck">
      <div className="deck-header">
        <div className="deck-title">
          Catching
          <span 
            className="notice-icon" 
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
          </span>
        </div>
        <div className={`deck-hint ${showHint ? "visible" : ""}`}>
          Drag to keep
        </div>
      </div>

      <div className={`deck-hand-wrapper ${showInfo ? "show-info" : ""}`}>
        {/* Info overlay - 浮层提示，只覆盖卡片区域 */}
        <div 
          className="deck-info-overlay"
          onMouseEnter={() => setShowInfo(true)}
          onMouseLeave={() => setShowInfo(false)}
        >
          <div className="deck-info-content">
            <div className="deck-info-item">1. Auto-refresh on MCP/Hook</div>
            <div className="deck-info-item">2. Drag to Sparks</div>
          </div>
        </div>

        <div className="deck-hand">
          {cards.length === 0 ? (
            <div className="empty">Catching new sparks...</div>
          ) : (
            cards.map((card, index) => (
              <DeckCard
                key={card.id}
                card={card}
                index={index}
                onHover={setShowHint}
                onClick={() => onCardClick?.(card)}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

interface DeckCardProps {
  card: Card;
  index: number;
  onHover: (hovering: boolean) => void;
  onClick?: () => void;
}

function DeckCard({ card, index, onHover, onClick }: DeckCardProps) {
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", card.id);
    },
    [card.id]
  );

  return (
    <div
      className="deck-card"
      style={{ animationDelay: `${index * 50}ms` }}
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
