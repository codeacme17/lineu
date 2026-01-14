import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { Card } from "../types";

// Generate prompt for respark/deepspark
function generateSparkPrompt(card: Card, action: "respark" | "deepspark"): string {
  const context = card.context || card.summary;
  
  if (action === "respark") {
    return `Based on this knowledge card, please generate a DIFFERENT perspective or insight.

**Original Card:**
- Title: ${card.title}
- Summary: ${card.summary}
- Type: ${card.type}

**Original Conversation Context:**
${context}

---

Please focus on:
- Alternative approaches or solutions
- Trade-offs that weren't highlighted
- Related concepts that weren't the main focus
- Potential gotchas or edge cases

Then call capture_context MCP tool with:
- action: "respark"
- cardId: "${card.id}"
- type: Choose appropriate type
- seedText: Your new summary
- rawConversation: Include this conversation
- pushToExtension: true`;
  }
  
  // deepspark
  return `Please help me understand this topic more deeply.

**Card to Deep Dive:**
- Title: ${card.title}
- Summary: ${card.summary}
- Type: ${card.type}

**Original Conversation Context:**
${context}

---

Please explain:
1. **Why** - The underlying reason or motivation
2. **How** - The mechanism or implementation details
3. **When** - Best use cases and when to avoid
4. **What if** - Edge cases, limitations, or alternatives

Then call capture_context MCP tool with:
- action: "deepspark"
- cardId: "${card.id}"
- type: "knowledge"
- seedText: A comprehensive summary of the deep dive
- rawConversation: Include this conversation
- pushToExtension: true`;
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
  const [copiedAction, setCopiedAction] = useState<"respark" | "deepspark" | null>(null);
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

  // Copy prompt to clipboard for respark/deepspark
  const handleCopyPrompt = useCallback(async (action: "respark" | "deepspark") => {
    const prompt = generateSparkPrompt(activeCard, action);
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedAction(action);
      setTimeout(() => setCopiedAction(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = prompt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedAction(action);
      setTimeout(() => setCopiedAction(null), 2000);
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
          <h1 className="card-detail-title">{activeCard.title}</h1>

          <div className="card-detail-meta-inline">
            <span className="card-type-badge">{activeCard.type}</span>
            <span className="card-source">from {activeCard.source}</span>
            {isSaved && (
              <>
                <button 
                  className={`spark-btn respark ${copiedAction === "respark" ? "copied" : ""}`}
                  onClick={() => handleCopyPrompt("respark")} 
                  title="Respark: Generate different perspective"
                >
                  {copiedAction === "respark" ? "Copied!" : "🔄 Respark"}
                </button>
                <button 
                  className={`spark-btn deepspark ${copiedAction === "deepspark" ? "copied" : ""}`}
                  onClick={() => handleCopyPrompt("deepspark")} 
                  title="Deepspark: Deep dive into this topic"
                >
                  {copiedAction === "deepspark" ? "Copied!" : "🔍 Deepspark"}
                </button>
                <button className="delete-btn-inline" onClick={handleDelete} title="Delete">
                  <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 14h10l1-14" />
                  </svg>
                </button>
              </>
            )}
          </div>
          
          <section className="card-detail-section">
            <h2>Summary</h2>
            <p>{activeCard.summary}</p>
          </section>

          <section className="card-detail-section">
            <h2>Details</h2>
            <p className="card-detail-body">
              This insight was captured during a coding session. It represents a 
              {activeCard.type === "bug" ? " bug fix" : 
               activeCard.type === "best_practice" ? " best practice" : 
               " knowledge snippet"} 
              that emerged from the conversation context.
              <br /><br />
              <strong>Context:</strong> The solution involved analyzing the {activeCard.source} 
              to identify patterns and extract actionable insights. This card serves as a 
              reference for similar scenarios in the future.
              <br /><br />
              <strong>Key Takeaways:</strong>
              <ul>
                <li>Consider edge cases when implementing similar solutions</li>
                <li>Document the reasoning behind the approach</li>
                <li>Test thoroughly before applying to production</li>
              </ul>
            </p>
          </section>

          <section className="card-detail-section">
            <h2>Tags</h2>
            <div className="card-detail-tags">
              {activeCard.tags.map((tag) => (
                <span key={tag} className="card-detail-tag">{tag}</span>
              ))}
            </div>
          </section>

          <section className="card-detail-section">
            <h2>Created</h2>
            <p className="card-detail-date">
              {new Date(activeCard.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </section>
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
