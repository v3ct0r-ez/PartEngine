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
import { confirmDialog, toast } from '@/components/ui-dialogs';
import { LabelPreviewModal } from '@/components/label-preview';
import { QrIcon } from '@/components/label-button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

const KIND_LABEL: Record<LocationKind, string> = {
  zone: 'Zona',
  shelf: 'Scaffale',
  cabinet: 'Armadio',
  drawer: 'Cassetto',
  container: 'Contenitore',
  box: 'Slot',
};
// Kinds offered for a main location (a slot is always a "box").
const MAIN_KINDS: LocationKind[] = ['drawer', 'cabinet', 'shelf', 'container', 'zone'];
const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';

type LocModal =
  | { mode: 'create-main' }
  | { mode: 'create-slot'; parentId: string; parentCode: string }
  | { mode: 'edit'; node: LocationNode; isSlot: boolean };
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
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const delLoc = useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: () => { refreshTree(); refreshWarehouses(); },
    onError: (e) => toast((e as Error).message, 'error'),
  });

  // Single-site is the common case: auto-provision one warehouse so the user
  // never has to think about it, and keep multi-warehouse as an advanced option.
  const createDefault = useMutation({
    mutationFn: () => createWarehouse({ code: 'WH1', name: 'Magazzino principale' }),
    onSuccess: (w) => { refreshWarehouses(); setSelectedId(w.id); },
  });
  const autoTried = useRef(false);
  useEffect(() => {
    if (!autoTried.current && canWrite && warehouses.isSuccess && warehouses.data.length === 0) {
      autoTried.current = true;
      createDefault.mutate();
    }
  }, [warehouses.isSuccess, warehouses.data, canWrite]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hide the warehouses column when there's a single warehouse (the common case),
  // unless the user opens the advanced "Gestisci magazzini" panel.
  const count = warehouses.data?.length ?? 0;
  const [advanced, setAdvanced] = useState(false);
  const showWhColumn = count > 1 || advanced;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ubicazioni</h1>
        {!canWrite && <span className="text-xs text-muted-foreground">Sola lettura (serve ruolo Responsabile Magazzino)</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Ubicazione principale nel formato <span className="font-mono">A-01</span> (lettera + due cifre); al suo interno gli slot
        <span className="font-mono"> A-01-1</span>, <span className="font-mono">A-01-2</span>… dove l’ultima cifra è lo slot.
      </p>

      <div className={showWhColumn ? 'grid grid-cols-1 gap-6 md:grid-cols-[280px_1fr]' : ''}>
        {/* Warehouses column — shown only with multiple warehouses or in advanced mode */}
        {showWhColumn && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">Magazzini</h2>
            <div className="flex gap-1">
              {canWrite && (
                <button onClick={() => setWhModal({ mode: 'create' })} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">+ Nuovo</button>
              )}
              {count <= 1 && (
                <button onClick={() => setAdvanced(false)} className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Nascondi</button>
              )}
            </div>
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
                    <button onClick={() => setWhModal({ mode: 'edit', wh: w })} className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted">Modifica</button>
                    <button onClick={async () => { if (await confirmDialog(`Eliminare il magazzino "${w.name}"?`)) delWh.mutate(w.id); }} className="rounded border border-border px-2 py-0.5 text-xs text-red-600 hover:bg-muted">Elimina</button>
                  </div>
                )}
              </div>
            ))}
            {warehouses.data?.length === 0 && <p className="text-xs text-muted-foreground">Nessun magazzino.</p>}
          </div>
        </section>
        )}

        {/* Location tree */}
        <section className="max-w-4xl space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">
              Struttura {selected ? `· ${selected.name}` : ''}
            </h2>
            <div className="flex items-center gap-2">
              {!showWhColumn && (
                <button onClick={() => setAdvanced(true)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Gestisci magazzini</button>
              )}
              {canWrite && selected && (
                <button onClick={() => setLocModal({ mode: 'create-main' })} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">+ Ubicazione principale</button>
              )}
            </div>
          </div>

          {!selected ? (
            <p className="text-sm text-muted-foreground">Seleziona un magazzino.</p>
          ) : tree.isLoading ? (
            <p className="text-sm text-muted-foreground">Caricamento…</p>
          ) : tree.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna ubicazione. Aggiungine una principale (es. A-01).</p>
          ) : (
            <ul className="space-y-1">
              {tree.data?.map((n) => (
                <LocationRow
                  key={n.id}
                  node={n}
                  depth={0}
                  canWrite={canWrite}
                  onAddSlot={(parentId, parentCode) => setLocModal({ mode: 'create-slot', parentId, parentCode })}
                  onEdit={(node, isSlot) => setLocModal({ mode: 'edit', node, isSlot })}
                  onDelete={async (id, code) => { if (await confirmDialog(`Eliminare l'ubicazione "${code}"?`)) delLoc.mutate(id); }}
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
  onAddSlot,
  onEdit,
  onDelete,
}: {
  node: LocationNode;
  depth: number;
  canWrite: boolean;
  onAddSlot: (parentId: string, parentCode: string) => void;
  onEdit: (node: LocationNode, isSlot: boolean) => void;
  onDelete: (id: string, code: string) => void;
}) {
  const isSlot = depth > 0;
  const [labelOpen, setLabelOpen] = useState(false);
  return (
    <li>
      <div
        className="flex items-center justify-between rounded-md border border-border px-3 py-1.5"
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono">{node.code}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{isSlot ? 'Slot' : KIND_LABEL[node.kind as LocationKind] ?? node.kind}</span>
          {node.barcode && <span className="text-[11px] text-muted-foreground">Barcode: {node.barcode}</span>}
        </div>
        <div className="flex gap-1 text-xs">
          {/* Slots get a QR label; root locations get a text-only "A-01" label. */}
          {canWrite && !isSlot && (
            <button onClick={() => onAddSlot(node.id, node.code)} className="rounded border border-border px-2 py-0.5 hover:bg-muted">+ Slot</button>
          )}
          <button
            onClick={() => setLabelOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-border px-2 py-0.5 hover:bg-muted"
            title={isSlot ? 'Anteprima etichetta QR (50×30)' : 'Anteprima etichetta testo (50×30)'}
          >
            Etichetta
            <QrIcon />
          </button>
          {labelOpen && (
            <LabelPreviewModal
              spec={{ code: node.code, qr: isSlot, name: isSlot ? undefined : (KIND_LABEL[node.kind as LocationKind] ?? node.kind) }}
              onClose={() => setLabelOpen(false)}
            />
          )}
          {canWrite && (
            <>
              <button onClick={() => onEdit(node, isSlot)} className="rounded border border-border px-2 py-0.5 hover:bg-muted">Modifica</button>
              <button onClick={() => onDelete(node.id, node.code)} className="rounded border border-border px-2 py-0.5 text-red-600 hover:bg-muted">Elimina</button>
            </>
          )}
        </div>
      </div>
      {node.children.length > 0 && (
        <ul className="mt-1 space-y-1">
          {node.children.map((c) => (
            <LocationRow key={c.id} node={c} depth={depth + 1} canWrite={canWrite} onAddSlot={onAddSlot} onEdit={onEdit} onDelete={onDelete} />
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
    onError: (e) => toast((e as Error).message, 'error'),
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
  const isSlot = modal.mode === 'create-slot' || (modal.mode === 'edit' && modal.isSlot);
  const existing = modal.mode === 'edit' ? modal.node : null;

  const [code, setCode] = useState(existing && !isSlot ? existing.code : '');
  const [kind, setKind] = useState<LocationKind>(existing ? (existing.kind as LocationKind) : isSlot ? 'box' : 'drawer');
  const [slot, setSlot] = useState('');
  const [barcode, setBarcode] = useState(existing?.barcode ?? '');

  const save = useMutation({
    mutationFn: () => {
      if (modal.mode === 'edit') {
        return updateLocation(modal.node.id, isSlot ? { kind, barcode: barcode || undefined } : { code, kind, barcode: barcode || undefined });
      }
      if (modal.mode === 'create-slot') {
        return createLocation({
          warehouseId,
          parentId: modal.parentId,
          kind: 'box',
          slot: slot ? Number(slot) : undefined,
          barcode: barcode || undefined,
        });
      }
      // create-main
      return createLocation({ warehouseId, kind, code, barcode: barcode || undefined });
    },
    onSuccess: onSaved,
    onError: (e) => toast((e as Error).message, 'error'),
  });

  const title =
    modal.mode === 'create-slot'
      ? `Nuovo slot in ${modal.parentCode}`
      : modal.mode === 'edit'
        ? isSlot ? 'Modifica slot' : 'Modifica ubicazione'
        : 'Nuova ubicazione principale';

  const canSave = modal.mode === 'create-slot' || isSlot ? true : !!code;

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (canSave) save.mutate(); }} className="space-y-3">
        {modal.mode === 'create-slot' ? (
          <>
            <p className="text-xs text-muted-foreground">
              Il codice sarà <span className="font-mono">{modal.parentCode}-{slot || 'N'}</span>. Lascia vuoto per il prossimo slot disponibile.
            </p>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Numero slot (opzionale)</span>
              <input className={`${inp} w-full`} type="number" min={1} placeholder="auto" value={slot} onChange={(e) => setSlot(e.target.value)} autoFocus />
            </label>
          </>
        ) : isSlot ? (
          <p className="text-xs text-muted-foreground">
            Codice slot: <span className="font-mono">{existing?.code}</span> (non modificabile).
          </p>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Codice (formato A-01)</span>
              <input className={`${inp} w-full font-mono`} placeholder="A-01" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Tipo</span>
              <select className={`${inp} w-full`} value={kind} onChange={(e) => setKind(e.target.value as LocationKind)}>
                {MAIN_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </select>
            </label>
          </>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Barcode (opzionale)</span>
          <input className={`${inp} w-full`} placeholder="codice a barre" value={barcode ?? ''} onChange={(e) => setBarcode(e.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm">Annulla</button>
          <button type="submit" disabled={!canSave || save.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {save.isPending ? '…' : 'Salva'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
