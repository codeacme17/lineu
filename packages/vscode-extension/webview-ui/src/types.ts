// Card 类型定义，与 @lineu/lib 保持一致
export interface Card {
  id: string;
  title: string;
  summary: string;
  /** Detailed explanation */
  detail?: string;
  tags: string[];
  source: "context" | "diff" | "both";
  createdAt: string;
  type: "bug" | "best_practice" | "knowledge";
  project?: string;
  /** Original conversation context for respark/deepspark (not displayed) */
  context?: string;
}

export type WebviewMode = "deal" | "collection";

// Onboarding 状态
export interface OnboardingState {
  mcpConfigured: boolean;
  commandsConfigured: boolean;
}

// VSCode 发送给 Webview 的初始数据
export interface WebviewInitialData {
  cards: Card[];
  mode: WebviewMode;
  onboardingState?: OnboardingState;
  showOnboarding?: boolean;
  currentProject?: string;
  projects?: string[];
}

// Webview 发送给 VSCode 的消息类型
export type WebviewMessage =
  | { type: "favorite"; id: string }
  | { type: "delete"; id: string }
  | { type: "updateTags"; id: string; tags: string[] }
  | { type: "ready" }
  | { type: "onboardingAction"; action: string };

// VSCode 发送给 Webview 的消息类型
export type ExtensionMessage =
  | { type: "update"; data: WebviewInitialData }
  | { type: "cardSaved"; id: string }
  | { type: "onboardingState"; state: OnboardingState }
  | { type: "showOnboarding" };
