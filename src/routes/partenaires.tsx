import { RequireRole } from "@/components/RequireRole";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { Lock } from "lucide-react";
import { usePaddy, type Appro, type LotStatus } from "@/lib/paddyStore";
import { useUsinage } from "@/lib/usinageStore";
import { useGestion } from "@/lib/gestionStore";

export const Route = createFileRoute("/partenaires")({
  head: () => ({
    meta: [
      { title: "Portail Partenaires — CAPI ERP" },
      {
        name: "description",
        content: "Accès cloisonné : chaque partenaire suit en temps réel uniquement ses lots, stocks et opérations.",
      },
    ],
  }),
  component: PartenairesPage,
});

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
function fcfa(n: number) {
  return Math.round(n).toLocaleString("fr-FR");
}
function fcfaCompact(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " Md";
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M";
  return n.toLocaleString("fr-FR");
}

function etapeLot(a: Appro, hasDecorticage: boolean, hasSortieRiz: boolean): string {
  if (a.status === "Collecte") return "Collecte";
  if (a.status === "En séchage") return "Séchage";
  if (a.status === "Stocké") return "Prêt usinage";
  if (a.status === "Sortie tiers") return "Sortie tiers";
  // Envoyé usinage
  if (hasSortieRiz) return "Vendu";
  if (hasDecorticage) return "Usiné";
  return "Envoyé usinage";
}

function PartenairesPage() {
  const { appros } = usePaddy();
  const { decorticages } = useUsinage();
  const { sortiesRiz, validations } = useGestion();

  const partenaires = useMemo(
    () => Array.from(new Set(appros.filter((a) => a.entity === "Partenaire").map((a) => a.entityName))),
    [appros],
  );
  const [selected, setSelected] = useState<string>("");
  const actif = selected || partenaires[0] || "";

  const mesLots = useMemo(() => appros.filter((a) => a.entityName === actif), [appros, actif]);
  const lotIds = useMemo(() => new Set(mesLots.map((a) => a.id)), [mesLots]);

  const decorticagesParLot = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of decorticages) {
      if (!lotIds.has(d.lotId)) continue;
      map.set(d.lotId, (map.get(d.lotId) ?? 0) + d.rizBlanchi);
    }
    return map;
  }, [decorticages, lotIds]);

  const sortiesRizParLot = useMemo(() => {
    const set = new Set<string>();
    for (const s of sortiesRiz) if (lotIds.has(s.lotId)) set.add(s.lotId);
    return set;
  }, [sortiesRiz, lotIds]);

  const validationByKey = useMemo(() => {
    const map = new Map<string, (typeof validations)[number]>();
    for (const v of validations) map.set(`${v.sourceTable}:${v.sourceId}`, v);
    return map;
  }, [validations]);

  const paddyEnStockT = useMemo(
    () =>
      mesLots
        .filter((a) => a.status === "Collecte" || a.status === "En séchage" || a.status === "Stocké")
        .reduce((s, a) => s + a.poids, 0) / 1000,
    [mesLots],
  );
  const rizDisponibleT = useMemo(() => {
    const produit = Array.from(decorticagesParLot.values()).reduce((s, v) => s + v, 0);
    const sorti = sortiesRiz.filter((s) => lotIds.has(s.lotId)).reduce((s, v) => s + v.quantite, 0);
    return Math.max(0, produit - sorti) / 1000;
  }, [decorticagesParLot, sortiesRiz, lotIds]);

  // Flux financiers : débits (charges du lot) + crédits (ventes riz du lot)
  const flux = useMemo(() => {
    type Flux = { date: string; lotId: string; operation: string; montant: number; sens: "Débit" | "Crédit"; sourceTable: string; sourceId: string };
    const lines: Flux[] = [];
    for (const a of mesLots) {
      lines.push({ date: a.dateAppro, lotId: a.id, operation: "Collecte", montant: a.chargeTotale, sens: "Débit", sourceTable: "appros", sourceId: a.id });
    }
    for (const s of sortiesRiz) {
      if (!lotIds.has(s.lotId)) continue;
      lines.push({ date: s.date, lotId: s.lotId, operation: `Vente ${s.categorie}`, montant: s.montant, sens: "Crédit", sourceTable: "sorties_riz", sourceId: s.id });
    }
    return lines.sort((x, y) => (x.date < y.date ? 1 : -1));
  }, [mesLots, sortiesRiz, lotIds]);

  const aEncaisser = useMemo(
    () =>
      flux
        .filter((f) => f.sens === "Crédit")
        .filter((f) => {
          const v = validationByKey.get(`${f.sourceTable}:${f.sourceId}`);
          return !v || v.status !== "validee";
        })
        .reduce((s, f) => s + f.montant, 0),
    [flux, validationByKey],
  );

  return (
    <RequireRole roles={["admin", "partenaire"]}>
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

        {partenaires.length === 0 ? (
          <div className="card-elevated p-8 text-center text-sm text-muted-foreground">
            Aucun partenaire dans les données pour l'instant. Les partenaires apparaissent ici dès qu'un
            approvisionnement Paddy leur est rattaché.
          </div>
        ) : (
          <section className="card-elevated p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Aperçu partenaire</div>
                <h3 className="font-display text-lg">{actif}</h3>
              </div>
              <select
                value={actif}
                onChange={(e) => setSelected(e.target.value)}
                className="h-9 px-3 rounded-md border border-border bg-card text-sm"
              >
                {partenaires.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard label="Mes lots actifs" value={String(mesLots.length)} />
              <StatCard label="Paddy en stock" value={`${paddyEnStockT.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`} tone="secondary" />
              <StatCard label="Riz blanchi disponible" value={`${rizDisponibleT.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`} tone="gold" />
              <StatCard label="À encaisser" value={`${fcfaCompact(aEncaisser)} F`} hint="FCFA" />
            </div>

            <h4 className="font-display text-base mb-2">Mes lots</h4>
            <DataTable
              columns={["N° Lot", "Zone", "Variété", "Entrée", "TH", "Poids (kg)", "Étape", "Riz blanchi"]}
              rows={mesLots.map((a) => {
                const rizBlanchi = decorticagesParLot.get(a.id) ?? 0;
                return [
                  a.id, a.zone, a.variete, fmtDate(a.dateEntree), `${a.th}%`, a.poids.toLocaleString("fr-FR"),
                  etapeLot(a, decorticagesParLot.has(a.id), sortiesRizParLot.has(a.id)),
                  rizBlanchi > 0 ? `${rizBlanchi.toLocaleString("fr-FR")} kg` : "—",
                ];
              })}
            />

            <h4 className="font-display text-base mt-6 mb-2">Mes flux financiers</h4>
            <DataTable
              columns={["Date", "N° Lot", "Opération", "Montant", "Sens"]}
              rows={flux.map((f) => [fmtDate(f.date), f.lotId, f.operation, fcfa(f.montant), f.sens])}
            />
          </section>
        )}
      </div>
    </>
    </RequireRole>
  );
}
