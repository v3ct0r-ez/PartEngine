'use client';

import { logout } from '@/lib/api';

export function LogoutButton() {
  return (
    <button
      onClick={() => logout()}
      className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      Esci
    </button>
  );
}
