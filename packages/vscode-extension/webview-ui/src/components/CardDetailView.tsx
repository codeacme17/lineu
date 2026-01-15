import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Card } from "../types";
import { Markdown } from "./Markdown";

// Generate prompt for deep/dislike actions
function generateActionPrompt(card: Card, action: "deep" | "dislike"): string {
  const context = card.context || "";
  const cardInfo = `[Card] "${card.title}" - ${card.summary}`;
  
  if (action === "dislike") {
    // Respark: Generate a different perspective
    return `Generate a DIFFERENT perspective from this conversation.

Focus on:
- Alternative approaches mentioned
- Trade-offs discussed  
- Related concepts not highlighted
- Edge cases or gotchas

${cardInfo}

Previous conversation:
${context}

Then call capture_context MCP tool ONCE with ALL these parameters:
- type: appropriate type ("bug" | "best_practice" | "knowledge")
- title: Short title with NEW angle (5-10 words)
- summary: Fresh summary highlighting different aspect (1-2 sentences)
- detail: Detailed explanation of the alternative perspective
- tags: 1-2 tags (MAXIMUM 2!)
- rawConversation: The conversation above

IMPORTANT: Call exactly ONCE. Maximum 2 tags!`;
  }
  
  // Deep: Deep dive into the topic
  return `Deep dive into this topic. Explain:
1. **Why** - Underlying reason/motivation
2. **How** - Mechanism/implementation details
3. **When** - Best use cases and when to avoid
4. **What if** - Edge cases, limitations, alternatives

${cardInfo}

Previous conversation:
${context}

Then call capture_context MCP tool ONCE with ALL these parameters:
- type: "knowledge"
- title: Short title for deep dive (5-10 words)
- summary: Brief overview of the deep dive (1-2 sentences)
- detail: COMPREHENSIVE explanation covering Why/How/When/What-if
- tags: 1-2 tags (MAXIMUM 2!)
- rawConversation: The conversation above including this deep dive

IMPORTANT: Call exactly ONCE. Maximum 2 tags!`;
}

interface CardDetailViewProps {
  savedCards: Card[];
  deckCards: Card[];
  initialCard: Card;
  onBack: () => void;
  onDelete: (id: string) => void;
}

