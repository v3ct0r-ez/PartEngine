# Data-driven dynamic fields & forms

## Goal

An administrator must be able to create new component categories and define their technical
parameters **without writing code** (spec: *"senza scrivere codice"*), and the UI must show
**only the relevant fields** for the selected category.

## Model

```
Category ──< CategoryField ──< ComponentParameterValue >── Component
                 │                                            │
                 │ describes (type, unit, options,            │ stores values in
                 │  validation, required, default)            │ parameters JSONB
```

- **`CategoryField`** is the registry: `{ key, label, type, unit, options, required, defaultValue, validation, isFilterable, isSortable }`. Built-in defaults ship in `packages/core/src/category-fields.ts` and are seeded; admins add more at runtime.
- **`Component.parameters`** (JSONB) holds the actual values — schemaless, so any field set works.
- **`ComponentParameterValue`** is the *indexed projection*: every filterable/sortable field is flattened into a row with `numeric` stored in the **base SI unit** (Ω, F, H…). This is what range filters and unit-aware sorting query, hitting `@@index([fieldKey, numeric])` instead of scanning JSONB.

## Write path

```
client submits parameters ─▶ validateParameters(fields, params)   // packages/core
                          ─▶ save Component.parameters (JSONB)
                          ─▶ projectParameters(fields, params)     // → base-SI rows
                          ─▶ upsert ComponentParameterValue rows
                          ─▶ AuditLog entry (old/new)
```

`validateParameters` and `projectParameters` live in `@partengine/core` and are unit-tested,
so the same rules run on the server and (for instant feedback) the client.

## Field types

`STRING · TEXT · NUMBER · QUANTITY · BOOLEAN · ENUM · DATE`

`QUANTITY` is the special one: its value is parsed with the engineering-unit parser and stored
as a base-SI magnitude, which is what makes `100Ω < 1kΩ < 1MΩ` sort and filter correctly.

## Form rendering

The web `DynamicForm` component (`apps/web/components/dynamic-form.tsx`) renders inputs from the
`CategoryField[]` of the chosen category: `ENUM → Select`, `BOOLEAN → Switch`,
`QUANTITY → unit-aware input`, etc. Changing the category swaps the field set with zero code.
