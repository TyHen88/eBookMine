"use client";

import React, { useMemo } from "react";

interface AiMarkdownViewProps {
  content?: string;
  text?: string;
  onJumpToPage?: (page: number) => void;
  isTyping?: boolean;
  className?: string;
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and [Page X] citation badges.
 * Also cleans any accidental stray heading hashes (e.g. `### `) embedded in inline text.
 */
export function formatInlineText(
  rawText: string,
  onJumpToPage?: (page: number) => void
): React.ReactNode {
  if (!rawText) return null;

  // Clean any loose heading hashes at the start or within inline segments
  const text = rawText.replace(/#{1,6}\s+/g, "");

  // Match: **bold**, *italic*, `code`, [Page 123] or [ទំព័រទី 123] citations
  const tokenRegex =
    /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[(?:Page|ទំព័រទី)\s*\d+[^\]]*\])/gi;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong
          key={idx}
          className="font-bold text-slate-900 dark:text-white"
        >
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Italic: *text*
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={idx} className="italic text-slate-800 dark:text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Inline Code: `text`
    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={idx}
          className="rounded-md bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700 dark:bg-slate-800 dark:text-purple-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Interactive [Page X] / [ទំព័រទី X] Citations
    if (part.startsWith("[") && part.endsWith("]")) {
      const match = part.match(/\d+/);
      const pageNum = match ? parseInt(match[0], 10) : null;
      if (pageNum && onJumpToPage) {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => onJumpToPage(pageNum)}
            className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 shadow-xs transition hover:bg-brand-200 active:scale-95 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900 cursor-pointer select-none align-baseline"
            title={`Jump to Page ${pageNum}`}
          >
            <span>📖</span>
            <span>Page {pageNum}</span>
          </button>
        );
      }
      if (pageNum) {
        return (
          <span
            key={idx}
            className="mx-0.5 inline-flex items-center gap-0.5 rounded-md bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 ring-1 ring-purple-500/25 align-baseline"
          >
            📖 Page {pageNum}
          </span>
        );
      }
    }

    return part;
  });
}

/**
 * Clean, strictly left-aligned AI Markdown renderer supporting headings (# to ######),
 * GitHub alerts (> [!TIP], > [!NOTE]), bullet lists, numbered lists, blockquotes, and code blocks.
 */
export default function AiMarkdownView({
  content,
  text,
  onJumpToPage,
  isTyping = false,
  className = "",
}: AiMarkdownViewProps) {
  const sourceText = content || text || "";

  const renderedBlocks = useMemo(() => {
    if (!sourceText) return null;

    const normalizedText = sourceText.replace(
      /===SPLIT_LANG_EXPLANATION===/g,
      "\n\n---\n\n"
    );
    const rawLines = normalizedText.split("\n");

    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // Handle Code Blocks (```lang ... ```)
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <pre
              key={`code-${i}`}
              className="my-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-left font-mono text-[11px] leading-relaxed text-slate-100"
            >
              <code>{codeBuffer.join("\n")}</code>
            </pre>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Skip raw GitHub Alert tags like `> [!TIP]` or `> [!NOTE]` so they don't render ugly literal brackets
      if (/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(trimmed)) {
        continue;
      }

      // Empty Lines
      if (!trimmed) {
        elements.push(<div key={`spacer-${i}`} className="h-1" />);
        continue;
      }

      // Horizontal Dividers (---, ***, ___)
      if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        elements.push(
          <hr
            key={`hr-${i}`}
            className="my-2 border-slate-200/70 dark:border-slate-800/80"
          />
        );
        continue;
      }

      // 1. Standard Headings: #, ##, ###, ####, #####, ######
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();

        if (level <= 2) {
          elements.push(
            <h4
              key={`h2-${i}`}
              className="mt-2 mb-1 text-left text-xs sm:text-sm font-extrabold leading-snug tracking-tight text-slate-900 dark:text-white first:mt-0"
            >
              {formatInlineText(headingText, onJumpToPage)}
            </h4>
          );
        } else {
          elements.push(
            <h5
              key={`h3-${i}`}
              className="mt-2 mb-1 block text-left text-xs font-extrabold leading-snug text-brand-700 dark:text-purple-300 first:mt-0"
            >
              {formatInlineText(headingText, onJumpToPage)}
            </h5>
          );
        }
        continue;
      }

      // 2. Numbered list items: "1. Item text"
      const orderedMatch = trimmed.match(/^(\d+[\.\)])\s*(?:#{1,6}\s*)?(.*)$/);
      if (orderedMatch) {
        const numPrefix = orderedMatch[1];
        const itemContent = orderedMatch[2];
        elements.push(
          <div
            key={`ol-${i}`}
            className="my-1 grid grid-cols-[18px_1fr] items-baseline gap-1.5 text-left text-xs leading-relaxed"
          >
            <span className="select-none font-extrabold text-brand-600 dark:text-purple-400">
              {numPrefix}
            </span>
            <div className="min-w-0 break-words text-slate-800 dark:text-slate-200">
              {formatInlineText(itemContent, onJumpToPage)}
            </div>
          </div>
        );
        continue;
      }

      // 3. Bullet list items: "• Item text", "- Item text", "* Item text"
      const bulletMatch = trimmed.match(/^([-*•+])\s*(?:#{1,6}\s*)?(.*)$/);
      if (bulletMatch) {
        const itemContent = bulletMatch[2];
        elements.push(
          <div
            key={`ul-${i}`}
            className="my-1 grid grid-cols-[12px_1fr] items-baseline gap-1.5 text-left text-xs leading-relaxed"
          >
            <span className="select-none font-bold text-brand-500 dark:text-purple-400">
              •
            </span>
            <div className="min-w-0 break-words text-slate-800 dark:text-slate-200">
              {formatInlineText(itemContent, onJumpToPage)}
            </div>
          </div>
        );
        continue;
      }

      // 4. Blockquotes: "> Quote text"
      if (trimmed.startsWith(">")) {
        const quoteContent = trimmed.replace(/^>\s*(?:#{1,6}\s*)?/, "");
        if (!quoteContent) continue;
        elements.push(
          <blockquote
            key={`quote-${i}`}
            className="my-1.5 rounded-r-lg border-l-2 border-purple-500 bg-purple-500/10 py-1.5 pl-2.5 pr-2 text-left text-xs italic leading-relaxed text-slate-700 dark:text-slate-300"
          >
            {formatInlineText(quoteContent, onJumpToPage)}
          </blockquote>
        );
        continue;
      }

      // 5. Standard Paragraph
      elements.push(
        <p
          key={`p-${i}`}
          className="my-1 text-left text-xs leading-relaxed break-words text-slate-800 dark:text-slate-200"
        >
          {formatInlineText(line, onJumpToPage)}
        </p>
      );
    }

    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <pre
          key="code-end"
          className="my-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-left font-mono text-[11px] leading-relaxed text-slate-100"
        >
          <code>{codeBuffer.join("\n")}</code>
        </pre>
      );
    }

    return elements;
  }, [sourceText, onJumpToPage]);

  return (
    <div
      className={`w-full text-left select-text font-khmer noto-sans-khmer ${className}`}
    >
      {renderedBlocks}
      {isTyping && (
        <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse rounded-xs bg-purple-400 align-middle" />
      )}
    </div>
  );
}
