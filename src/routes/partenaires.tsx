import { createFileRoute } from "@tanstack/react-router";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { Lock, Eye } from "lucide-react";

export const Route = createFileRoute("/partenaires")({
  head: () => ({
    meta: [
      { title: "Portail Partenaires — CAPI ERP" },
      {
        name: "description",
        content:
          "Accès cloisonné : chaque partenaire suit en temps réel uniquement ses lots, stocks et opérations.",
      },
    ],
  }),
  component: PartenairesPage,
});

function PartenairesPage() {
  return (
    <>
      <AppTopbar eyebrow="Accès dédié" title="Portail Partenaires" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Portail Partenaires"
          description="Aperçu administrateur des portails cloisonnés. Chaque partenaire ne voit que ses propres données en production."
          actions={
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-gold/20 text-gold-foreground">
              <Lock className="size-3.5" /> Données cloisonnées
            </span>
          }
        />

        <section className="card-elevated p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Aperçu partenaire
              </div>
              <h3 className="font-display text-lg">Coopérative Ndiaye</h3>
            </div>
            <button className="text-xs inline-flex items-center gap-1.5 text-secondary hover:underline">
              <Eye className="size-3.5" /> Changer de partenaire
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Mes lots actifs" value="14" />
            <StatCard label="Paddy en stock" value="184 t" tone="secondary" />
            <StatCard label="Riz blanchi disponible" value="42 t" tone="gold" />
            <StatCard label="À encaisser" value="12,4 M" hint="FCFA" />
          </div>

          <h4 className="font-display text-base mb-2">Mes lots</h4>
          <DataTable
            columns={["N° Lot", "Zone", "Variété", "Entrée", "TH", "Poids (kg)", "Étape", "Riz blanchi"]}
            rows={[
              ["PAD-2409-0231", "Podor", "JT 11", "12/09", "22%", "12 000", "Séchage", "—"],
              ["PAD-2409-0225", "Podor", "JT 11", "10/09", "14%", "11 720", "Prêt usinage", "—"],
              ["PAD-2409-0210", "Rosso", "Bouaké", "05/09", "13%", "5 850", "Usiné", "4 000 kg"],
              ["PAD-2409-0198", "Fanaye", "CY-2", "01/09", "13%", "10 720", "Vendu", "7 380 kg"],
            ]}
          />

          <h4 className="font-display text-base mt-6 mb-2">Mes flux financiers</h4>
          <DataTable
            columns={["Date", "N° Lot", "Opération", "Montant", "Sens"]}
            rows={[
              ["12/09", "PAD-2409-0231", "Collecte", "3 780 000", "Débit"],
              ["11/09", "PAD-2409-0210", "Vente LG+1X", "2 200 000", "Crédit"],
              ["10/09", "PAD-2409-0225", "Séchage", "12 000", "Débit"],
            ]}
          />
        </section>
      </div>
    </>
  );
}
