import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { Plus, Filter } from "lucide-react";

export const Route = createFileRoute("/paddy")({
  head: () => ({
    meta: [
      { title: "Service Paddy — CAPI ERP" },
      {
        name: "description",
        content:
          "Approvisionnement, entrées prestataires, séchage et sorties de paddy avec traçabilité par N° Lot.",
      },
    ],
  }),
  component: PaddyPage,
});

const tabs = [
  { id: "appro", label: "Approvisionnement" },
  { id: "entree", label: "Entrée prestataire" },
  { id: "sechage", label: "Séchage" },
  { id: "sortie", label: "Sortie" },
  { id: "financier", label: "Suivi financier" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function PaddyPage() {
  const [tab, setTab] = useState<TabId>("appro");
  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Paddy" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Paddy"
          description="Coordonne collecte, entrées, séchage et sorties. Chaque lot est tracé de son entrée à sa sortie."
          actions={
            <>
              <button className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted inline-flex items-center gap-1.5">
                <Filter className="size-4" /> Filtrer
              </button>
              <button className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 inline-flex items-center gap-1.5">
                <Plus className="size-4" /> Nouvelle opération
              </button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Lots actifs" value="47" hint="Toutes entités" />
          <StatCard label="Paddy en stock" value="612 t" hint="Après séchage" tone="secondary" />
          <StatCard label="TH moyen" value="13,4 %" hint="Après séchage" tone="gold" />
          <StatCard label="En séchage" value="8 lots" hint="~140 t" />
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

        {tab === "appro" && (
          <DataTable
            columns={[
              "Date appro",
              "Date entrée",
              "N° Lot",
              "Zone",
              "Entité",
              "Variété",
              "TH",
              "TI",
              "Sacs",
              "Poids (kg)",
              "PM",
              "Agent",
            ]}
            rows={[
              ["12/09", "12/09", "PAD-2409-0231", "Podor", <EntityBadge k="Partenaire" />, "JT 11", "22%", "3%", 240, "12 000", "50", "M. Ba"],
              ["12/09", "12/09", "PAD-2409-0232", "Rosso", <EntityBadge k="CAPI" />, "Bouaké", "20%", "2%", 180, "9 000", "50", "F. Diop"],
              ["11/09", "12/09", "PAD-2409-0230", "Fanaye", <EntityBadge k="Partenaire" />, "CY-2", "24%", "4%", 320, "16 000", "50", "M. Ba"],
            ]}
          />
        )}
        {tab === "entree" && (
          <DataTable
            columns={["Date", "N° Lot", "Zone", "Prestataire", "Variété", "TH", "TI", "Sacs", "Poids (kg)", "PM", "Agent"]}
            rows={[
              ["12/09", "PRE-2409-0044", "St-Louis", "M. Diouf", "JT 11", "18%", "2%", 24, "1 200", "50", "F. Diop"],
              ["11/09", "PRE-2409-0043", "Dagana", "Coop. locale", "Bouaké", "21%", "3%", 60, "3 000", "50", "M. Ba"],
            ]}
          />
        )}
        {tab === "sechage" && (
          <DataTable
            columns={["Date", "N° Lot", "TH initial", "Sacs", "Poids (kg)", "Jours", "TH après", "Poids après", "Variation", "Agent"]}
            rows={[
              ["10/09", "PAD-2409-0225", "22%", 240, "12 000", 3, "14%", "11 720", "−280", "S. Ndiaye"],
              ["09/09", "PAD-2409-0221", "24%", 180, "9 000", 4, "13%", "8 780", "−220", "S. Ndiaye"],
            ]}
          />
        )}
        {tab === "sortie" && (
          <DataTable
            columns={["Date", "N° Lot", "TH", "Sacs", "Poids (kg)", "PM", "Variation", "Destination", "Agent"]}
            rows={[
              ["12/09", "PAD-2409-0221", "13%", 180, "8 780", "48,8", "−220", "Usinage", "S. Ndiaye"],
              ["12/09", "PAD-2409-0210", "14%", 120, "5 850", "48,7", "−150", "Client GIE Fanaye", "M. Ba"],
            ]}
          />
        )}
        {tab === "financier" && (
          <div className="space-y-4">
            <div>
              <h3 className="font-display text-lg mb-2">Charges d'approvisionnement</h3>
              <DataTable
                columns={["Date", "N° Lot", "Sacs", "Poids", "PU", "CAP", "Chargé", "Pesé", "Déchargé", "Transport", "Frais annexes", "Prime", "Charge totale"]}
                rows={[
                  ["12/09", "PAD-2409-0231", 240, "12 000", "300", "3 600 000", "24 000", "12 000", "24 000", "180 000", "15 000", "20 000", "3 875 000"],
                ]}
              />
            </div>
            <div>
              <h3 className="font-display text-lg mb-2">Charges de séchage</h3>
              <DataTable
                columns={["Date", "N° Lot", "Sacs", "PU", "Montant"]}
                rows={[["10/09", "PAD-2409-0225", 240, "50", "12 000"]]}
              />
            </div>
            <div>
              <h3 className="font-display text-lg mb-2">Charges de sortie</h3>
              <DataTable
                columns={["Date", "N° Lot", "Sacs", "Chargé", "Pesé", "Déplacement", "Charge totale"]}
                rows={[["12/09", "PAD-2409-0221", 180, "—", "9 000", "18 000", "27 000"]]}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function EntityBadge({ k }: { k: "CAPI" | "Partenaire" | "Prestataire" }) {
  const map = {
    CAPI: "bg-primary/10 text-primary",
    Partenaire: "bg-secondary/15 text-secondary",
    Prestataire: "bg-gold/20 text-gold-foreground",
  } as const;
  return (
    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider ${map[k]}`}>
      {k}
    </span>
  );
}
