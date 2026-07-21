import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";

export const Route = createFileRoute("/usinage")({
  head: () => ({
    meta: [
      { title: "Service Usinage — CAPI ERP" },
      { name: "description", content: "Décorticage, trie optique et suivi financier de l'usinage." },
    ],
  }),
  component: UsinagePage,
});

const tabs = [
  { id: "decorticage", label: "Décorticage" },
  { id: "trie", label: "Trie optique" },
  { id: "financier", label: "Suivi financier" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function UsinagePage() {
  const [tab, setTab] = useState<TabId>("decorticage");
  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Usinage" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Usinage"
          description="Décorticage du paddy puis trie optique du riz. Chaque opération est rattachée au N° Lot d'origine."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Riz blanchi (7j)" value="486 t" hint="LG+1X · 2X · FB" />
          <StatCard label="Rendement moyen" value="68,4 %" hint="Riz blanc / paddy" tone="secondary" />
          <StatCard label="Trie optique" value="312 t" hint="Riz trié cette semaine" tone="gold" />
          <StatCard label="Taux résidus moyen" value="4,2 %" />
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

        {tab === "decorticage" && (
          <DataTable
            columns={["Date", "N° Lot", "Sacs", "Poids (kg)", "TH", "LG + 1X", "2X Cassé", "FB", "Riz Blanchi", "Qualité", "Rendement", "Équipe"]}
            rows={[
              ["12/09", "PAD-2409-0221", 180, "8 780", "13%", "5 100", "780", "120", "6 000", "Blanc", "68,3%", "Éq. A"],
              ["12/09", "PAD-2409-0210", 120, "5 850", "14%", "3 400", "520", "80", "4 000", "Moyen blanc", "68,4%", "Éq. B"],
              ["11/09", "PAD-2409-0198", 220, "10 720", "13%", "6 280", "940", "160", "7 380", "Blanc", "68,8%", "Éq. A"],
            ]}
          />
        )}
        {tab === "trie" && (
          <DataTable
            columns={["Date", "N° Lot", "Riz (kg)", "Riz après trie", "Résidus", "Écart", "Taux résidus", "Agent"]}
            rows={[
              ["12/09", "PAD-2409-0221", "5 100", "4 880", "200", "20", "3,9%", "A. Sarr"],
              ["12/09", "PAD-2409-0210", "3 400", "3 240", "150", "10", "4,4%", "A. Sarr"],
            ]}
          />
        )}
        {tab === "financier" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-lg mb-2">Coût de décorticage</h3>
              <DataTable
                columns={["Date", "N° Lot", "Sacs paddy", "Poids paddy", "Riz blanchi", "Prix d'usinage", "Coût d'usinage"]}
                rows={[
                  ["12/09", "PAD-2409-0221", 180, "8 780", "6 000", "25 FCFA/kg", "150 000"],
                  ["12/09", "PAD-2409-0210", 120, "5 850", "4 000", "25 FCFA/kg", "100 000"],
                ]}
              />
            </div>
            <div>
              <h3 className="font-display text-lg mb-2">Coût de triage</h3>
              <DataTable
                columns={["Date", "N° Lot", "Riz (kg)", "Prix de triage", "Coût de triage"]}
                rows={[
                  ["12/09", "PAD-2409-0221", "5 100", "10 FCFA/kg", "51 000"],
                  ["12/09", "PAD-2409-0210", "3 400", "10 FCFA/kg", "34 000"],
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
