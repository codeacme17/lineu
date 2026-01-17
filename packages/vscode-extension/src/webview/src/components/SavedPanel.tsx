import { useState, useMemo, useCallback } from "react";
import type { Card } from "../types";
import { SettingsButton } from "./SettingsModal";
import { Dropdown } from "./Dropdown";

interface SavedPanelProps {
  cards: Card[];
  editMode: boolean;
  onToggleEdit: () => void;
  onDelete: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onDeleteTag: (id: string, tag: string) => void;
  onDrop: (cardId: string) => void;
  onOpenSettings: () => void;
  onCardClick?: (card: Card) => void;
  currentProject?: string;
  projects?: string[];
}

export function SavedPanel({
  cards,
  editMode,
  onToggleEdit,
  onDelete,
  onAddTag,
  onDeleteTag,
  onDrop,
  onOpenSettings,
  onCardClick,
  currentProject,
  projects = [],
}: SavedPanelProps) {
  const [activeTag, setActiveTag] = useState("all");
  const [isDropReady, setIsDropReady] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 收集所有标签
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    cards.forEach((card) => card.tags.forEach((t) => tagsSet.add(t)));
    return ["all", ...Array.from(tagsSet)];
  }, [cards]);

  // 过滤卡片
  const filteredCards = useMemo(() => {
    if (activeTag === "all") return cards;
    return cards.filter((card) => card.tags.includes(activeTag));
  }, [cards, activeTag]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDropReady(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDropReady(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDropReady(false);
      const cardId = e.dataTransfer.getData("text/plain");
      if (cardId) {
        onDrop(cardId);
      }
    },
    [onDrop]
  );

  const handleDelete = useCallback(
    (id: string) => {
      setDeletingId(id);
      setTimeout(() => {
        onDelete(id);
        setDeletingId(null);
      }, 300);
    },
    [onDelete]
  );

  return (
    <section
      className={`panel ${isDropReady ? "drop-ready" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="panel-header">
        <div className="panel-title-group">
          <div className="panel-title">Sparks</div>
          {currentProject && (
            <div className="panel-project" title={`Project: ${currentProject}${projects.length > 1 ? ` (${projects.length} total)` : ""}`}>
              {currentProject}
            </div>
          )}
        </div>
        <div className="panel-actions">
          <button
            className={`btn btn-secondary ${editMode ? "active" : ""}`}
            onClick={onToggleEdit}
            title={editMode ? "Done" : "Edit"}
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <Dropdown
            value={activeTag}
            options={allTags}
            onChange={setActiveTag}
            formatLabel={(tag) => (tag === "all" ? "All" : tag)}
            searchable
          />
          <SettingsButton onClick={onOpenSettings} />
        </div>
      </div>

      <div className={`saved-list ${editMode ? "editing" : ""}`}>
        {filteredCards.length === 0 ? (
          <div className="empty">No sparks yet.</div>
        ) : (
          filteredCards.map((card, index) => (
            <SavedCard
              key={card.id}
              card={card}
              index={index}
              editMode={editMode}
              isDeleting={deletingId === card.id}
              onDelete={handleDelete}
              onAddTag={onAddTag}
              onDeleteTag={onDeleteTag}
              onClick={() => onCardClick?.(card)}
            />
          ))
        )}
      </div>
    </section>
  );
}

interface SavedCardProps {
  card: Card;
  index: number;
  editMode: boolean;
  isDeleting: boolean;
  onDelete: (id: string) => void;
  onAddTag: (id: string, tag: string) => void;
  onDeleteTag: (id: string, tag: string) => void;
  onClick?: () => void;
}

function SavedCard({
  card,
  index,
  editMode,
  isDeleting,
  onDelete,
  onAddTag,
  onDeleteTag,
  onClick,
}: SavedCardProps) {
  const [newTag, setNewTag] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && newTag.trim()) {
      onAddTag(card.id, newTag.trim());
      setNewTag("");
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // 如果在编辑模式，不触发点击
    if (editMode) return;
    // 如果点击的是输入框或按钮，不触发
    if ((e.target as HTMLElement).closest("button, input")) return;
    onClick?.();
  };

  return (
    <div
      className={`saved-card ${isDeleting ? "deleting" : ""}`}
      draggable={editMode}
      onClick={handleClick}
      style={{ 
        cursor: editMode ? "grab" : "pointer",
        animationDelay: `${index * 50}ms`,
      }}
    >
      <div className="saved-card-header">
        <div className="saved-card-title">{card.title}</div>
        {editMode && (
          <button
            className="saved-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
            title="Delete"
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        )}
      </div>
      <div className="saved-summary">{card.summary}</div>
      <div className="saved-tags">
        {card.tags.map((tag) => (
          <span key={tag} className={`saved-tag ${editMode ? "editable" : ""}`}>
            {tag}
            {editMode && (
              <button
                className="tag-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteTag(card.id, tag);
                }}
                title="Remove tag"
              >
                ×
              </button>
            )}
          </span>
        ))}
        {editMode && (
          <input
            className="tag-input"
            placeholder="+"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  );
}
