"use client";

import React, { useMemo } from "react";

interface AiMarkdownViewProps {
  content?: string;
  text?: string; // Support either prop name
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

  // Clean any loose heading hashes at the start or within inline segments (e.g., "### Title")
  const text = rawText.replace(/#{1,6}\s+/g, "");

  // Match: **bold**, *italic*, `code`, [Page 123] or [ទំព័រទី 123] citations
  const tokenRegex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[(?:Page|ទំព័រទី)\s*\d+[^\]]*\])/gi;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900 dark:text-white">
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
          className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-brand-700 dark:bg-slate-800 dark:text-brand-300"
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
            className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 hover:bg-brand-200 dark:bg-brand-950 dark:text-brand-300 dark:hover:bg-brand-900 transition mx-0.5 shadow-xs active:scale-95 cursor-pointer select-none"
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
            className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 mx-0.5"
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
 * Complete, robust AI Markdown renderer supporting headings (# to ######),
 * bullet lists, numbered lists, blockquotes, code blocks, and language separators.
 * Automatically cleans any raw `###` markers.
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

    // Split custom language separators if present (e.g. from dual-language AI prompts)
    const normalizedText = sourceText.replace(/===SPLIT_LANG_EXPLANATION===/g, "\n\n---\n\n");
    const rawLines = normalizedText.split("\n");

    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let codeLanguage = "";

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();

      // Handle Code Blocks (```lang ... ```)
      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <pre
              key={`code-${i}`}
              className="my-2 rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-slate-100 overflow-x-auto border border-slate-800"
            >
              <code>{codeBuffer.join("\n")}</code>
            </pre>
          );
          codeBuffer = [];
          inCodeBlock = false;
          codeLanguage = "";
        } else {
          inCodeBlock = true;
          codeLanguage = trimmed.slice(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Empty Lines
      if (!trimmed) {
        elements.push(<div key={`spacer-${i}`} className="h-1.5" />);
        continue;
      }

      // Horizontal Dividers (---, ***, ___)
      if (/^(\-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        elements.push(
          <hr
            key={`hr-${i}`}
            className="my-2.5 border-slate-200 dark:border-slate-800"
          />
        );
        continue;
      }

      // 1. Standard Headings: #, ##, ###, ####, #####, ######
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = headingMatch[2].trim();

        if (level === 1) {
          elements.push(
            <h3
              key={`h1-${i}`}
              className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white mt-3 mb-1 tracking-tight"
            >
              {formatInlineText(headingText, onJumpToPage)}
            </h3>
          );
        } else if (level === 2) {
          elements.push(
            <h4
              key={`h2-${i}`}
              className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-2.5 mb-1"
            >
              {formatInlineText(headingText, onJumpToPage)}
            </h4>
          );
        } else if (level === 3) {
          elements.push(
            <h5
              key={`h3-${i}`}
              className="text-xs font-bold text-brand-700 dark:text-brand-400 mt-2 mb-0.5 flex items-center gap-1"
            >
              {formatInlineText(headingText, onJumpToPage)}
            </h5>
          );
        } else {
          elements.push(
            <h6
              key={`h4-${i}`}
              className="text-[11px] font-bold text-slate-800 dark:text-slate-200 mt-1.5 mb-0.5"
            >
              {formatInlineText(headingText, onJumpToPage)}
            </h6>
          );
        }
        continue;
      }

      // 2. Numbered list items: "1. ### Heading", "1. Item text"
      const orderedMatch = trimmed.match(/^(\d+[\.\)])\s*(?:#{1,6}\s*)?(.*)$/);
      if (orderedMatch) {
        const numPrefix = orderedMatch[1];
        const itemContent = orderedMatch[2];
        elements.push(
          <div key={`ol-${i}`} className="flex items-start gap-1.5 pl-0.5 my-1 text-xs leading-relaxed">
            <span className="font-bold text-brand-600 dark:text-brand-400 shrink-0 select-none">
              {numPrefix}
            </span>
            <span className="text-slate-800 dark:text-slate-200 flex-1">
              {formatInlineText(itemContent, onJumpToPage)}
            </span>
          </div>
        );
        continue;
      }

      // 3. Bullet list items: "• ### Heading", "- Item text", "* Item text"
      const bulletMatch = trimmed.match(/^([-*•+])\s*(?:#{1,6}\s*)?(.*)$/);
      if (bulletMatch) {
        const itemContent = bulletMatch[2];
        elements.push(
          <div key={`ul-${i}`} className="flex items-start gap-1.5 pl-0.5 my-1 text-xs leading-relaxed">
            <span className="font-bold text-brand-500 shrink-0 select-none">•</span>
            <span className="text-slate-800 dark:text-slate-200 flex-1">
              {formatInlineText(itemContent, onJumpToPage)}
            </span>
          </div>
        );
        continue;
      }

      // 4. Blockquotes: "> Quote text", "> ### Quote heading"
      if (trimmed.startsWith(">")) {
        const quoteContent = trimmed.replace(/^>\s*(?:#{1,6}\s*)?/, "");
        elements.push(
          <blockquote
            key={`quote-${i}`}
            className="border-l-2 border-brand-500 pl-2.5 my-1.5 italic text-slate-700 dark:text-slate-300 text-xs bg-brand-50/30 dark:bg-brand-950/20 py-1 rounded-r-md"
          >
            {formatInlineText(quoteContent, onJumpToPage)}
          </blockquote>
        );
        continue;
      }

      // 5. Standard Paragraph (with any stray ### cleaned)
      elements.push(
        <p key={`p-${i}`} className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 my-0.5">
          {formatInlineText(line, onJumpToPage)}
        </p>
      );
    }

    // Flush remaining open code block if any
    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <pre
          key="code-end"
          className="my-2 rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-slate-100 overflow-x-auto border border-slate-800"
        >
          <code>{codeBuffer.join("\n")}</code>
        </pre>
      );
    }

    return elements;
  }, [sourceText, onJumpToPage]);

  return (
    <div className={`space-y-1 select-text font-khmer noto-sans-khmer ${className}`}>
      {renderedBlocks}
      {isTyping && (
        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-brand-500 animate-pulse rounded-xs align-middle" />
      )}
    </div>
  );
}
