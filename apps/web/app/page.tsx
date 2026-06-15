/** Dashboard placeholder with the KPI tiles described in the spec (wired in Sprint 8). */
const KPIS = [
  { label: 'Componenti totali', value: '—' },
  { label: 'Valore magazzino', value: '—' },
  { label: 'Componenti critici', value: '—' },
  { label: 'Rotazione magazzino', value: '—' },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="rounded-lg border border-border p-4">
            <div className="text-xs uppercase text-muted-foreground">{k.label}</div>
            <div className="mt-2 text-2xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Vai a <a className="text-primary underline" href="/components">Componenti</a> per la
        ricerca intelligente e i filtri avanzati.
      </p>
    </div>
  );
}
