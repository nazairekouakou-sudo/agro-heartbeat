import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/gestion")({
  head: () => ({
    meta: [
      { title: "Service Gestion — CAPI ERP" },
      {
        name: "description",
        content: "Contrôle, validation et arbitrage des flux physiques et financiers.",
      },
    ],
  }),
  component: GestionPage,
});

const tabs = [
  { id: "stock-paddy", label: "Stock paddy" },
  { id: "entree-riz", label: "Entrée riz blanchi" },
  { id: "sortie-riz", label: "Sortie riz blanchi" },
  { id: "validation", label: "Validations en attente" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function GestionPage() {
  const [tab, setTab] = useState<TabId>("stock-paddy");
  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Gestion" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Gestion"
          description="Ne paie pas, n'exécute pas. Contrôle, valide, arbitre et certifie toutes les opérations avant transmission à la comptabilité."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Stock paddy total" value="612 t" hint="47 lots suivis" />
          <StatCard label="Stock riz blanchi" value="184 t" hint="LG+1X · 2X · FB" tone="secondary" />
          <StatCard label="À valider" value="12" hint="États en attente" tone="gold" />
          <StatCard label="Écarts détectés" value="2" hint="Cette semaine" />
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

        {tab === "stock-paddy" && (
          <DataTable
            columns={["N° Lot", "Zone", "Entité", "Variété", "TH", "Sacs", "Poids (kg)", "Statut", "Dernière opération"]}
            rows={[
              ["PAD-2409-0225", "Podor", "CAPI", "JT 11", "14%", 240, "11 720", <StatusPill k="Prêt usinage" tone="ok" />, "Séchage 10/09"],
              ["PAD-2409-0231", "Podor", "Partenaire — Coop. Ndiaye", "JT 11", "22%", 240, "12 000", <StatusPill k="En séchage" tone="warn" />, "Entrée 12/09"],
              ["PAD-2409-0198", "Fanaye", "CAPI", "CY-2", "13%", 220, "10 720", <StatusPill k="Usiné" tone="muted" />, "Sortie 11/09"],
            ]}
          />
        )}
        {tab === "entree-riz" && (
          <DataTable
            columns={["Date", "N° Lot", "Qualité", "Quantité (kg)", "Entité"]}
            rows={[
              ["12/09", "PAD-2409-0221", "LG + 1X", "4 880", "CAPI"],
              ["12/09", "PAD-2409-0221", "2X Cassé", "780", "CAPI"],
              ["12/09", "PAD-2409-0221", "Fine Brisure", "120", "CAPI"],
              ["12/09", "PAD-2409-0210", "LG + 1X", "3 240", "Partenaire — GIE Fanaye"],
            ]}
          />
        )}
        {tab === "sortie-riz" && (
          <DataTable
            columns={["Date", "Id commande", "N° Lot", "Qualité", "Quantité (kg)", "Prix de vente"]}
            rows={[
              ["12/09", "CMD-0812", "PAD-2409-0221", "LG + 1X", "2 000", "550 FCFA/kg"],
              ["12/09", "CMD-0813", "PAD-2409-0221", "2X Cassé", "500", "380 FCFA/kg"],
            ]}
          />
        )}
        {tab === "validation" && (
          <div className="card-elevated p-4 space-y-2">
            {[
              { ref: "PAD-2409-0231 · Approvisionnement", who: "Service Paddy", amount: "3 875 000 FCFA", ok: false },
              { ref: "USI-2409-0117 · Décorticage", who: "Service Usinage", amount: "150 000 FCFA", ok: false },
              { ref: "CMD-0810 · Prix de vente", who: "Service Commercial", amount: "500 FCFA/kg", ok: true },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/40 border border-border">
                <div className={`size-9 rounded-lg flex items-center justify-center ${r.ok ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                  {r.ok ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{r.ref}</div>
                  <div className="text-xs text-muted-foreground">{r.who}</div>
                </div>
                <div className="text-sm tabular-nums font-medium">{r.amount}</div>
                <button className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" /> Valider
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function StatusPill({ k, tone }: { k: string; tone: "ok" | "warn" | "muted" }) {
  const m = {
    ok: "bg-success/15 text-success",
    warn: "bg-warning/15 text-warning",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${m[tone]}`}>{k}</span>;
}
