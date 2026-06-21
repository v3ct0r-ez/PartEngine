import { lookupAcronym } from '@/lib/glossary';
import { Fragment, type ReactNode } from 'react';

/**
 * The classic "?" help bubble: a small circle that shows the meaning of an
 * acronym on hover/focus. The tooltip is a custom bubble centred horizontally
 * above the dot (the native `title` tooltip can't be centred/styled).
 */
export function InfoDot({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span
      tabIndex={0}
      aria-label={text}
      role="img"
      className={`group relative ml-1 inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-muted-foreground/50 align-middle text-[9px] font-bold leading-none text-muted-foreground ${className}`}
    >
      ?
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 hidden w-56 max-w-[60vw] -translate-x-1/2 whitespace-normal rounded-md border border-border bg-background px-2.5 py-1.5 text-center text-[11px] font-normal normal-case leading-snug text-foreground shadow-lg group-hover:block group-focus:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}

/** Renders a label followed by an InfoDot when the label is a known acronym. */
export function AcronymLabel({ label, hint }: { label: string; hint?: string }) {
  const text = hint ?? lookupAcronym(label);
  return (
    <>
      {label}
      {text ? <InfoDot text={text} /> : null}
    </>
  );
}

// Tokens that look like acronyms: 2+ letters/digits, e.g. MPN, RDS(on), VDS, EEPROM.
const TOKEN = /([A-Za-z]{2,}(?:\([A-Za-z]+\))?)/g;

/**
 * Scans arbitrary text and appends an InfoDot after every word that is a known
 * acronym, so any label/heading/cell can get acronym help automatically.
 */
export function AutoAcronyms({ children }: { children: string }): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(children)) !== null) {
    const hint = lookupAcronym(m[0]);
    if (!hint) continue;
    if (m.index > last) parts.push(children.slice(last, m.index));
    parts.push(
      <Fragment key={m.index}>
        {m[0]}
        <InfoDot text={hint} />
      </Fragment>,
    );
    last = m.index + m[0].length;
  }
  if (parts.length === 0) return children;
  if (last < children.length) parts.push(children.slice(last));
  return <>{parts}</>;
}
