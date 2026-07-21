import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";

export const Route = createFileRoute("/commercial")({
  head: () => ({
    meta: [
      { title: "Service Commercial — CAPI ERP" },
      { name: "description", content: "Commandes, ventes par boutique et versements caisse." },
    ],
  }),
  component: CommercialPage,
});

const tabs = [
  { id: "commandes", label: "Commandes" },
  { id: "ventes", label: "Ventes par boutique" },
  { id: "versements", label: "Versements caisse" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function CommercialPage() {
  const [tab, setTab] = useState<TabId>("commandes");
  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Commercial" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Commercial"
          description="Commande le riz auprès de la Gestion, vend en boutique, verse les recettes à la Comptabilité."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="CA du mois" value="1,24 Md" hint="FCFA" />
          <StatCard label="Commandes actives" value="18" hint="Toutes qualités" tone="secondary" />
          <StatCard label="Boutiques" value="4" hint="Dakar · St-Louis · Thiès · Louga" tone="gold" />
          <StatCard label="Versements semaine" value="42 M" hint="FCFA" />
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "commandes" && (
          <DataTable
            columns={["Id commande", "Date", "N° Lot", "Désignation", "Quantité (kg)", "Prix de vente", "Boutique"]}
            rows={[
              ["CMD-0812", "12/09", "PAD-2409-0221", "LG + 1X", "2 000", "550", "Dakar Centre"],
              ["CMD-0813", "12/09", "PAD-2409-0221", "2X Cassé", "500", "380", "Dakar Centre"],
              ["CMD-0814", "12/09", "PAD-2409-0210", "Fine Brisure", "300", "220", "St-Louis"],
            ]}
          />
        )}
        {tab === "ventes" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-lg mb-2">Boutique Dakar Centre — 12/09</h3>
              <DataTable
                columns={["Produit", "Stock initial", "Entrée", "Total", "Sortie", "Stock final", "Prix de vente", "Montant"]}
                rows={[
                  ["PAD-2409-0221 · LG+1X", "1 200", "2 000", "3 200", "820", "2 380", "550", "451 000"],
                  ["PAD-2409-0221 · 2X", "200", "500", "700", "180", "520", "380", "68 400"],
                  ["Total", "—", "—", "—", "—", "—", "—", "519 400"],
                ]}
              />
            </div>
          </div>
        )}
        {tab === "versements" && (
          <DataTable
            columns={["Date", "Boutique", "Montant versé", "Solde restant caisse", "Agent encaisseur"]}
            rows={[
              ["12/09", "Dakar Centre", "519 400", "48 200", "M. Sy"],
              ["12/09", "St-Louis", "204 000", "12 800", "O. Faye"],
              ["11/09", "Thiès", "312 500", "0", "K. Diallo"],
            ]}
          />
        )}
      </div>
    </>
  );
}
