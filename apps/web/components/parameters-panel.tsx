'use client';

import { InfoDot } from '@/components/info-dot';
import type { Category, CategoryField, ComponentRow } from '@/lib/api';
import { lookupAcronym } from '@/lib/glossary';
import { formatEngineering, parseQuantity } from '@partengine/core';

/** Human-readable value for a parameter, honouring its field type/unit. */
function formatValue(field: CategoryField, raw: unknown): string {
  if (raw == null || String(raw).trim() === '') return '—';
  if (field.type === 'QUANTITY' && field.unit) {
    const q = parseQuantity(String(raw), field.unit);
    return q && Number.isFinite(q.magnitude) ? formatEngineering(q.magnitude, field.unit) : String(raw);
  }
  if (field.type === 'BOOLEAN') return raw === true || raw === 'true' ? 'Sì' : 'No';
  return String(raw);
}

/**
 * Read-only list of a component's technical parameters (the per-category fields
 * + the stored values), so they're visible on the component card without opening
 * the editor.
 */
export function ParametersPanel({
  component,
  categories,
}: {
  component: ComponentRow;
  categories: Category[];
}) {
  const category = categories.find((c) => c.slug === component.category?.slug);
  const fields = category?.fields ?? [];
  const params = component.parameters ?? {};
  const rows = fields.filter((f) => {
    const v = params[f.key];
    return v != null && String(v).trim() !== '';
  });

  return (
    <section className="rounded-lg border border-border p-4">
      <h3 className="mb-3 font-semibold">Parametri</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessun parametro impostato. Usa “Modifica componente” per aggiungerli.
        </p>
      ) : (
        <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {rows.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5 text-sm">
              <dt className="text-muted-foreground">{f.label}{(() => { const h = lookupAcronym(f.label); return h ? <InfoDot text={h} /> : null; })()}</dt>
              <dd className="font-medium">{formatValue(f, params[f.key])}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
