'use client';

import type { DesktopPrinter, DesktopSettings } from '@/types/partengine';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [data, setData] = useState<DesktopSettings | null>(null);
  const [printers, setPrinters] = useState<DesktopPrinter[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const desktop = typeof window !== 'undefined' && !!window.partengine?.isDesktop;
    setIsDesktop(desktop);
    if (desktop) {
      window.partengine!.settings.get().then(setData);
      window.partengine!.print?.listPrinters?.().then(setPrinters).catch(() => {});
    }
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
  async function savePrinter(name: string) {
    await b.save({ printerName: name });
    setData(await b.get());
  }
  async function saveAi(patch: { aiApiKey?: string; aiModel?: string; aiBaseUrl?: string }) {
    await b.save(patch);
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Stampante etichette</div>
            <div className="mt-1 text-xs text-muted-foreground">Usata per la stampa diretta (senza finestra di sistema) delle etichette 50×30 mm.</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <select
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              value={data.settings.printerName ?? ''}
              onChange={(e) => savePrinter(e.target.value)}
            >
              <option value="">Predefinita di sistema</option>
              {printers.map((p) => (
                <option key={p.name} value={p.name}>{p.displayName || p.name}{p.isDefault ? ' (predefinita)' : ''}</option>
              ))}
            </select>
            <button onClick={() => window.partengine!.print.listPrinters().then(setPrinters)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted" title="Aggiorna elenco">↻</button>
          </div>
        </div>
        {printers.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Nessuna stampante rilevata. Collegane una e premi ↻.</p>}
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="mb-1 text-sm font-semibold">Estrazione AI dei parametri (datasheet)</div>
        <p className="mb-2 text-xs text-muted-foreground">
          Usa un LLM via endpoint OpenAI-compatibile per estrarre i parametri dal datasheet (pulsante &quot;Estrai con AI&quot; nell&apos;editor).
          Predefinito: <span className="font-mono">Google Gemini</span> (piano gratuito).
        </p>
        <div className="mb-3 rounded-md border border-border bg-muted/30 p-3">
          <div className="mb-1 text-xs font-semibold">Come ottenere la API key gratuita (Google Gemini)</div>
          <ol className="ml-4 list-decimal space-y-0.5 text-[11px] text-muted-foreground">
            <li>Apri <span className="font-mono">aistudio.google.com/apikey</span> e accedi con un account Google.</li>
            <li>Clicca <span className="font-medium">&quot;Create API key&quot;</span> (Crea chiave API).</li>
            <li>Copia la chiave generata (inizia con <span className="font-mono">AIza…</span>).</li>
            <li>Incollala nel campo <span className="font-medium">API key</span> qui sotto. Fatto!</li>
          </ol>
          <button
            type="button"
            onClick={() => window.partengine?.openExternal?.('https://aistudio.google.com/apikey')}
            className="mt-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Apri Google AI Studio ↗
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">Il piano gratuito ha limiti di quota; i datasheet inviati sono di norma pubblici.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2"><span className="text-xs text-muted-foreground">API key</span>
            <input type="password" className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder="AIza…"
              defaultValue={data.settings.aiApiKey ?? ''} onBlur={(e) => { if (e.target.value !== (data!.settings.aiApiKey ?? '')) saveAi({ aiApiKey: e.target.value }); }} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Modello</span>
            <input list="ai-models" className="rounded-md border border-border bg-background px-3 py-1.5 text-sm" placeholder="gemini-2.5-flash-lite"
              defaultValue={data.settings.aiModel ?? ''} onBlur={(e) => { if (e.target.value !== (data!.settings.aiModel ?? '')) saveAi({ aiModel: e.target.value }); }} />
            <datalist id="ai-models">
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (quota gratuita più alta)</option>
              <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash-Lite</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            </datalist></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">Endpoint (OpenAI-compatibile)</span>
            <input className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono text-xs" placeholder="https://generativelanguage.googleapis.com/v1beta/openai"
              defaultValue={data.settings.aiBaseUrl ?? ''} onBlur={(e) => { if (e.target.value !== (data!.settings.aiBaseUrl ?? '')) saveAi({ aiBaseUrl: e.target.value }); }} /></label>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Lasciando Modello/Endpoint vuoti si usa <span className="font-mono">gemini-2.5-flash-lite</span> (quota gratuita più alta). Se ottieni errori di quota (429), scegli un modello <span className="font-medium">Flash-Lite</span> o attendi qualche minuto. Per altri provider (Groq, OpenRouter…) imposta endpoint e modello corrispondenti.</p>
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
