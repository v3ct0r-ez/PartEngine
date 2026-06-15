/**
 * Validation + indexed-projection for dynamic component parameters.
 *
 * `validateParameters` checks a parameters object against a category's field
 * definitions (required, type, range). `projectParameters` converts the same
 * object into normalized rows for the `ComponentParameterValue` table, storing
 * QUANTITY values as their base-SI magnitude so range filters and unit-aware
 * sorting use a B-tree index.
 */
import type { FieldTemplate } from './category-fields.js';
import { parseQuantity } from './units.js';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateParameters(
  fields: readonly FieldTemplate[],
  params: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of fields) {
    const value = params[field.key];
    const empty = value === undefined || value === null || value === '';

    if (field.required && empty) {
      errors.push({ field: field.key, message: `${field.label} è obbligatorio` });
      continue;
    }
    if (empty) continue;

    switch (field.type) {
      case 'QUANTITY': {
        const q = parseQuantity(String(value), field.unit);
        if (!q) {
          errors.push({ field: field.key, message: `${field.label}: valore non valido` });
          break;
        }
        const { min, max } = field.validation ?? {};
        if (min != null && q.magnitude < min)
          errors.push({ field: field.key, message: `${field.label}: minimo ${min}` });
        if (max != null && q.magnitude > max)
          errors.push({ field: field.key, message: `${field.label}: massimo ${max}` });
        break;
      }
      case 'NUMBER': {
        const n = Number(value);
        if (Number.isNaN(n))
          errors.push({ field: field.key, message: `${field.label}: deve essere numerico` });
        break;
      }
      case 'ENUM': {
        if (field.options && !field.options.includes(String(value)))
          errors.push({ field: field.key, message: `${field.label}: valore non ammesso` });
        break;
      }
      case 'BOOLEAN': {
        if (typeof value !== 'boolean')
          errors.push({ field: field.key, message: `${field.label}: deve essere vero/falso` });
        break;
      }
      case 'STRING':
      case 'TEXT': {
        const regex = field.validation?.regex;
        if (regex && !new RegExp(regex).test(String(value)))
          errors.push({ field: field.key, message: `${field.label}: formato non valido` });
        break;
      }
      default:
        break;
    }
  }

  return errors;
}

export interface ProjectedValue {
  fieldKey: string;
  numeric: number | null;
  text: string | null;
  boolean: boolean | null;
}

/** Flatten a parameters object into indexed-table rows. */
export function projectParameters(
  fields: readonly FieldTemplate[],
  params: Record<string, unknown>,
): ProjectedValue[] {
  const rows: ProjectedValue[] = [];
  for (const field of fields) {
    const value = params[field.key];
    if (value === undefined || value === null || value === '') continue;

    if (field.type === 'QUANTITY' || field.type === 'NUMBER') {
      const q = field.type === 'QUANTITY' ? parseQuantity(String(value), field.unit) : null;
      const numeric = field.type === 'QUANTITY' ? (q ? q.magnitude : null) : Number(value);
      rows.push({ fieldKey: field.key, numeric, text: null, boolean: null });
    } else if (field.type === 'BOOLEAN') {
      rows.push({ fieldKey: field.key, numeric: null, text: null, boolean: Boolean(value) });
    } else {
      rows.push({ fieldKey: field.key, numeric: null, text: String(value), boolean: null });
    }
  }
  return rows;
}
