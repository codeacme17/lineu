export type CardSource = "context" | "diff" | "both";

export type CardType = "bug" | "best_practice" | "knowledge";

export type CodeRef = {
  path: string;
  hint?: string;
};

export type Card = {
  id: string;
  type?: CardType;
  title: string;
  summary: string;
  tags: string[];
  source: CardSource;
  codeRefs?: CodeRef[];
  createdAt: string;
  /** Project name (workspace folder name) */
  project?: string;
  /** Original conversation context for respark/deepspark */
  context?: string;
};
