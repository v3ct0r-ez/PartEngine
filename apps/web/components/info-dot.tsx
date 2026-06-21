import { lookupAcronym } from '@/lib/glossary';
import { type ReactNode } from 'react';

/**
 * The classic "?" help bubble: a small circle showing the meaning of an acronym
 * on hover/focus (native tooltip — reliable, no clipping inside tables/modals).
 *
 * Keep this purely the dot: pair it with an acronym via <AcronymPair> (or the
 * helpers below) so the dot stays vertically centred with the text.
 */
export function InfoDot({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      role="img"
      tabIndex={0}
      className={`inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-muted-foreground/50 text-[9px] font-bold leading-none text-muted-foreground ${className}`}
    >
      ?
    </span>
  );
}

/** An acronym (or any text) followed by a help dot, vertically centred together. */
function AcronymPair({ label, hint }: { label: ReactNode; hint: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      {label}
      <InfoDot text={hint} />
    </span>
  );
}

/** Renders a label followed by an InfoDot when the label is a known acronym. */
export function AcronymLabel({ label, hint }: { label: string; hint?: string }) {
  const text = hint ?? lookupAcronym(label);
  return text ? <AcronymPair label={label} hint={text} /> : <>{label}</>;
}

// Tokens that look like acronyms: 2+ letters, optionally with a (suffix), e.g.
// MPN, RDS(on), VDS, EEPROM.
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
    parts.push(<AcronymPair key={m.index} label={m[0]} hint={hint} />);
    last = m.index + m[0].length;
  }
  if (parts.length === 0) return children;
  if (last < children.length) parts.push(children.slice(last));
  return <>{parts}</>;
}