export function CardDetailView({
  savedCards,
  deckCards,
  initialCard,
  onBack,
  onDelete,
}: CardDetailViewProps) {
  const [activeCardId, setActiveCardId] = useState(initialCard.id);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [indicatorHover, setIndicatorHover] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<"next" | "prev" | null>(null);
  const [hoveredBookmark, setHoveredBookmark] = useState<{ id: string; top: number; title: string } | null>(null);
  const [copiedAction, setCopiedAction] = useState<"deep" | "dislike" | null>(null);
  const [titleHovered, setTitleHovered] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);

  // 合并所有卡片用于导航
  const allCards = useMemo(() => [...savedCards, ...deckCards], [savedCards, deckCards]);

  const activeCard = useMemo(
    () => allCards.find((c) => c.id === activeCardId) || initialCard,
    [allCards, activeCardId, initialCard]
  );

  const isSaved = useMemo(
    () => savedCards.some((c) => c.id === activeCardId),
    [savedCards, activeCardId]
  );

  // 当前卡片在其列表中的索引
  const currentList = isSaved ? savedCards : deckCards;
  const currentIndex = currentList.findIndex((c) => c.id === activeCardId);

  // 切换卡片并带动画
  const switchCard = useCallback((newId: string, direction: "next" | "prev") => {
    setTransitionDirection(direction);
    setTimeout(() => {
      setActiveCardId(newId);
      setTimeout(() => setTransitionDirection(null), 200);
    }, 50);
  }, []);

  // 循环翻页
  const handlePrev = useCallback(() => {
    const newIndex = currentIndex === 0 ? currentList.length - 1 : currentIndex - 1;
    switchCard(currentList[newIndex].id, "prev");
  }, [currentIndex, currentList, switchCard]);

  const handleNext = useCallback(() => {
    const newIndex = currentIndex === currentList.length - 1 ? 0 : currentIndex + 1;
    switchCard(currentList[newIndex].id, "next");
  }, [currentIndex, currentList, switchCard]);

  const handleDelete = useCallback(() => {
    setDeletingId(activeCardId);
    setTimeout(() => {
      onDelete(activeCardId);
      if (currentList.length > 1) {
        const newIndex = currentIndex === currentList.length - 1 ? 0 : currentIndex + 1;
        setActiveCardId(currentList[newIndex].id);
      } else {
        onBack();
      }
      setDeletingId(null);
    }, 300);
  }, [activeCardId, currentIndex, currentList, onDelete, onBack]);

  // Copy prompt to clipboard for deep/dislike
  const handleCopyPrompt = useCallback(async (action: "deep" | "dislike") => {
    const prompt = generateActionPrompt(activeCard, action);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedAction(action);
      setTimeout(() => setCopiedAction(null), 1500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = prompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedAction(action);
      setTimeout(() => setCopiedAction(null), 1500);
    }
  }, [activeCard]);

  // 底部区域滚轮切换
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const handleScroll = (e: WheelEvent) => {
      const rect = view.getBoundingClientRect();
      const bottomZone = rect.bottom - 50;
      if (e.clientY >= bottomZone) {
        e.preventDefault();
        if (e.deltaY > 0) {
          handleNext();
        } else {
          handlePrev();
        }
      }
    };

    view.addEventListener("wheel", handleScroll, { passive: false });
    return () => view.removeEventListener("wheel", handleScroll);
  }, [handleNext, handlePrev]);

  // ESC 键返回列表页
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  // 点击书签切换
  const handleBookmarkClick = useCallback((cardId: string) => {
    if (cardId === activeCardId) return;
    const targetIndex = allCards.findIndex(c => c.id === cardId);
    const currentIdx = allCards.findIndex(c => c.id === activeCardId);
    const direction = targetIndex > currentIdx ? "next" : "prev";
    switchCard(cardId, direction);
  }, [activeCardId, allCards, switchCard]);

  // 动画类名
  const contentClass = useMemo(() => {
    const classes = ["card-detail-content"];
    if (deletingId === activeCardId) classes.push("deleting");
    if (transitionDirection === "next") classes.push("slide-out-up");
    if (transitionDirection === "prev") classes.push("slide-out-down");
    return classes.join(" ");
  }, [deletingId, activeCardId, transitionDirection]);

  // 获取首字母
  const getInitial = (title: string) => {
    return title.charAt(0).toUpperCase();
  };


  return (
    <div className="card-detail-view" ref={viewRef}>
      {/* 顶部 Toast 提示 */}
      {copiedAction && (
        <div className="toast-top">
          <span className="toast-icon">✓</span>
          <span>Copied! Paste to AI chat</span>
        </div>
      )}

      {/* 左侧书签导航 */}
      <aside className="bookmark-nav">
        <div className="bookmark-scroll-area">
          {/* Saved 书签 */}
          {savedCards.map((card) => (
            <div
              key={card.id}
              className={`bookmark-item ${card.id === activeCardId ? "active" : ""} ${hoveredBookmark?.id === card.id ? "hovered" : ""}`}
              onClick={() => handleBookmarkClick(card.id)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredBookmark({ id: card.id, top: rect.top, title: card.title });
              }}
            >
              <span className="bookmark-letter">{getInitial(card.title)}</span>
            </div>
          ))}
          
          {/* 分割线 - 使用 spacer 推到下方 */}
          {savedCards.length > 0 && deckCards.length > 0 && (
            <>
              <div className="bookmark-spacer" />
              <div className="bookmark-divider" />
            </>
          )}
          
          {/* Incoming 书签 */}
          {deckCards.map((card) => (
            <div
              key={card.id}
              className={`bookmark-item ${card.id === activeCardId ? "active" : ""} ${hoveredBookmark?.id === card.id ? "hovered" : ""}`}
              onClick={() => handleBookmarkClick(card.id)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredBookmark({ id: card.id, top: rect.top, title: card.title });
              }}
            >
              <span className="bookmark-letter">{getInitial(card.title)}</span>
            </div>
          ))}
        </div>
        
        {/* 退出按钮 - 固定在底部，与页码同一水平线 */}
        <div className="exit-btn" onClick={onBack} title="Back to list">
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="card-detail-main">
        <article className={contentClass} key={activeCardId}>
          <div 
            className="card-detail-title-area"
            onMouseEnter={() => setTitleHovered(true)}
            onMouseLeave={() => setTitleHovered(false)}
          >
            <h1 className="card-detail-title">{activeCard.title}</h1>
            
            {/* Action icons - visible on hover */}
            <div className={`title-actions ${titleHovered ? "visible" : ""}`}>
              <button 
                className="title-action-btn"
                onClick={() => handleCopyPrompt("deep")} 
                title="Deep dive"
              >
                {/* Magic wand icon */}
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9" />
                  <path d="M12.2 6.2L11 5" />
                  <path d="M14 12l-8 8" />
                  <circle cx="15" cy="9" r="1" />
                </svg>
              </button>
              <button 
                className="title-action-btn dislike"
                onClick={() => handleCopyPrompt("dislike")} 
                title="Not this, try again"
              >
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>
          </div>

          <div className="card-detail-meta-inline">
            <span className="card-type-badge">{activeCard.type}</span>
            <span className="card-source">from {activeCard.source}</span>
            {isSaved && (
              <button className="delete-btn-inline" onClick={handleDelete} title="Delete">
                <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4h8v2" />
                  <path d="M6 6l1 14h10l1-14" />
                </svg>
              </button>
            )}
          </div>
          
          <section className="card-detail-section">
            <h2>Summary</h2>
            <Markdown>{activeCard.summary}</Markdown>
          </section>

          {activeCard.detail && (
            <section className="card-detail-section">
              <h2>Details</h2>
              <Markdown className="card-detail-body">{activeCard.detail}</Markdown>
            </section>
          )}

          {activeCard.tags && activeCard.tags.length > 0 && (
            <section className="card-detail-section">
              <h2>Tags</h2>
              <div className="card-detail-tags">
                {activeCard.tags.map((tag) => (
                  <span key={tag} className="card-detail-tag">{tag}</span>
                ))}
              </div>
            </section>
          )}

          {/* 右下角时间戳 */}
          <div className="card-detail-timestamp">
            {new Date(activeCard.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </div>
        </article>
      </main>

      {/* 底部小白条 - 固定在整个视图底部 */}
      <div
        className={`home-indicator ${indicatorHover ? "expanded" : ""}`}
        onMouseEnter={() => setIndicatorHover(true)}
        onMouseLeave={() => setIndicatorHover(false)}
      >
        {/* 上方提示 - 只在 hover 时显示 */}
        <div className="indicator-hint-above">scroll to switch</div>
        
        {/* 主控制区 */}
        <div className="indicator-main">
          <button className="indicator-btn left" onClick={handlePrev} title="Previous">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          
          <div className="indicator-bar">
            <span className="indicator-text">
              {currentIndex + 1} / {currentList.length}
            </span>
          </div>
          
          <button className="indicator-btn right" onClick={handleNext} title="Next">
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* 浮动的展开书签 - 像抽出来一样 */}
      {hoveredBookmark && (
        <div 
          className="bookmark-pullout"
          style={{ top: hoveredBookmark.top }}
          onMouseLeave={() => setHoveredBookmark(null)}
          onClick={() => handleBookmarkClick(hoveredBookmark.id)}
        >
          <span className="bookmark-name">{hoveredBookmark.title}</span>
        </div>
      )}
    </div>
  );
}
