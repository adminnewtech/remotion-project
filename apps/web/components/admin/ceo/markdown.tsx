'use client';

import type { JSX } from 'react';

/**
 * Tiny, dependency-free markdown-ish renderer for AI brief / copilot text.
 * Supports: # / ## / ### headings, - bullets, **bold**, and `code`, blank-line
 * paragraph breaks. Not a full parser — just enough to render the briefs nicely
 * without pulling in a markdown library. Input is treated as plain text (no raw
 * HTML is ever injected).
 */
export function SimpleMarkdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: JSX.Element[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="my-2 list-disc space-y-1 ps-5 text-sm">
          {bullets.map((b, i) => (
            <li key={i}>{renderInline(b)}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      bullets.push(line.replace(/^\s*[-*]\s+/, ''));
      return;
    }
    flushBullets();
    if (!line.trim()) return;
    if (line.startsWith('### ')) {
      out.push(
        <h4 key={idx} className="mt-3 mb-1 text-sm font-bold">
          {renderInline(line.slice(4))}
        </h4>,
      );
    } else if (line.startsWith('## ')) {
      out.push(
        <h3 key={idx} className="mt-4 mb-1 text-base font-bold">
          {renderInline(line.slice(3))}
        </h3>,
      );
    } else if (line.startsWith('# ')) {
      out.push(
        <h2 key={idx} className="mb-2 text-lg font-extrabold">
          {renderInline(line.slice(2))}
        </h2>,
      );
    } else {
      out.push(
        <p key={idx} className="my-1.5 text-sm leading-relaxed">
          {renderInline(line)}
        </p>,
      );
    }
  });
  flushBullets();

  return <div className={className}>{out}</div>;
}

/** Inline **bold**, `code`, and _italic_ within a single line. */
function renderInline(text: string): JSX.Element[] {
  const tokens: JSX.Element[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) tokens.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    const tok = m[0];
    if (tok.startsWith('**')) {
      tokens.push(
        <strong key={key++} className="font-bold">
          {tok.slice(2, -2)}
        </strong>,
      );
    } else if (tok.startsWith('`')) {
      tokens.push(
        <code key={key++} className="rounded bg-neutral-100 px-1 py-0.5 font-mono text-xs">
          {tok.slice(1, -1)}
        </code>,
      );
    } else {
      tokens.push(
        <em key={key++} className="text-muted">
          {tok.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) tokens.push(<span key={key++}>{text.slice(last)}</span>);
  return tokens;
}
