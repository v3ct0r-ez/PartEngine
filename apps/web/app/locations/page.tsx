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
  type WarehouseWithLocations,
} from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

const KIND_LABEL: Record<LocationKind, string> = {
  zone: 'Zona',
  shelf: 'Scaffale',
  cabinet: 'Armadio',
  drawer: 'Cassetto',
  box: 'Contenitore',
};
const KINDS: LocationKind[] = ['zone', 'shelf', 'cabinet', 'drawer', 'box'];
const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';

type LocModal =
  | { mode: 'create'; parentId?: string; defaultKind: LocationKind }
  | { mode: 'edit'; node: LocationNode };
type WhModal = { mode: 'create' } | { mode: 'edit'; wh: WarehouseWithLocations };

export default function LocationsPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const canWrite = me.data?.role === 'SUPER_ADMIN' || me.data?.role === 'WAREHOUSE_MANAGER';

  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = warehouses.data?.find((w) => w.id === selectedId) ?? null;

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

  const [whModal, setWhModal] = useState<WhModal | null>(null);
  const [locModal, setLocModal] = useState<LocModal | null>(null);

  const delWh = useMutation({
    mutationFn: (id: string) => deleteWarehouse(id),
    onSuccess: () => { setSelectedId(null); refreshWarehouses(); },
    onError: (e) => alert((e as Error).message),
  });
  const delLoc = useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: () => { refreshTree(); refreshWarehouses(); },
    onError: (e) => alert((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ubicazioni</h1>
        {!canWrite && <span className="text-xs text-muted-foreground">Sola lettura (serve ruolo Responsabile Magazzino)</span>}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]">
        {/* Warehouses column */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">Magazzini</h2>
            {canWrite && (
              <button onClick={() => setWhModal({ mode: 'create' })} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">+ Nuovo</button>
            )}
          </div>
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
                    <button onClick={() => setWhModal({ mode: 'edit', wh: w })} title="Modifica" className="rounded px-1 text-xs hover:bg-muted">✎</button>
                    <button onClick={() => { if (confirm(`Eliminare il magazzino "${w.name}"?`)) delWh.mutate(w.id); }} title="Elimina" className="rounded px-1 text-xs text-red-600 hover:bg-muted">🗑</button>
                  </div>
                )}
              </div>
            ))}
            {warehouses.data?.length === 0 && <p className="text-xs text-muted-foreground">Nessun magazzino.</p>}
          </div>
        </section>

        {/* Location tree */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">
              Struttura {selected ? `· ${selected.name}` : ''}
            </h2>
            {canWrite && selected && (
              <button onClick={() => setLocModal({ mode: 'create', defaultKind: 'zone' })} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">+ Ubicazione radice</button>
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
                  onAddChild={(parentId) => setLocModal({ mode: 'create', parentId, defaultKind: 'shelf' })}
                  onEdit={(node) => setLocModal({ mode: 'edit', node })}
                  onDelete={(id, code) => { if (confirm(`Eliminare l'ubicazione "${code}"?`)) delLoc.mutate(id); }}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      {whModal && (
        <WarehouseModal
          modal={whModal}
          onClose={() => setWhModal(null)}
          onSaved={(w) => { refreshWarehouses(); if (w) setSelectedId(w.id); setWhModal(null); }}
        />
      )}
      {locModal && selectedId && (
        <LocationModal
          modal={locModal}
          warehouseId={selectedId}
          onClose={() => setLocModal(null)}
          onSaved={() => { refreshTree(); refreshWarehouses(); setLocModal(null); }}
        />
      )}
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
  onEdit: (node: LocationNode) => void;
  onDelete: (id: string, code: string) => void;
}) {
  return (
    <li>
      <div
        className="flex items-center justify-between rounded-md border border-border px-3 py-1.5"
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono">{node.code}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{KIND_LABEL[node.kind as LocationKind] ?? node.kind}</span>
          {node.barcode && <span className="text-[11px] text-muted-foreground">⌗ {node.barcode}</span>}
        </div>
        {canWrite && (
          <div className="flex gap-1 text-xs">
            <button onClick={() => onAddChild(node.id)} title="Aggiungi sotto-ubicazione" className="rounded px-1 hover:bg-muted">＋</button>
            <button onClick={() => onEdit(node)} title="Modifica" className="rounded px-1 hover:bg-muted">✎</button>
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

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-background p-6 shadow-xl">
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function WarehouseModal({
  modal,
  onClose,
  onSaved,
}: {
  modal: WhModal;
  onClose: () => void;
  onSaved: (w?: WarehouseWithLocations) => void;
}) {
  const existing = modal.mode === 'edit' ? modal.wh : null;
  const [code, setCode] = useState(existing?.code ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');

  const save = useMutation({
    mutationFn: () =>
      existing
        ? updateWarehouse(existing.id, { code, name, address: address || undefined })
        : createWarehouse({ code, name, address: address || undefined }),
    onSuccess: (w) => onSaved(w),
    onError: (e) => alert((e as Error).message),
  });

  return (
    <Modal title={existing ? 'Modifica magazzino' : 'Nuovo magazzino'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (code && name) save.mutate(); }} className="space-y-3">
        <input className={`${inp} w-full`} placeholder="Codice (es. WH1)" value={code} onChange={(e) => setCode(e.target.value)} />
        <input className={`${inp} w-full`} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={`${inp} w-full`} placeholder="Indirizzo (opzionale)" value={address ?? ''} onChange={(e) => setAddress(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Annulla</button>
          <button type="submit" disabled={!code || !name || save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {save.isPending ? '…' : 'Salva'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function LocationModal({
  modal,
  warehouseId,
  onClose,
  onSaved,
}: {
  modal: LocModal;
  warehouseId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const existing = modal.mode === 'edit' ? modal.node : null;
  const [code, setCode] = useState(existing?.code ?? '');
  const [kind, setKind] = useState<LocationKind>(
    existing ? (existing.kind as LocationKind) : modal.mode === 'create' ? modal.defaultKind : 'zone',
  );
  const [barcode, setBarcode] = useState(existing?.barcode ?? '');

  const save = useMutation({
    mutationFn: () =>
      existing
        ? updateLocation(existing.id, { code, kind, barcode: barcode || undefined })
        : createLocation({
            warehouseId,
            code,
            kind,
            barcode: barcode || undefined,
            parentId: modal.mode === 'create' ? modal.parentId : undefined,
          }),
    onSuccess: onSaved,
    onError: (e) => alert((e as Error).message),
  });

  const title = existing
    ? 'Modifica ubicazione'
    : modal.mode === 'create' && modal.parentId
      ? 'Nuova sotto-ubicazione'
      : 'Nuova ubicazione';

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (code) save.mutate(); }} className="space-y-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Codice</span>
          <input className={`${inp} w-full`} placeholder="es. A-01-3" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Tipo</span>
          <select className={`${inp} w-full`} value={kind} onChange={(e) => setKind(e.target.value as LocationKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Barcode (opzionale)</span>
          <input className={`${inp} w-full`} placeholder="codice a barre" value={barcode ?? ''} onChange={(e) => setBarcode(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Annulla</button>
          <button type="submit" disabled={!code || save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {save.isPending ? '…' : 'Salva'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
