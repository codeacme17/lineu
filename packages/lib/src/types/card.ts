export type CardSource = "context" | "diff" | "both";

export type CodeRef = {
  path: string;
  hint?: string;
};

export type Card = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  source: CardSource;
  codeRefs?: CodeRef[];
  createdAt: string;
};
