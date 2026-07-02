'use client';

/**
 * In-app, non-blocking replacements for window.alert / confirm / prompt.
 *
 * The native dialogs block the renderer and, in the Electron shell, can leave
 * the window without keyboard focus afterwards (inputs become "dead" until the
 * app is restarted). These imperative helpers drive a small modal/toast host
 * mounted once at the app root instead, so they never block or steal focus.
 *
 *   toast('Salvato')                         // transient notification
 *   if (await confirmDialog('Eliminare?'))   // returns Promise<boolean>
 *   const v = await promptDialog('Nome?')    // returns Promise<string|null>
 */
import { playSound } from '@/lib/sound';
import { useState } from 'react';
import { create } from 'zustand';

type Toast = { id: number; message: string; kind: 'info' | 'error' };
type Dialog = {
  id: number;
  type: 'confirm' | 'prompt';
  message: string;
  defaultValue: string;
  resolve: (value: boolean | string | null) => void;
};

interface DialogStore {
  toasts: Toast[];
  dialog: Dialog | null;
  push: (message: string, kind: Toast['kind']) => void;
  dismiss: (id: number) => void;
  open: (d: Omit<Dialog, 'id'>) => void;
  close: () => void;
}

let seq = 1;

const useStore = create<DialogStore>((set) => ({
  toasts: [],
  dialog: null,
  push: (message, kind) => {
    const id = seq++;
    playSound(kind === 'error' ? 'error' : 'success');
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  open: (d) => set({ dialog: { ...d, id: seq++ } }),
  close: () => set({ dialog: null }),
}));

export function toast(message: string, kind: 'info' | 'error' = 'info') {
  useStore.getState().push(message, kind);
}

export function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    useStore.getState().open({
      type: 'confirm',
      message,
      defaultValue: '',
      resolve: (v) => resolve(v === true),
    });
  });
}

export function promptDialog(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    useStore.getState().open({
      type: 'prompt',
      message,
      defaultValue,
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    });
  });
}

export function DialogHost() {
  const { toasts, dialog, dismiss } = useStore();
  return (
    <>
      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto cursor-pointer rounded-lg border px-4 py-2 text-sm shadow-lg ${
              t.kind === 'error'
                ? 'border-red-300 bg-red-50 text-red-800'
                : 'border-border bg-background text-foreground'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
      {dialog && <DialogModal key={dialog.id} dialog={dialog} />}
    </>
  );
}

function DialogModal({ dialog }: { dialog: Dialog }) {
  const close = useStore((s) => s.close);
  return (
    <PromptForm
      dialog={dialog}
      onDone={(value) => {
        dialog.resolve(value);
        close();
      }}
    />
  );
}

function PromptForm({
  dialog,
  onDone,
}: {
  dialog: Dialog;
  onDone: (value: boolean | string | null) => void;
}) {
  const [value, setValue] = useState(dialog.defaultValue);
  const isPrompt = dialog.type === 'prompt';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => onDone(isPrompt ? null : false)}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onDone(isPrompt ? value : true);
        }}
        className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-background p-6 shadow-xl"
      >
        <p className="text-sm">{dialog.message}</p>
        {isPrompt && (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onDone(isPrompt ? null : false)}
            className="rounded-md border border-border px-4 py-2 text-sm"
          >
            Annulla
          </button>
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            {isPrompt ? 'OK' : 'Conferma'}
          </button>
        </div>
      </form>
    </div>
  );
}
