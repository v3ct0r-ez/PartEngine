'use client';

import {
  adminResetPassword,
  createUser,
  getMe,
  grantWarehouseAccess,
  listUsers,
  listWarehouses,
  setUserActive,
  setUserRole,
  type UserRole,
} from '@/lib/api';
import { promptDialog, toast } from '@/components/ui-dialogs';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

const ROLES: UserRole[] = ['SUPER_ADMIN', 'WAREHOUSE_MANAGER', 'TECHNICIAN', 'PURCHASING', 'VIEWER'];
const inp = 'rounded border border-border bg-background px-2 py-1.5 text-sm';

export default function UsersPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const isAdmin = me.data?.role === 'SUPER_ADMIN';

  const users = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: isAdmin });
  const warehouses = useQuery({ queryKey: ['warehouses'], queryFn: listWarehouses, enabled: isAdmin });
  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });

  // create user
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('TECHNICIAN');
  const create = useMutation({
    mutationFn: () => createUser({ email, fullName, password, role }),
    onSuccess: () => { setEmail(''); setFullName(''); setPassword(''); refresh(); },
  });

  // grant access
  const [userId, setUserId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [canWrite, setCanWrite] = useState(true);
  const grant = useMutation({
    mutationFn: () => grantWarehouseAccess({ userId, warehouseId, canWrite }),
    onSuccess: refresh,
  });

  // per-row admin actions
  const toggleActive = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) => setUserActive(v.id, v.isActive),
    onSuccess: refresh,
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const changeRole = useMutation({
    mutationFn: (v: { id: string; role: UserRole }) => setUserRole(v.id, v.role),
    onSuccess: refresh,
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const resetPw = useMutation({
    mutationFn: (v: { id: string; password: string }) => adminResetPassword(v.id, v.password),
    onSuccess: () => toast('Password reimpostata.'),
    onError: (e) => toast((e as Error).message, 'error'),
  });
  const doReset = async (id: string, email: string) => {
    const pw = await promptDialog(`Nuova password per ${email} (min 8 caratteri):`);
    if (pw == null) return;
    if (pw.length < 8) { toast('Minimo 8 caratteri', 'error'); return; }
    resetPw.mutate({ id, password: pw });
  };

  if (me.isLoading) return null;
  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Utenti & accessi</h1>
        <p className="text-sm text-muted-foreground">Sezione riservata al ruolo SUPER_ADMIN.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Utenti & accessi</h1>

      <form onSubmit={(e) => { e.preventDefault(); if (email && fullName && password.length >= 8) create.mutate(); }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
        <Field l="Email"><input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field l="Nome"><input className={inp} value={fullName} onChange={(e) => setFullName(e.target.value)} /></Field>
        <Field l="Password (min 8)"><input className={inp} type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <Field l="Ruolo"><select className={inp} value={role} onChange={(e) => setRole(e.target.value as UserRole)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
        <button type="submit" disabled={!email || !fullName || password.length < 8 || create.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">+ Crea utente</button>
        {create.isError && <span className="text-xs text-red-500">{(create.error as Error).message}</span>}
      </form>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2">Email</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">Ruolo</th><th className="px-3 py-2">Accessi magazzino</th><th className="px-3 py-2">Ultimo accesso</th><th className="px-3 py-2">Stato</th><th className="px-3 py-2">Azioni</th></tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className={`border-t border-border ${u.isActive ? '' : 'opacity-60'}`}>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.fullName}</td>
                <td className="px-3 py-2">
                  <select className={inp} value={u.role} disabled={u.id === me.data?.id}
                    onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value as UserRole })}>
                    {ROLES.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-xs">
                  {u.role === 'SUPER_ADMIN' || u.role === 'WAREHOUSE_MANAGER'
                    ? 'Tutti (globale)'
                    : u.access.length
                      ? u.access.map((a) => `${a.warehouse}${a.canWrite ? ' (scrittura)' : ' (lettura)'}`).join(', ')
                      : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'mai'}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {u.isActive ? 'Attivo' : 'Disattivo'}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                      disabled={u.id === me.data?.id}
                      className="rounded border border-border px-2 py-1 hover:bg-muted disabled:opacity-40">
                      {u.isActive ? 'Disattiva' : 'Attiva'}
                    </button>
                    <button onClick={() => doReset(u.id, u.email)}
                      className="rounded border border-border px-2 py-1 hover:bg-muted">
                      Reimposta password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (userId && warehouseId) grant.mutate(); }}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
        <h2 className="w-full text-sm font-semibold">Concedi accesso a un magazzino</h2>
        <Field l="Utente">
          <select className={inp} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">—</option>
            {users.data?.filter((u) => u.role !== 'SUPER_ADMIN' && u.role !== 'WAREHOUSE_MANAGER').map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
          </select>
        </Field>
        <Field l="Magazzino">
          <select className={inp} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">—</option>
            {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={canWrite} onChange={(e) => setCanWrite(e.target.checked)} /> scrittura</label>
        <button type="submit" disabled={!userId || !warehouseId || grant.isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Concedi</button>
        {grant.isError && <span className="text-xs text-red-500">{(grant.error as Error).message}</span>}
        <p className="w-full text-xs text-muted-foreground">SUPER_ADMIN e Responsabile Magazzino hanno accesso globale; gli altri ruoli necessitano di un accesso esplicito.</p>
      </form>
    </div>
  );
}

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{l}</span>{children}</label>;
}
