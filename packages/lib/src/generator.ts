import { v4 as uuidv4 } from "uuid";
import { Card, CardSource, CardType, CodeRef } from "./types/index.js";

export type GenerateInput = {
  contextText: string;
  diffText: string;
  selectionText?: string;
  type?: CardType;
};

type FileChange = {
  path: string;
  changeType: "added" | "deleted" | "modified";
  addedLines: string[];
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "when",
  "then",
  "else",
  "true",
  "false",
  "null",
  "undefined",
  "return",
  "const",
  "let",
  "var",
  "function",
  "class",
  "type",
  "interface",
  "struct",
  "public",
  "private",
  "protected",
  "import",
  "export",
  "default",
  "async",
  "await",
  "if",
  "else",
  "switch",
  "case",
  "break",
  "new",
]);

export function generateCards(input: GenerateInput): Card[] {
  const selectionText = input.selectionText?.trim() ?? "";
  const diffText = input.diffText ?? "";
  const contextText = input.contextText ?? "";
  const cardType = input.type;

  const fileChanges = diffText.trim() ? extractFileChanges(diffText) : [];
  const diffTokens = getTopTokens(
    fileChanges.flatMap((change) => change.addedLines).join("\n"),
    8
  );

  const cards: Card[] = [];

  if (fileChanges.length > 0) {
    cards.push(...buildFileCards(fileChanges, diffTokens, cardType));
    cards.push(...buildPatternCards(fileChanges, diffTokens, cardType));
  }

  if (fileChanges.length > 0 && (contextText || selectionText)) {
    cards.push(
      createCard({
        title: "Context + Diff Snapshot",
        summary: buildOverviewSummary(contextText, fileChanges.length),
        tags: mergeTags(["context", "diff"], diffTokens),
        source: "both",
        type: cardType,
      })
    );
  }

  if (cards.length < 3) {
    const contextCards = buildContextCards(
      selectionText,
      contextText,
      Math.max(3 - cards.length, 3),
      cardType
    );
    cards.push(...contextCards);
  }

  return cards.slice(0, 7);
}

function extractFileChanges(diffText: string): FileChange[] {
  const changes = new Map<string, FileChange>();
  let current: FileChange | null = null;

  for (const line of diffText.split("\n")) {
    if (line.startsWith("diff --git")) {
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      const path = match?.[2] ?? match?.[1];
      if (path) {
        current = {
          path,
          changeType: "modified",
          addedLines: [],
        };
        changes.set(path, current);
      } else {
        current = null;
      }
      continue;
    }

    if (!current) {
      continue;
    }

    if (line.startsWith("new file mode")) {
      current.changeType = "added";
    } else if (line.startsWith("deleted file mode")) {
      current.changeType = "deleted";
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      current.addedLines.push(line.slice(1));
    }
  }

  return Array.from(changes.values());
}

function buildFileCards(fileChanges: FileChange[], tokens: string[], cardType?: CardType): Card[] {
  return fileChanges.map((change) => {
    const label = change.changeType === "added"
      ? "Added"
      : change.changeType === "deleted"
        ? "Removed"
        : "Modified";

    const summary =
      change.addedLines.length > 0
        ? `${label} ${change.addedLines.length} line(s) in ${change.path}.`
        : `${label} ${change.path}.`;

    return createCard({
      title: `${label}: ${change.path}`,
      summary,
      tags: mergeTags([change.changeType, "diff"], tokens),
      source: "diff",
      codeRefs: [
        {
          path: change.path,
          hint: `${change.changeType} file`,
        },
      ],
      type: cardType,
    });
  });
}

