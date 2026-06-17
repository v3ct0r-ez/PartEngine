'use client';

import { ComponentSearch } from '@/components/component-search';
import { WarehouseOperations } from '@/components/warehouse-operations';
import type { ComponentRow } from '@/lib/api';
import { useState } from 'react';

/**
 * Quick warehouse operations by component search. The primary flow now lives in
 * the unified Components page (select a component → warehouse tab); this remains
 * as a direct shortcut.
 */
export default function InventoryPage() {
  const [component, setComponent] = useState<ComponentRow | null>(null);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Magazzino — Operazioni rapide</h1>
      {component ? (
        <>
          <div className="flex items-center gap-3 rounded-lg border border-border p-3">
            <span className="font-mono text-xs">{component.internalCode}</span>
            <span className="font-medium">{component.name}</span>
            <button onClick={() => setComponent(null)} className="ml-auto text-sm text-primary hover:underline">Cambia</button>
          </div>
          <WarehouseOperations componentId={component.id} />
        </>
      ) : (
        <div className="max-w-xl">
          <ComponentSearch onPick={setComponent} placeholder="Cerca un componente per operare…" />
        </div>
      )}
    </div>
  );
}
