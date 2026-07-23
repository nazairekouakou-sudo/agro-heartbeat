import { RequireRole } from "@/components/RequireRole";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { usePaddy, type Appro } from "@/lib/paddyStore";
import { useUsinage } from "@/lib/usinageStore";
import { useCommercial } from "@/lib/commercialStore";
import { useGestion } from "@/lib/gestionStore";

export const Route = createFileRoute("/comptable")({
  head: () => ({
    meta: [
      { title: "Service Comptable — CAPI ERP" },
      {
        name: "description",
        content: "Comptabilité par entité : CAPI + prestataires regroupés, chaque partenaire séparément.",
      },
    ],
  }),
  component: ComptablePage,
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
  if (n >= 1_000_000) return Math.round(n / 1_000_000).toLocaleString("fr-FR") + " M";
  return n.toLocaleString("fr-FR");
}
function thisMonth(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

type ChargeLine = {
  date: string;
  lotId: string;
  centre: string;
  libelle: string;
  montant: number;
  sourceTable: string;
  sourceId: string;
  entity: Appro["entity"] | null;
  entityName: string | null;
};

function ComptablePage() {
  const { appros, sechages, sorties } = usePaddy();
  const { decorticages, tries } = useUsinage();
  const { ventes, versements } = useCommercial();
  const { validations } = useGestion();

  const approByLot = useMemo(() => new Map(appros.map((a) => [a.id, a])), [appros]);

  const partenaires = useMemo(
    () => Array.from(new Set(appros.filter((a) => a.entity === "Partenaire").map((a) => a.entityName))),
    [appros],
  );
  const entites = useMemo(
    () => [
      { id: "capi", label: "CAPI (+ prestataires)" },
      ...partenaires.map((p) => ({ id: p, label: `Partenaire — ${p}` })),
    ],
    [partenaires],
  );
  const [ent, setEnt] = useState("capi");

  const chargeLines: ChargeLine[] = useMemo(() => {
    const lines: ChargeLine[] = [];
    for (const a of appros) {
      lines.push({
        date: a.dateAppro, lotId: a.id, centre: "Approvisionnement", libelle: "CAP + frais annexes",
        montant: a.chargeTotale, sourceTable: "appros", sourceId: a.id, entity: a.entity, entityName: a.entityName,
      });
    }
    for (const s of sechages) {
      const a = approByLot.get(s.lotId);
      lines.push({
        date: s.date, lotId: s.lotId, centre: "Séchage", libelle: `${s.jours} jour${s.jours > 1 ? "s" : ""}`,
        montant: s.montant, sourceTable: "sechages", sourceId: s.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null,
      });
    }
    for (const s of sorties) {
      const a = approByLot.get(s.lotId);
      lines.push({
        date: s.date, lotId: s.lotId, centre: "Sortie / Transport", libelle: s.destination,
        montant: s.chargeTotale, sourceTable: "sorties", sourceId: s.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null,
      });
    }
    for (const d of decorticages) {
      const a = approByLot.get(d.lotId);
      lines.push({
        date: d.date, lotId: d.lotId, centre: "Usinage", libelle: "Décorticage",
        montant: d.coutUsinage, sourceTable: "decorticages", sourceId: d.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null,
      });
    }
    for (const t of tries) {
      const a = approByLot.get(t.lotId);
      lines.push({
        date: t.date, lotId: t.lotId, centre: "Trie optique", libelle: "Triage",
        montant: t.coutTriage, sourceTable: "tries", sourceId: t.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null,
      });
    }
    return lines.sort((x, y) => (x.date < y.date ? 1 : -1));
  }, [appros, sechages, sorties, decorticages, tries, approByLot]);

  const validationByKey = useMemo(() => {
    const map = new Map<string, (typeof validations)[number]>();
    for (const v of validations) map.set(`${v.sourceTable}:${v.sourceId}`, v);
    return map;
  }, [validations]);

  const filteredLines = useMemo(
    () =>
      chargeLines.filter((l) =>
        ent === "capi" ? l.entity === "CAPI" || l.entity === "Prestataire" || l.entity === null : l.entityName === ent,
      ),
    [chargeLines, ent],
  );

  const depensesCumulees = useMemo(
    () => chargeLines.filter((l) => thisMonth(l.date)).reduce((s, l) => s + l.montant, 0),
    [chargeLines],
  );
  const recettesCumulees = useMemo(
    () => ventes.filter((v) => thisMonth(v.date)).reduce((s, v) => s + v.montant, 0),
    [ventes],
  );
  const decaissementsAVenir = useMemo(
    () =>
      filteredLines.filter((l) => {
        const v = validationByKey.get(`${l.sourceTable}:${l.sourceId}`);
        return !v || v.status === "en_attente";
      }).length,
    [filteredLines, validationByKey],
  );
  const rentabilite = recettesCumulees > 0 ? ((recettesCumulees - depensesCumulees) / recettesCumulees) * 100 : 0;

  return (
    <RequireRole roles={["admin", "comptable"]}>
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
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </select>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Dépenses cumulées" value={`${fcfaCompact(depensesCumulees)} F`} hint="FCFA · Mois en cours" />
          <StatCard label="Recettes cumulées" value={`${fcfaCompact(recettesCumulees)} F`} hint="FCFA · Mois en cours" tone="secondary" />
          <StatCard label="Décaissements à venir" value={String(decaissementsAVenir)} hint="Validés par Gestion" tone="gold" />
          <StatCard label="Rentabilité brute" value={`${rentabilite >= 0 ? "+" : ""}${rentabilite.toFixed(0)} %`} hint="Marge sur ventes" />
        </div>

        <div>
          <h3 className="font-display text-lg mb-2">Charges par centre de coût & lot</h3>
          <DataTable
            columns={["Date", "N° Lot", "Centre de coût", "Libellé", "Montant", "Statut", "Validé par"]}
            rows={filteredLines.map((l) => {
              const v = validationByKey.get(`${l.sourceTable}:${l.sourceId}`);
              const status = v?.status ?? "en_attente";
              return [
                fmtDate(l.date), l.lotId, l.centre, l.libelle, fcfa(l.montant),
                <Statut
                  key={`${l.sourceTable}-${l.sourceId}`}
                  k={status === "validee" ? "Payé" : status === "rejetee" ? "Rejeté" : "À payer"}
                  tone={status === "validee" ? "ok" : status === "rejetee" ? "bad" : "warn"}
                />,
                v?.resolvedBy ?? "—",
              ];
            })}
          />
        </div>

        <div>
          <h3 className="font-display text-lg mb-2">Encaissements & versements</h3>
          <DataTable
            columns={["Date", "Origine", "Libellé", "Montant", "Caisse", "Agent"]}
            rows={versements.map((v) => [
              fmtDate(v.date), `Boutique ${v.boutique}`, "Versement journalier", fcfa(v.montantVerse), "Caisse centrale", v.agent,
            ])}
          />
        </div>
      </div>
    </>
    </RequireRole>
  );
}

function Statut({ k, tone }: { k: string; tone: "ok" | "warn" | "bad" }) {
  const m = {
    ok: "bg-success/15 text-success",
    warn: "bg-warning/15 text-warning",
    bad: "bg-destructive/15 text-destructive",
  } as const;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${m[tone]}`}>{k}</span>;
}