function buildPatternCards(fileChanges: FileChange[], tokens: string[], cardType?: CardType): Card[] {
  const cards: Card[] = [];
  const seenKeys = new Set<string>();

  for (const change of fileChanges) {
    for (const line of change.addedLines) {
      const trimmed = line.trim();

      const functionMatch = trimmed.match(
        /\b(function|class|interface|struct|enum|type)\s+([A-Za-z0-9_]+)/i
      );
      if (functionMatch) {
        const kind = functionMatch[1].toLowerCase();
        const name = functionMatch[2];
        const key = `${kind}:${name}:${change.path}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          cards.push(
            createCard({
              title: `New ${capitalize(kind)} ${name}`,
              summary: `Added ${kind} ${name} in ${change.path}.`,
              tags: mergeTags([kind, name.toLowerCase()], tokens),
              source: "diff",
              codeRefs: [
                {
                  path: change.path,
                  hint: `${kind} ${name}`,
                },
              ],
              type: cardType,
            })
          );
        }
      }

      if (isConfigFile(change.path)) {
        const configKey = extractConfigKey(trimmed);
        if (configKey) {
          const key = `config:${configKey}:${change.path}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            cards.push(
              createCard({
                title: `Config: ${configKey}`,
                summary: `Added config key ${configKey} in ${change.path}.`,
                tags: mergeTags(["config", configKey.toLowerCase()], tokens),
                source: "diff",
                codeRefs: [
                  {
                    path: change.path,
                    hint: `config ${configKey}`,
                  },
                ],
                type: cardType,
              })
            );
          }
        }
      }

      const dependency = extractDependency(change.path, trimmed);
      if (dependency) {
        const key = `dep:${dependency}:${change.path}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          cards.push(
            createCard({
              title: `Dependency: ${dependency}`,
              summary: `Added dependency ${dependency} in ${change.path}.`,
              tags: mergeTags(["dependency", dependency.toLowerCase()], tokens),
              source: "diff",
              codeRefs: [
                {
                  path: change.path,
                  hint: `dependency ${dependency}`,
                },
              ],
              type: cardType,
            })
          );
        }
      }
    }
  }

  return cards;
}

function buildContextCards(
  selectionText: string,
  contextText: string,
  minCards: number,
  cardType?: CardType
): Card[] {
  const cards: Card[] = [];
  const primary = selectionText.trim();
  const secondary = contextText.trim();
  const combined = primary || secondary ? [primary, secondary].join("\n") : "";

  if (!combined.trim()) {
    return Array.from({ length: Math.max(minCards, 3) }).map((_, index) =>
      createCard({
        title: `Context Note ${index + 1}`,
        summary: "No additional context provided.",
        tags: ["context"],
        source: "context",
        type: cardType,
      })
    );
  }

  const sentences = splitSentences(combined);
  const chunks = chunkSentences(sentences, Math.max(minCards, 3));
  const tokens = getTopTokens(combined, 8);

  for (const chunk of chunks) {
    const summary = chunk.join(" ");
    if (!summary.trim()) {
      continue;
    }
    const title = summarizeTitle(summary);
    cards.push(
      createCard({
        title,
        summary,
        tags: mergeTags(["context"], tokens),
        source: "context",
        type: cardType,
      })
    );
  }

  return cards;
}

function splitSentences(text: string): string[] {
  if (!text.trim()) {
    return [];
  }
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function chunkSentences(sentences: string[], targetCards: number): string[][] {
  if (sentences.length === 0) {
    return [];
  }
  const chunkSize = Math.max(1, Math.ceil(sentences.length / targetCards));
  const chunks: string[][] = [];
  for (let i = 0; i < sentences.length; i += chunkSize) {
    chunks.push(sentences.slice(i, i + chunkSize));
  }
  return chunks;
}

function summarizeTitle(text: string): string {
  const tokens = getTopTokens(text, 3);
  if (tokens.length > 0) {
    return tokens.map(capitalize).join(" ");
  }
  return "Context Note";
}

function buildOverviewSummary(contextText: string, fileCount: number): string {
  const snippet = splitSentences(contextText).slice(0, 2).join(" ");
  const filePart = fileCount > 0 ? `${fileCount} file(s) touched.` : "";
  return [snippet, filePart].filter(Boolean).join(" ").trim();
}

function getTopTokens(text: string, maxCount: number): string[] {
  const counts = new Map<string, number>();
  for (const token of tokenize(text)) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token)
    .slice(0, maxCount);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length > 2)
    .filter((token) => !STOPWORDS.has(token));
}

function mergeTags(base: string[], tokens: string[]): string[] {
  const tags = new Set<string>();
  for (const tag of base) {
    if (tag) {
      tags.add(tag.toLowerCase());
    }
  }
  for (const token of tokens) {
    tags.add(token.toLowerCase());
    if (tags.size >= 8) {
      break;
    }
  }
  if (tags.size < 3) {
    for (const fallback of ["card", "insight", "note", "work"]) {
      tags.add(fallback);
      if (tags.size >= 3) {
        break;
      }
    }
  }
  return Array.from(tags).slice(0, 8);
}

function isConfigFile(path: string): boolean {
  return (
    path.endsWith(".env") ||
    path.endsWith(".yaml") ||
    path.endsWith(".yml") ||
    path.endsWith(".json") ||
    path.endsWith(".toml") ||
    path.endsWith(".ini")
  );
}

function extractConfigKey(line: string): string | null {
  const match =
    line.match(/^([A-Za-z0-9_.-]+)\s*[:=]/) ??
    line.match(/^["']([A-Za-z0-9_.-]+)["']\s*:/);
  return match?.[1] ?? null;
}

function extractDependency(path: string, line: string): string | null {
  if (path.endsWith("package.json")) {
    const match = line.match(/^"([A-Za-z0-9_.-]+)"\s*:\s*"/);
    const name = match?.[1];
    if (name && !["name", "version", "private", "scripts"].includes(name)) {
      return name;
    }
  }

  if (path.endsWith("go.mod")) {
    const match = line.match(/^(?:require\s+)?([^\s]+)\s+v/);
    return match?.[1] ?? null;
  }

  if (path.endsWith("requirements.txt")) {
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*(==|>=|<=|~=|!=)?/);
    return match?.[1] ?? null;
  }

  return null;
}

function createCard(params: {
  title: string;
  summary: string;
  tags: string[];
  source: CardSource;
  codeRefs?: CodeRef[];
  type?: CardType;
}): Card {
  return {
    id: uuidv4(),
    type: params.type,
    title: params.title,
    summary: params.summary,
    tags: params.tags.slice(0, 8),
    source: params.source,
    codeRefs: params.codeRefs,
    createdAt: new Date().toISOString(),
  };
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
