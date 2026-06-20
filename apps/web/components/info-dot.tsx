/**
 * The classic "?" help bubble: a small circle showing the meaning of an acronym
 * on hover/focus (native tooltip — reliable, no clipping inside tables/modals).
 */
export function InfoDot({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      role="img"
      tabIndex={0}
      className={`ml-1 inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full border border-muted-foreground/50 align-middle text-[9px] font-bold leading-none text-muted-foreground ${className}`}
    >
      ?
    </span>
  );
}

/** Renders a label followed by an InfoDot when the label is a known acronym. */
export function AcronymLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <>
      {label}
      {hint ? <InfoDot text={hint} /> : null}
    </>
  );
}
