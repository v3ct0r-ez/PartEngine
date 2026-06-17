'use client';

import type { DesktopSettings } from '@/types/partengine';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [data, setData] = useState<DesktopSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const desktop = typeof window !== 'undefined' && !!window.partengine?.isDesktop;
    setIsDesktop(desktop);
    if (desktop) window.partengine!.settings.get().then(setData);
  }, []);

  if (isDesktop === null) return null;
  if (!isDesktop) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">
          La scelta dei percorsi (dati, allegati, backup) è disponibile solo nell'app desktop.
        </p>
      </div>
    );
  }
  if (!data) return null;
  const b = window.partengine!.settings;

  async function pick(key: 'dataDir' | 'storageDir' | 'backupDir') {
    const folder = await b.pickFolder();
    if (!folder) return;
    await b.save({ [key]: folder });
    setSaved(true);
    setData(await b.get());
  }
  async function clear(key: 'backupDir') {
    await b.save({ [key]: '' });
    setData(await b.get());
  }

  const rows: { key: 'dataDir' | 'storageDir' | 'backupDir'; label: string; help: string; value: string; warn?: boolean }[] = [
    { key: 'dataDir', label: 'Cartella database', value: data.paths.dataDir,
      help: 'Cluster PostgreSQL. ⚠️ Tienila su disco LOCALE: su share di rete (NAS/SMB) rischi corruzione.', warn: true },
    { key: 'storageDir', label: 'Cartella allegati / datasheet', value: data.paths.storageDir,
      help: 'File (PDF, immagini). Può stare sul NAS senza problemi.' },
    { key: 'backupDir', label: 'Cartella backup', value: data.paths.backupDir || '(disattivati)',
      help: 'Backup automatico alla chiusura (copia a freddo del database). Ideale puntarla sul NAS.' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Impostazioni</h1>
      <p className="text-sm text-muted-foreground">Le modifiche ai percorsi richiedono il riavvio dell'app.</p>

      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.key} className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{r.label}</div>
                <div className="mt-1 break-all font-mono text-xs text-muted-foreground">{r.value}</div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button onClick={() => pick(r.key)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Sfoglia…</button>
                {r.key === 'backupDir' && data.paths.backupDir && (
                  <button onClick={() => clear('backupDir')} className="rounded-md border border-border px-3 py-1.5 text-sm">Disattiva</button>
                )}
              </div>
            </div>
            <p className={`mt-2 text-xs ${r.warn ? 'text-amber-600' : 'text-muted-foreground'}`}>{r.help}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Backup recenti {data.backupEnabled ? '' : '(disattivati)'}</h2>
          {data.paths.backupDir && (
            <button onClick={() => b.openPath(data.paths.backupDir)} className="text-xs text-primary hover:underline">Apri cartella</button>
          )}
        </div>
        <ul className="space-y-1 text-sm">
          {data.backups.map((bk) => (
            <li key={bk.name} className="flex justify-between border-b border-border py-1">
              <span className="font-mono text-xs">{bk.name}</span>
              <span className="text-xs text-muted-foreground">{new Date(bk.at).toLocaleString()}</span>
            </li>
          ))}
          {data.backups.length === 0 && <li className="text-xs text-muted-foreground">Nessun backup ancora (vengono creati alla chiusura).</li>}
        </ul>
      </div>

      {saved && <p className="text-sm text-amber-600">Impostazione salvata — riavvia PartEngine per applicarla.</p>}
      <p className="break-all text-xs text-muted-foreground">File di configurazione: {data.paths.configFile}</p>
    </div>
  );
}
