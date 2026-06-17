'use client';

import {
  createLocation,
  createWarehouse,
  deleteLocation,
  deleteWarehouse,
  getLocationTree,
  getMe,
  listWarehouses,
  updateLocation,
  updateWarehouse,
  type LocationKind,
  type LocationNode,
} from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

const KIND_LABEL: Record<string, string> = {
  zone: 'Zona',
  shelf: 'Scaffale',
  cabinet: 'Armadio',
  drawer: 'Cassetto',
  box: 'Contenitore',
};
const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';

export default function LocationsPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const canWrite = me.data?.role === 'SUPER_ADMIN' || me.data?.role === 'WAREHOUSE_MANAGER';

  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = warehouses.data?.find((w) => w.id === selectedId) ?? null;

  // Auto-select the first warehouse once loaded.
  useEffect(() => {
    if (!selectedId && warehouses.data?.length) setSelectedId(warehouses.data[0].id);
  }, [warehouses.data, selectedId]);

  const tree = useQuery({
    queryKey: ['location-tree', selectedId],
    queryFn: () => getLocationTree(selectedId!),
    enabled: !!selectedId,
  });

  const refreshWarehouses = () => qc.invalidateQueries({ queryKey: ['warehouses'] });
  const refreshTree = () => qc.invalidateQueries({ queryKey: ['location-tree', selectedId] });

  // create warehouse
  const [whCode, setWhCode] = useState('');
  const [whName, setWhName] = useState('');
  const createWh = useMutation({
    mutationFn: () => createWarehouse({ code: whCode, name: whName }),
    onSuccess: (w) => { setWhCode(''); setWhName(''); refreshWarehouses(); setSelectedId(w.id); },
    onError: (e) => alert((e as Error).message),
  });
  const delWh = useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: () => { setSelectedId(null); refreshWarehouses(); },
    onError: (e) => alert((e as Error).message),
  });
  const editWh = useMutation({
    mutationFn: (v: { id: string; code: string; name: string }) => updateWarehouse(v.id, { code: v.code, name: v.name }),
    onSuccess: refreshWarehouses,
    onError: (e) => alert((e as Error).message),
  });

  // location mutations
  const addLoc = useMutation({
    mutationFn: (v: { kind: LocationKind; code: string; parentId?: string }) =>
      createLocation({ warehouseId: selectedId!, ...v }),
    onSuccess: () => { refreshTree(); refreshWarehouses(); },
    onError: (e) => alert((e as Error).message),
  });
  const editLoc = useMutation({
    mutationFn: (v: { id: string; code: string; kind: LocationKind }) => updateLocation(v.id, { code: v.code, kind: v.kind }),
    onSuccess: refreshTree,
    onError: (e) => alert((e as Error).message),
  });
  const delLoc = useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: () => { refreshTree(); refreshWarehouses(); },
    onError: (e) => alert((e as Error).message),
  });

  function addRoot() {
    const code = window.prompt('Codice nuova ubicazione (es. A-01):');
    if (!code?.trim()) return;
    addLoc.mutate({ kind: 'zone', code: code.trim() });
  }
  function addChild(parentId: string) {
    const code = window.prompt('Codice sotto-ubicazione:');
    if (!code?.trim()) return;
    addLoc.mutate({ kind: 'shelf', code: code.trim(), parentId });
  }
  function renameWh(id: string, code: string, name: string) {
    const newName = window.prompt('Nome magazzino:', name);
    if (newName == null) return;
    const newCode = window.prompt('Codice magazzino:', code);
    if (newCode == null) return;
    editWh.mutate({ id, code: newCode.trim() || code, name: newName.trim() || name });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ubicazioni</h1>
        {!canWrite && <span className="text-xs text-muted-foreground">Sola lettura (serve ruolo Responsabile Magazzino)</span>}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        {/* Warehouses column */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Magazzini</h2>
          <div className="space-y-1">
            {warehouses.data?.map((w) => (
              <div
                key={w.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${selectedId === w.id ? 'border-primary bg-muted' : 'border-border'}`}
              >
                <button onClick={() => setSelectedId(w.id)} className="flex-1 text-left">
                  <div className="text-sm font-medium">{w.name}</div>
                  <div className="text-xs text-muted-foreground">{w.code} · {w._count?.locations ?? w.locations.length} ubicazioni</div>
                </button>
                {canWrite && (
                  <div className="flex gap-1">
                    <button onClick={() => renameWh(w.id, w.code, w.name)} title="Modifica" className="rounded px-1 text-xs hover:bg-muted">✎</button>
                    <button onClick={() => { if (confirm(`Eliminare il magazzino "${w.name}"?`)) delWh.mutate(w.id); }} title="Elimina" className="rounded px-1 text-xs text-red-600 hover:bg-muted">🗑</button>
                  </div>
                )}
              </div>
            ))}
            {warehouses.data?.length === 0 && <p className="text-xs text-muted-foreground">Nessun magazzino.</p>}
          </div>

          {canWrite && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (whCode && whName) createWh.mutate(); }}
              className="space-y-2 rounded-lg border border-border p-3"
            >
              <div className="text-xs font-semibold">Nuovo magazzino</div>
              <input className={`${inp} w-full`} placeholder="Codice (es. WH1)" value={whCode} onChange={(e) => setWhCode(e.target.value)} />
              <input className={`${inp} w-full`} placeholder="Nome" value={whName} onChange={(e) => setWhName(e.target.value)} />
              <button type="submit" disabled={!whCode || !whName || createWh.isPending}
                className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Crea</button>
            </form>
          )}
        </section>

        {/* Location tree */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">
              Struttura {selected ? `· ${selected.name}` : ''}
            </h2>
            {canWrite && selected && (
              <button onClick={addRoot} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">+ Ubicazione radice</button>
            )}
          </div>

          {!selected ? (
            <p className="text-sm text-muted-foreground">Seleziona un magazzino.</p>
          ) : tree.isLoading ? (
            <p className="text-sm text-muted-foreground">Caricamento…</p>
          ) : tree.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna ubicazione. Aggiungine una.</p>
          ) : (
            <ul className="space-y-1">
              {tree.data?.map((n) => (
                <LocationRow
                  key={n.id}
                  node={n}
                  depth={0}
                  canWrite={canWrite}
                  onAddChild={addChild}
                  onEdit={(id, code, kind) => editLoc.mutate({ id, code, kind })}
                  onDelete={(id, code) => { if (confirm(`Eliminare l'ubicazione "${code}"?`)) delLoc.mutate(id); }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function LocationRow({
  node,
  depth,
  canWrite,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: LocationNode;
  depth: number;
  canWrite: boolean;
  onAddChild: (parentId: string) => void;
  onEdit: (id: string, code: string, kind: LocationKind) => void;
  onDelete: (id: string, code: string) => void;
}) {
  function rename() {
    const code = window.prompt('Codice ubicazione:', node.code);
    if (code == null) return;
    onEdit(node.id, code.trim() || node.code, node.kind as LocationKind);
  }

  return (
    <li>
      <div
        className="flex items-center justify-between rounded-md border border-border px-3 py-1.5"
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono">{node.code}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{KIND_LABEL[node.kind] ?? node.kind}</span>
          {node.barcode && <span className="text-[11px] text-muted-foreground">⌗ {node.barcode}</span>}
        </div>
        {canWrite && (
          <div className="flex gap-1 text-xs">
            <button onClick={() => onAddChild(node.id)} title="Aggiungi sotto-ubicazione" className="rounded px-1 hover:bg-muted">＋</button>
            <button onClick={rename} title="Modifica" className="rounded px-1 hover:bg-muted">✎</button>
            <button onClick={() => onDelete(node.id, node.code)} title="Elimina" className="rounded px-1 text-red-600 hover:bg-muted">🗑</button>
          </div>
        )}
      </div>
      {node.children.length > 0 && (
        <ul className="mt-1 space-y-1">
          {node.children.map((c) => (
            <LocationRow key={c.id} node={c} depth={depth + 1} canWrite={canWrite} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </li>
  );
}
