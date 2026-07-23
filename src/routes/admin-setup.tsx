import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import type { AppRole } from "@/lib/authStore";

export const Route = createFileRoute("/admin-setup")({
  head: () => ({ meta: [{ title: "Configuration initiale — CAPI ERP" }] }),
  component: AdminSetupPage,
});

const EMPLOYEES: { fullName: string; fonction: string; role: AppRole; pin: string }[] = [
  { fullName: "Traoré Youssouf", fonction: "PCA", role: "admin", pin: "384752" },
  { fullName: "Koné Sarah", fonction: "Gérante", role: "admin", pin: "927164" },
  { fullName: "Kouakou Konan Nazaire", fonction: "Gestionnaire / Administrateur Système", role: "admin", pin: "615893" },
  { fullName: "Silué Abou", fonction: "Chef de service — Paddy", role: "paddy", pin: "204871" },
  { fullName: "Zamblé Donatien", fonction: "Agent Paddy", role: "paddy", pin: "749326" },
  { fullName: "Dao Emanuel", fonction: "Chef de service — Décorticage", role: "usinage", pin: "583917" },
  { fullName: "Soha Richmon", fonction: "Agent Usinage — Trieur", role: "usinage", pin: "168492" },
  { fullName: "Coulibaly Mariam", fonction: "Chef de service / Vendeuse — Boutique CAPI Commerciale", role: "commercial", pin: "372958" },
  { fullName: "Koné Sali", fonction: "Vendeuse — Boutique Commerce", role: "commercial", pin: "819264" },
  { fullName: "Awa Géraldine", fonction: "Vendeuse — Boutique Tazibouo", role: "commercial", pin: "456731" },
  { fullName: "Koné Djénébou", fonction: "Vendeuse — Boutique Gbokora", role: "commercial", pin: "927348" },
  { fullName: "Diawara Koumba", fonction: "Comptable", role: "comptable", pin: "638175" },
];

type RowResult = { status: "idle" | "loading" | "ok" | "error"; message?: string };

function AdminSetupPage() {
  const [results, setResults] = useState<Record<string, RowResult>>({});
  const [running, setRunning] = useState(false);

  async function runAll() {
    setRunning(true);
    for (const emp of EMPLOYEES) {
      setResults((r) => ({ ...r, [emp.pin]: { status: "loading" } }));
      const email = `p${emp.pin}@capi.internal`;

      const { data, error } = await supabase.auth.signUp({ email, password: emp.pin });

      if (error || !data.user) {
        setResults((r) => ({ ...r, [emp.pin]: { status: "error", message: error?.message ?? "Erreur inconnue" } }));
        await supabase.auth.signOut();
        continue;
      }

      const { error: profileErr } = await supabase.from("profiles").insert({
        id: data.user.id,
        full_name: emp.fullName,
        role: emp.role,
        entity_name: null,
        pin: emp.pin,
      });

      await supabase.auth.signOut();

      if (profileErr) {
        setResults((r) => ({ ...r, [emp.pin]: { status: "error", message: profileErr.message } }));
      } else {
        setResults((r) => ({ ...r, [emp.pin]: { status: "ok" } }));
      }
    }
    setRunning(false);
  }

  return (
    <>
      <AppTopbar eyebrow="Configuration initiale" title="Créer les comptes employés" />
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="card-elevated p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Cette page crée en une fois les {EMPLOYEES.length} comptes employés CAPI ci-dessous, avec leur PIN à 6
            chiffres. À utiliser <strong>une seule fois</strong>. Note bien les PIN affichés pour les distribuer à
            chaque personne — ils ne seront plus réaffichés ensuite.
          </p>
          <Button onClick={runAll} disabled={running}>
            {running ? "Création en cours…" : "Créer les comptes"}
          </Button>
        </div>

        <div className="card-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nom</th>
                <th className="px-4 py-2.5 font-medium">Fonction</th>
                <th className="px-4 py-2.5 font-medium">Rôle</th>
                <th className="px-4 py-2.5 font-medium">PIN</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {EMPLOYEES.map((emp) => {
                const r = results[emp.pin] ?? { status: "idle" as const };
                return (
                  <tr key={emp.pin}>
                    <td className="px-4 py-2.5">{emp.fullName}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{emp.fonction}</td>
                    <td className="px-4 py-2.5 capitalize">{emp.role}</td>
                    <td className="px-4 py-2.5 font-mono tracking-wider">{emp.pin}</td>
                    <td className="px-4 py-2.5">
                      {r.status === "idle" && <span className="text-muted-foreground">—</span>}
                      {r.status === "loading" && <span className="text-muted-foreground">…</span>}
                      {r.status === "ok" && <span className="text-success">✓ Créé</span>}
                      {r.status === "error" && <span className="text-destructive">✗ {r.message}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
