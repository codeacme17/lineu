export type CardSource = "context" | "diff" | "both";

export type CardType = "bug" | "best_practice" | "knowledge";

export type CodeRef = {
  path: string;
  hint?: string;
};

/** Deep dive exploration record */
export type DiveRecord = {
  /** The topic user chose to dive into */
  topic: string;
  /** AI's exploration summary */
  summary: string;
  /** Detailed exploration content */
  detail?: string;
  /** Next level deep dive options */
  deepDiveOptions?: string[];
  /** When this dive was created */
  createdAt: string;
};

export type Card = {
  id: string;
  type?: CardType;
  title: string;
  summary: string;
  /** Detailed explanation */
  detail?: string;
  tags: string[];
  source: CardSource;
  codeRefs?: CodeRef[];
  createdAt: string;
  /** Project name (workspace folder name) */
  project?: string;
  /** Original conversation context for respark/deepspark */
  context?: string;
  /** AI-suggested related topics for deeper exploration (initial) */
  deepDiveOptions?: string[];
  /** Chain of deep dive explorations on this card */
  dives?: DiveRecord[];
};
