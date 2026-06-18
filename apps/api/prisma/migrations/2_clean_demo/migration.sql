-- Remove the first-run demo data (demo resistors + the "Lab principale"
-- warehouse) so the catalog ships clean. Cascades take care of the demo
-- stock levels, parameter values and locations. Taxonomy/categories are kept.
DELETE FROM "Component" WHERE 'demo' = ANY("tags");
DELETE FROM "Warehouse" WHERE "code" = 'WH1' AND "name" = 'Lab principale';
