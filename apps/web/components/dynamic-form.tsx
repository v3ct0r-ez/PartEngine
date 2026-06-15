'use client';

import {
  getCategoryTemplate,
  validateParameters,
  type FieldTemplate,
} from '@partengine/core';
import { useMemo, useState } from 'react';

/**
 * Dynamic form: renders only the parameters relevant to the chosen category,
 * from the data-driven field templates. Client-side validation reuses the exact
 * same `validateParameters` logic the API runs, so feedback is instant and
 * consistent. Changing the category swaps the field set with zero extra code.
 */
export function DynamicForm({
  categorySlug,
  initial = {},
  onSubmit,
}: {
  categorySlug: string;
  initial?: Record<string, unknown>;
  onSubmit?: (params: Record<string, unknown>) => void;
}) {
  const template = getCategoryTemplate(categorySlug);
  const fields = template?.fields ?? [];
  const [values, setValues] = useState<Record<string, unknown>>(initial);

  const errors = useMemo(() => {
    const list = validateParameters(fields, values);
    return Object.fromEntries(list.map((e) => [e.field, e.message]));
  }, [fields, values]);

  const set = (key: string, value: unknown) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (Object.keys(errors).length === 0) onSubmit?.(values);
      }}
      className="grid grid-cols-2 gap-4"
    >
      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label className="text-sm font-medium">
            {f.label}
            {f.required && <span className="text-red-500"> *</span>}
            {f.unit && f.type === 'QUANTITY' && (
              <span className="ml-1 text-xs text-muted-foreground">({f.unit})</span>
            )}
          </label>
          <FieldInput field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} />
          {errors[f.key] && <span className="text-xs text-red-500">{errors[f.key]}</span>}
        </div>
      ))}
      <div className="col-span-2">
        <button
          type="submit"
          disabled={Object.keys(errors).length > 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Salva
        </button>
      </div>
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldTemplate;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const base = 'rounded border border-border bg-background px-2 py-1.5 text-sm';
  switch (field.type) {
    case 'BOOLEAN':
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="h-5 w-5"
        />
      );
    case 'ENUM':
      return (
        <select className={base} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case 'QUANTITY':
      // Free text so engineers can type "4.7k", "100nF"; parsed/validated downstream.
      return (
        <input
          className={base}
          placeholder={field.unit ? `es. 4.7k${field.unit}` : ''}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <input
          className={base}
          type={field.type === 'NUMBER' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}
