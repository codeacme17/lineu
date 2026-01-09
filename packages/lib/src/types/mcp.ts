export type CaptureContextInput = {
  seedText?: string;
  recentInputs?: string[];
  metadata?: Record<string, string>;
};

export type CaptureContextResult = {
  conversationText: string;
  recentInputs: string[];
  metadata: Record<string, unknown>;
};
