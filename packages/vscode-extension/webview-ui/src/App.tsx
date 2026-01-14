import { useState, useCallback, useEffect } from "react";
import { SavedPanel } from "./components/SavedPanel";
import { DeckPanel } from "./components/DeckPanel";
import { SettingsModal } from "./components/SettingsModal";
import { OnboardingView } from "./components/OnboardingView";
import { CardDetailView } from "./components/CardDetailView";
import { useVSCode } from "./hooks/useVSCode";
import type { Card, WebviewMode, WebviewInitialData, OnboardingState } from "./types";
import "./styles/index.css";

// 从 window 对象获取初始数据（由扩展注入）
declare global {
  interface Window {
    __INITIAL_DATA__?: WebviewInitialData;
  }
}

export default function App() {
  const [_mode, setMode] = useState<WebviewMode>("deal");
  const [savedCards, setSavedCards] = useState<Card[]>([]);
  void _mode; // mode 变量保留用于后续功能扩展
  const [deckCards, setDeckCards] = useState<Card[]>([]);
  const [editMode, setEditMode] = useState(false);
  
  // Settings 状态
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // Onboarding 状态
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isHelpMode, setIsHelpMode] = useState(false); // true = 从设置进入
  const [onboardingState, setOnboardingState] = useState<OnboardingState>({
    mcpConfigured: false,
    commandsConfigured: false,
  });

  // 卡片详细页状态
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);

  // 项目信息
  const [currentProject, setCurrentProject] = useState<string>("");
  const [projects, setProjects] = useState<string[]>([]);

  const { postMessage, isInVSCode } = useVSCode((message) => {
    switch (message.type) {
      case "update": {
        const { cards, mode: newMode, onboardingState: obState, showOnboarding: showOb, currentProject: proj, projects: projs } = message.data;
        setMode(newMode);
        if (newMode === "collection") {
          setSavedCards(cards);
          setDeckCards([]);
        } else {
          setDeckCards(cards);
          setSavedCards([]);
        }
        if (obState) {
          setOnboardingState(obState);
        }
        if (showOb !== undefined) {
          setShowOnboarding(showOb);
        }
        if (proj !== undefined) {
          setCurrentProject(proj);
        }
        if (projs !== undefined) {
          setProjects(projs);
        }
        break;
      }
      case "onboardingState":
        setOnboardingState(message.state);
        break;
      case "showOnboarding":
        setIsHelpMode(false); // 从扩展端触发的是 Onboarding 模式
        setShowOnboarding(true);
        break;
    }
  });

  // 初始化
  useEffect(() => {
    const initialData = window.__INITIAL_DATA__;
    if (initialData) {
      setMode(initialData.mode);
      if (initialData.mode === "collection") {
        setSavedCards(initialData.cards);
      } else {
        setDeckCards(initialData.cards);
      }
      if (initialData.onboardingState) {
        setOnboardingState(initialData.onboardingState);
      }
      if (initialData.showOnboarding) {
        setShowOnboarding(true);
      }
      if (initialData.currentProject) {
        setCurrentProject(initialData.currentProject);
      }
      if (initialData.projects) {
        setProjects(initialData.projects);
      }
    } else {
      // 浏览器开发模式或无初始数据
      setDeckCards([]);
    }

    postMessage({ type: "ready" });
  }, [isInVSCode, postMessage]);

  // Dark mode 切换效果
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove("light-mode");
    } else {
      document.body.classList.add("light-mode");
    }
  }, [isDarkMode]);

  const handleToggleEdit = useCallback(() => {
    setEditMode((prev) => !prev);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setSavedCards((prev) => prev.filter((card) => card.id !== id));
      postMessage({ type: "delete", id });
    },
    [postMessage]
  );

  const handleAddTag = useCallback(
    (id: string, tag: string) => {
      setSavedCards((prev) =>
        prev.map((card) => {
          if (card.id === id && !card.tags.includes(tag)) {
            const newTags = [...card.tags, tag];
            postMessage({ type: "updateTags", id, tags: newTags });
            return { ...card, tags: newTags };
          }
          return card;
        })
      );
    },
    [postMessage]
  );

  const handleDeleteTag = useCallback(
    (id: string, tag: string) => {
      setSavedCards((prev) =>
        prev.map((card) => {
          if (card.id === id) {
            const newTags = card.tags.filter((t) => t !== tag);
            postMessage({ type: "updateTags", id, tags: newTags });
            return { ...card, tags: newTags };
          }
          return card;
        })
      );
    },
    [postMessage]
  );

  const handleDrop = useCallback(
    (cardId: string) => {
      const cardIndex = deckCards.findIndex((c) => c.id === cardId);
      if (cardIndex >= 0) {
        const [card] = deckCards.splice(cardIndex, 1);
        setDeckCards([...deckCards]);
        setSavedCards((prev) => [card, ...prev]);
        postMessage({ type: "favorite", id: card.id });
      }
    },
    [deckCards, postMessage]
  );

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const handleToggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const handleOpenHelp = useCallback(() => {
    setSettingsOpen(false);
    setIsHelpMode(true); // 从设置进入，是 Help 模式
    setShowOnboarding(true);
  }, []);

  const handleOnboardingAction = useCallback(
    (action: string) => {
      postMessage({ type: "onboardingAction", action });
    },
    [postMessage]
  );

  const handleBackFromOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setIsHelpMode(false); // 返回时重置
  }, []);

  const handleCardClick = useCallback((card: Card) => {
    setSelectedCard(card);
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setSelectedCard(null);
  }, []);

  // 根据状态显示不同视图
  if (showOnboarding) {
    return (
      <OnboardingView
        state={onboardingState}
        onAction={handleOnboardingAction}
        onBack={handleBackFromOnboarding}
        isHelpMode={isHelpMode}
      />
    );
  }

  // 卡片详细页
  if (selectedCard) {
    return (
      <CardDetailView
        savedCards={savedCards}
        deckCards={deckCards}
        initialCard={selectedCard}
        onBack={handleBackFromDetail}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div className="frame">
      <SavedPanel
        cards={savedCards}
        editMode={editMode}
        onToggleEdit={handleToggleEdit}
        onDelete={handleDelete}
        onAddTag={handleAddTag}
        onDeleteTag={handleDeleteTag}
        onDrop={handleDrop}
        onOpenSettings={handleOpenSettings}
        onCardClick={handleCardClick}
        currentProject={currentProject}
        projects={projects}
      />
      <DeckPanel cards={deckCards} onCardClick={handleCardClick} />
      
      <SettingsModal
        isOpen={settingsOpen}
        onClose={handleCloseSettings}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
        onOpenHelp={handleOpenHelp}
      />
    </div>
  );
}
