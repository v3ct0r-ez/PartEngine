# Entity-Relationship Diagram

Generated from `apps/api/prisma/schema.prisma`. Rendered with Mermaid.

```mermaid
erDiagram
    User ||--o| UserPreference : has
    User ||--o{ SavedView : owns
    User ||--o{ RecentItem : owns
    User ||--o{ RefreshToken : has
    User ||--o{ AuditLog : performs
    User ||--o{ StockMovement : records
    User ||--o{ WarehouseAccess : granted

    Category ||--o{ Category : parent
    Category ||--o{ CategoryField : defines
    Category ||--o{ Component : classifies

    Component ||--o{ ComponentParameterValue : projects
    CategoryField ||--o{ ComponentParameterValue : describes
    Component }o--o| Manufacturer : made_by
    Component ||--o{ Attachment : has
    Component ||--o{ SupplierPart : sourced_by
    Component ||--o{ StockLevel : stocked
    Component ||--o{ StockMovement : moves
    Component ||--o{ BomLine : used_in
    Component ||--o{ KitLine : used_in

    Supplier ||--o{ SupplierPart : offers
    Supplier ||--o{ PurchaseOrder : receives
    PurchaseOrder ||--o{ PurchaseOrderLine : contains

    Warehouse ||--o{ Location : contains
    Warehouse ||--o{ WarehouseAccess : controls
    Location ||--o{ Location : parent
    Location ||--o{ StockLevel : holds

    Bom ||--o{ BomLine : contains
    Kit ||--o{ KitLine : contains
```

## Key modelling decisions

- **Component.parameters (JSONB) + ComponentParameterValue (indexed projection)** —
  flexible per-category fields *and* fast range/sort. See [`DYNAMIC_FIELDS.md`](DYNAMIC_FIELDS.md).
- **StockLevel is authoritative per (component, location)**; the roll-up min/max/ideal
  live on `Component`. **StockMovement is an immutable ledger** — quantities are always
  derived from / reconciled against it.
- **AuditLog** stores `oldValue`/`newValue`/`reason`/`ip` for every mutation and is never
  updated or deleted (append-only, partitioned by month in production).
- **Location is a tree** (`zone → shelf → cabinet → drawer → box`) via a self-relation, so
  arbitrarily deep physical layouts are supported without schema changes.
- **Soft delete** (`Component.deletedAt`) keeps history intact — nothing is truly lost.
```
