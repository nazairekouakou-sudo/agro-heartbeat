import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";

export const Route = createFileRoute("/comptable")({
  head: () => ({
    meta: [
      { title: "Service Comptable — CAPI ERP" },
      {
        name: "description",
        content:
          "Comptabilité par entité : CAPI + prestataires regroupés, chaque partenaire séparément.",
      },
    ],
  }),
  component: ComptablePage,
});

const entites = [
  { id: "capi", label: "CAPI (+ prestataires)" },
  { id: "coop-ndiaye", label: "Partenaire — Coop. Ndiaye" },
  { id: "gie-fanaye", label: "Partenaire — GIE Fanaye" },
  { id: "upp-podor", label: "Partenaire — UPP Podor" },
];

function ComptablePage() {
  const [ent, setEnt] = useState(entites[0].id);
  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Comptable" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Comptable"
          description="Enregistre par entité. Les paiements ne sont exécutés que sur états validés par la Gestion et l'Administration."
          actions={
            <select
              value={ent}
              onChange={(e) => setEnt(e.target.value)}
              className="h-9 px-3 rounded-md border border-border bg-card text-sm"
            >
              {entites.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Dépenses cumulées" value="284 M" hint="FCFA · Mois en cours" />
          <StatCard label="Recettes cumulées" value="412 M" hint="FCFA · Mois en cours" tone="secondary" />
          <StatCard label="Décaissements à venir" value="18" hint="Validés par Gestion" tone="gold" />
          <StatCard label="Rentabilité brute" value="+31 %" hint="Marge sur ventes" />
        </div>

        <div>
          <h3 className="font-display text-lg mb-2">Charges par centre de coût & lot</h3>
          <DataTable
            columns={["Date", "N° Lot", "Centre de coût", "Libellé", "Montant", "Statut", "Validé par"]}
            rows={[
              ["12/09", "PAD-2409-0231", "Approvisionnement", "CAP + transport", "3 780 000", <Statut k="Payé" tone="ok" />, "Gestion"],
              ["12/09", "PAD-2409-0221", "Usinage", "Décorticage", "150 000", <Statut k="À payer" tone="warn" />, "Gestion"],
              ["12/09", "PAD-2409-0221", "Trie optique", "Triage", "51 000", <Statut k="À payer" tone="warn" />, "Gestion"],
              ["10/09", "PAD-2409-0225", "Séchage", "3 jours", "12 000", <Statut k="Payé" tone="ok" />, "Gestion"],
            ]}
          />
        </div>

        <div>
          <h3 className="font-display text-lg mb-2">Encaissements & versements</h3>
          <DataTable
            columns={["Date", "Origine", "Libellé", "Montant", "Caisse", "Agent"]}
            rows={[
              ["12/09", "Boutique Dakar Centre", "Versement journalier", "519 400", "Caisse centrale", "M. Sy"],
              ["12/09", "Boutique St-Louis", "Versement journalier", "204 000", "Caisse centrale", "O. Faye"],
            ]}
          />
        </div>
      </div>
    </>
  );
}

function Statut({ k, tone }: { k: string; tone: "ok" | "warn" }) {
  const m = { ok: "bg-success/15 text-success", warn: "bg-warning/15 text-warning" } as const;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${m[tone]}`}>{k}</span>;
}
