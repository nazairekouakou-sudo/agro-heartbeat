import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { RequireRole } from "@/components/RequireRole";
import { ExportButtons } from "@/components/ExportButtons";
import { usePaddy, type Appro } from "@/lib/paddyStore";
import { useUsinage } from "@/lib/usinageStore";
import { useCommercial } from "@/lib/commercialStore";
import { useGestion } from "@/lib/gestionStore";

export const Route = createFileRoute("/reporting")({
  head: () => ({
    meta: [
      { title: "Reporting — CAPI ERP" },
      { name: "description", content: "Rapports par centre de performance et par entité, exportables en CSV/PDF." },
    ],
  }),
  component: () => (
    <RequireRole roles={["admin", "gestion"]}>
      <ReportingPage />
    </RequireRole>
  ),
});

function fcfa(n: number) {
  return Math.round(n).toLocaleString("fr-FR");
}
function fcfaCompact(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " Md";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M";
  return n.toLocaleString("fr-FR");
}
function inRange(iso: string, from: string, to: string) {
  return iso >= from && iso <= to;
}
function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const axes = [
  { id: "centre", label: "Rapports par Centre" },
  { id: "entite", label: "Rapports par Entité" },
] as const;
type AxisId = (typeof axes)[number]["id"];

function ReportingPage() {
  const [axis, setAxis] = useState<AxisId>("centre");
  const [from, setFrom] = useState(firstOfMonthISO());
  const [to, setTo] = useState(todayISO());

  return (
    <>
      <AppTopbar
        eyebrow="Pilotage"
        title="Reporting"
        actions={
          <div className="hidden md:flex items-center gap-2 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2 rounded-md border border-border bg-card text-sm" />
            <span className="text-muted-foreground">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-2 rounded-md border border-border bg-card text-sm" />
          </div>
        }
      />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Reporting"
          description="Pilotage sans se noyer dans les chiffres : performance par centre opérationnel, ou état financier par entité."
        />

        <div className="flex md:hidden items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 px-2 rounded-md border border-border bg-card text-sm flex-1" />
          <span className="text-muted-foreground">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 px-2 rounded-md border border-border bg-card text-sm flex-1" />
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border">
          {axes.map((a) => (
            <button
              key={a.id}
              onClick={() => setAxis(a.id)}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                axis === a.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {axis === "centre" ? <RapportsParCentre from={from} to={to} /> : <RapportsParEntite from={from} to={to} />}
      </div>
    </>
  );
}

// ================================================================
// AXE 1 — PAR CENTRE
// ================================================================
function RapportsParCentre({ from, to }: { from: string; to: string }) {
  const { appros, sechages } = usePaddy();
  const { decorticages, tries } = useUsinage();
  const { ventes, versements } = useCommercial();

  const approsP = useMemo(() => appros.filter((a) => inRange(a.dateAppro, from, to)), [appros, from, to]);
  const sechagesP = useMemo(() => sechages.filter((s) => inRange(s.date, from, to)), [sechages, from, to]);
  const decorticagesP = useMemo(() => decorticages.filter((d) => inRange(d.date, from, to)), [decorticages, from, to]);
  const triesP = useMemo(() => tries.filter((t) => inRange(t.date, from, to)), [tries, from, to]);
  const ventesP = useMemo(() => ventes.filter((v) => inRange(v.date, from, to)), [ventes, from, to]);
  const versementsP = useMemo(() => versements.filter((v) => inRange(v.date, from, to)), [versements, from, to]);

  // ---- Centre Amont (Paddy) ----
  const volumeCollecteT = approsP.reduce((s, a) => s + a.poids, 0) / 1000;
  const perteSechage = useMemo(() => {
    const totalAvant = sechagesP.reduce((s, x) => s + x.poidsAvant, 0);
    const totalApres = sechagesP.reduce((s, x) => s + x.poidsApres, 0);
    return totalAvant > 0 ? ((totalAvant - totalApres) / totalAvant) * 100 : 0;
  }, [sechagesP]);

  const parZone = useMemo(() => {
    const map = new Map<string, { zone: string; volumeKg: number; achat: number; charges: number; total: number }>();
    for (const a of approsP) {
      const cur = map.get(a.zone) ?? { zone: a.zone, volumeKg: 0, achat: 0, charges: 0, total: 0 };
      cur.volumeKg += a.poids;
      cur.achat += a.cap;
      cur.charges += a.charge + a.pesage + a.dechargement + a.transport + a.fraisAnnexes + a.prime;
      cur.total += a.chargeTotale;
      map.set(a.zone, cur);
    }
    return Array.from(map.values()).sort((x, y) => y.total - x.total);
  }, [approsP]);

  // ---- Centre Industriel (Usinage) ----
  const rendementMoyen = useMemo(() => {
    const totalPaddy = decorticagesP.reduce((s, d) => s + d.poidsPaddy, 0);
    const totalRiz = decorticagesP.reduce((s, d) => s + d.rizBlanchi, 0);
    return totalPaddy > 0 ? (totalRiz / totalPaddy) * 100 : 0;
  }, [decorticagesP]);
  const tauxResidusMoyen = useMemo(() => {
    const totalEntree = triesP.reduce((s, t) => s + t.rizEntree, 0);
    const totalResidus = triesP.reduce((s, t) => s + t.residus, 0);
    return totalEntree > 0 ? (totalResidus / totalEntree) * 100 : 0;
  }, [triesP]);

  // ---- Centre Commercial (Boutiques) ----
  const parBoutique = useMemo(() => {
    const map = new Map<string, { boutique: string; ca: number; sortie: number; stockMoyen: number; n: number; verse: number }>();
    for (const v of ventesP) {
      const cur = map.get(v.boutique) ?? { boutique: v.boutique, ca: 0, sortie: 0, stockMoyen: 0, n: 0, verse: 0 };
      cur.ca += v.montant;
      cur.sortie += v.sortie;
      cur.stockMoyen += (v.stockInitial + v.stockFinal) / 2;
      cur.n += 1;
      map.set(v.boutique, cur);
    }
    for (const v of versementsP) {
      const cur = map.get(v.boutique) ?? { boutique: v.boutique, ca: 0, sortie: 0, stockMoyen: 0, n: 0, verse: 0 };
      cur.verse += v.montantVerse;
      map.set(v.boutique, cur);
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        rotation: r.stockMoyen > 0 ? r.sortie / (r.stockMoyen / Math.max(r.n, 1)) : 0,
        ecart: r.ca - r.verse,
      }))
      .sort((x, y) => y.ca - x.ca);
  }, [ventesP, versementsP]);

  return (
    <div className="space-y-8">
      {/* Centre Amont */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg">Centre Amont — Paddy</h3>
          <ExportButtons
            filename="rapport-amont-paddy"
            title="Rapport Centre Amont (Paddy)"
            subtitle={`${from} → ${to}`}
            columns={["Zone", "Volume (kg)", "Coût d'achat (FCFA)", "Charges annexes (FCFA)", "Coût total (FCFA)"]}
            rows={parZone.map((z) => [z.zone, z.volumeKg.toLocaleString("fr-FR"), fcfa(z.achat), fcfa(z.charges), fcfa(z.total)])}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <StatCard label="Volume total collecté" value={`${volumeCollecteT.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`} />
          <StatCard label="Taux de perte moyen (séchage)" value={`${perteSechage.toFixed(1)} %`} tone="secondary" />
          <StatCard label="Zones actives" value={String(parZone.length)} tone="gold" />
        </div>
        <DataTable
          columns={["Zone", "Volume (kg)", "Coût d'achat", "Charges annexes", "Coût total"]}
          rows={parZone.map((z) => [z.zone, z.volumeKg.toLocaleString("fr-FR"), fcfa(z.achat), fcfa(z.charges), fcfa(z.total)])}
        />
      </section>

      {/* Centre Industriel */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg">Centre Industriel — Usinage</h3>
          <ExportButtons
            filename="rapport-industriel-usinage"
            title="Rapport Centre Industriel (Usinage)"
            subtitle={`${from} → ${to}`}
            columns={["N° Lot", "Date", "Paddy (kg)", "Riz blanchi (kg)", "Rendement", "Qualité"]}
            rows={decorticagesP.map((d) => [d.lotId, d.date, d.poidsPaddy, d.rizBlanchi, `${d.rendement}%`, d.qualite])}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
          <StatCard label="Rendement moyen décorticage" value={`${rendementMoyen.toFixed(1)} %`} hint="Riz blanchi / paddy entré" />
          <StatCard label="Taux de résidus (trie optique)" value={`${tauxResidusMoyen.toFixed(1)} %`} tone="secondary" />
          <StatCard label="Immobilisation machines" value="Non suivi" hint="Aucune donnée enregistrée" tone="gold" />
        </div>
        <DataTable
          columns={["N° Lot", "Date", "Paddy (kg)", "Riz blanchi (kg)", "Rendement", "Qualité"]}
          rows={decorticagesP.map((d) => [d.lotId, d.date, d.poidsPaddy.toLocaleString("fr-FR"), d.rizBlanchi.toLocaleString("fr-FR"), `${d.rendement}%`, d.qualite])}
        />
      </section>

      {/* Centre Commercial */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display text-lg">Centre Commercial — Boutiques</h3>
          <ExportButtons
            filename="rapport-commercial-boutiques"
            title="Rapport Centre Commercial (Boutiques)"
            subtitle={`${from} → ${to}`}
            columns={["Boutique", "CA (FCFA)", "Rotation stock", "Versé (FCFA)", "Écart caisse (FCFA)"]}
            rows={parBoutique.map((b) => [b.boutique, fcfa(b.ca), b.rotation.toFixed(2), fcfa(b.verse), fcfa(b.ecart)])}
          />
        </div>
        <DataTable
          columns={["Boutique", "CA", "Rotation stock", "Versé", "Écart caisse"]}
          rows={parBoutique.map((b) => [
            b.boutique, fcfaCompact(b.ca), b.rotation.toFixed(2), fcfaCompact(b.verse),
            b.ecart === 0 ? "0" : b.ecart > 0 ? `+${fcfaCompact(b.ecart)}` : fcfaCompact(b.ecart),
          ])}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Écart caisse = chiffre d'affaires reconnu moins montants effectivement versés à la Comptabilité sur la période.
        </p>
      </section>
    </div>
  );
}

// ================================================================
// AXE 2 — PAR ENTITÉ
// ================================================================
type ChargeLine = {
  date: string; lotId: string; centre: string; libelle: string; montant: number;
  sourceTable: string; sourceId: string; entity: Appro["entity"] | null; entityName: string | null;
};

function useChargeLines(from: string, to: string) {
  const { appros, sechages, sorties } = usePaddy();
  const { decorticages, tries } = useUsinage();
  const approByLot = useMemo(() => new Map(appros.map((a) => [a.id, a])), [appros]);

  return useMemo(() => {
    const lines: ChargeLine[] = [];
    for (const a of appros) {
      if (!inRange(a.dateAppro, from, to)) continue;
      lines.push({ date: a.dateAppro, lotId: a.id, centre: "Approvisionnement", libelle: "CAP + frais annexes", montant: a.chargeTotale, sourceTable: "appros", sourceId: a.id, entity: a.entity, entityName: a.entityName });
    }
    for (const s of sechages) {
      if (!inRange(s.date, from, to)) continue;
      const a = approByLot.get(s.lotId);
      lines.push({ date: s.date, lotId: s.lotId, centre: "Séchage", libelle: `${s.jours} j`, montant: s.montant, sourceTable: "sechages", sourceId: s.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null });
    }
    for (const s of sorties) {
      if (!inRange(s.date, from, to)) continue;
      const a = approByLot.get(s.lotId);
      lines.push({ date: s.date, lotId: s.lotId, centre: "Transport", libelle: s.destination, montant: s.chargeTotale, sourceTable: "sorties", sourceId: s.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null });
    }
    for (const d of decorticages) {
      if (!inRange(d.date, from, to)) continue;
      const a = approByLot.get(d.lotId);
      lines.push({ date: d.date, lotId: d.lotId, centre: "Usinage", libelle: "Décorticage", montant: d.coutUsinage, sourceTable: "decorticages", sourceId: d.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null });
    }
    for (const t of tries) {
      if (!inRange(t.date, from, to)) continue;
      const a = approByLot.get(t.lotId);
      lines.push({ date: t.date, lotId: t.lotId, centre: "Trie optique", libelle: "Triage", montant: t.coutTriage, sourceTable: "tries", sourceId: t.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null });
    }
    return lines.sort((x, y) => (x.date < y.date ? 1 : -1));
  }, [appros, sechages, sorties, decorticages, tries, approByLot, from, to]);
}

function RapportsParEntite({ from, to }: { from: string; to: string }) {
  const { appros } = usePaddy();
  const { sortiesRiz, validations } = useGestion();
  const { ventes } = useCommercial();
  const chargeLines = useChargeLines(from, to);

  const partenaires = useMemo(
    () => Array.from(new Set(appros.filter((a) => a.entity === "Partenaire").map((a) => a.entityName))),
    [appros],
  );
  const rapports = [
    { id: "capi", label: "Compte Propre (CAPI)" },
    ...partenaires.map((p) => ({ id: p, label: `Partenaire — ${p}` })),
    { id: "prestataires", label: "Prestataires / Tiers" },
  ];
  const [selected, setSelected] = useState("capi");

  const validationByKey = useMemo(() => {
    const map = new Map<string, (typeof validations)[number]>();
    for (const v of validations) map.set(`${v.sourceTable}:${v.sourceId}`, v);
    return map;
  }, [validations]);

  return (
    <div className="space-y-4">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="h-9 px-3 rounded-md border border-border bg-card text-sm"
      >
        {rapports.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
      </select>

      {selected === "capi" && <RapportCapi from={from} to={to} chargeLines={chargeLines} ventes={ventes} />}
      {selected === "prestataires" && (
        <RapportPrestataires from={from} to={to} appros={appros} chargeLines={chargeLines} validationByKey={validationByKey} />
      )}
      {selected !== "capi" && selected !== "prestataires" && (
        <RapportPartenaire
          entityName={selected} from={from} to={to} appros={appros} sortiesRiz={sortiesRiz}
          chargeLines={chargeLines} validationByKey={validationByKey}
        />
      )}
    </div>
  );
}

function RapportCapi({
  from, to, chargeLines, ventes,
}: { from: string; to: string; chargeLines: ChargeLine[]; ventes: ReturnType<typeof useCommercial>["ventes"] }) {
  const lignesCapi = chargeLines.filter((l) => l.entity === "CAPI" || l.entity === "Prestataire" || l.entity === null);
  const depenses = lignesCapi.reduce((s, l) => s + l.montant, 0);
  const recettes = ventes.filter((v) => inRange(v.date, from, to)).reduce((s, v) => s + v.montant, 0);
  const marge = recettes - depenses;
  const margePct = recettes > 0 ? (marge / recettes) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-lg">Compte Propre (CAPI)</h3>
        <ExportButtons
          filename="rapport-capi"
          title="Rapport Compte Propre (CAPI)"
          subtitle={`${from} → ${to}`}
          columns={["Date", "N° Lot", "Centre", "Libellé", "Montant"]}
          rows={lignesCapi.map((l) => [l.date, l.lotId, l.centre, l.libelle, fcfa(l.montant)])}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <StatCard label="Recettes" value={`${fcfaCompact(recettes)} F`} />
        <StatCard label="Dépenses" value={`${fcfaCompact(depenses)} F`} tone="secondary" />
        <StatCard label="Marge nette" value={`${margePct >= 0 ? "+" : ""}${margePct.toFixed(0)} %`} hint={`${fcfaCompact(marge)} F`} tone="gold" />
      </div>
      <DataTable
        columns={["Date", "N° Lot", "Centre", "Libellé", "Montant"]}
        rows={lignesCapi.map((l) => [l.date, l.lotId, l.centre, l.libelle, fcfa(l.montant)])}
      />
    </div>
  );
}

function RapportPartenaire({
  entityName, from, to, appros, sortiesRiz, chargeLines, validationByKey,
}: {
  entityName: string; from: string; to: string; appros: Appro[];
  sortiesRiz: ReturnType<typeof useGestion>["sortiesRiz"];
  chargeLines: ChargeLine[];
  validationByKey: Map<string, ReturnType<typeof useGestion>["validations"][number]>;
}) {
  const mesLots = useMemo(() => appros.filter((a) => a.entityName === entityName), [appros, entityName]);
  const lotIds = useMemo(() => new Set(mesLots.map((a) => a.id)), [mesLots]);

  const volumePaddyKg = mesLots.filter((a) => inRange(a.dateAppro, from, to)).reduce((s, a) => s + a.poids, 0);
  const couts = chargeLines.filter((l) => l.entityName === entityName);
  const totalCouts = couts.reduce((s, l) => s + l.montant, 0);

  const ventesRiz = sortiesRiz.filter((s) => lotIds.has(s.lotId) && inRange(s.date, from, to));
  const volumeRizVenduKg = ventesRiz.reduce((s, v) => s + v.quantite, 0);
  const totalVentes = ventesRiz.reduce((s, v) => s + v.montant, 0);

  const soldeNet = totalVentes - totalCouts;
  const aEncaisser = ventesRiz
    .filter((v) => {
      const val = validationByKey.get(`sorties_riz:${v.id}`);
      return !val || val.status !== "validee";
    })
    .reduce((s, v) => s + v.montant, 0);

  const rows = [
    ...couts.map((l) => [l.date, l.lotId, `Débit — ${l.centre}`, l.libelle, `-${fcfa(l.montant)}`]),
    ...ventesRiz.map((v) => [v.date, v.lotId, "Crédit — Vente riz", v.categorie, `+${fcfa(v.montant)}`]),
  ].sort((x, y) => (String(x[0]) < String(y[0]) ? 1 : -1));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-lg">Partenaire — {entityName}</h3>
        <ExportButtons
          filename={`rapport-partenaire-${entityName}`}
          title={`Rapport Partenaire — ${entityName}`}
          subtitle={`${from} → ${to}`}
          columns={["Date", "N° Lot", "Type", "Libellé", "Montant"]}
          rows={rows}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <StatCard label="Paddy entré" value={`${(volumePaddyKg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`} />
        <StatCard label="Coûts supportés" value={`${fcfaCompact(totalCouts)} F`} tone="secondary" />
        <StatCard label="Riz vendu" value={`${(volumeRizVenduKg / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} t`} tone="gold" />
        <StatCard
          label={soldeNet >= 0 ? "Solde net à lui verser" : "Solde net qu'il doit à CAPI"}
          value={`${fcfaCompact(Math.abs(soldeNet))} F`}
        />
      </div>
      <p className="text-xs text-muted-foreground mb-2">Dont {fcfa(aEncaisser)} FCFA encore en attente de validation.</p>
      <DataTable columns={["Date", "N° Lot", "Type", "Libellé", "Montant"]} rows={rows} />
    </div>
  );
}

function RapportPrestataires({
  from, to, appros, chargeLines, validationByKey,
}: {
  from: string; to: string; appros: Appro[]; chargeLines: ChargeLine[];
  validationByKey: Map<string, ReturnType<typeof useGestion>["validations"][number]>;
}) {
  const lignes = chargeLines.filter((l) => l.entity === "Prestataire" && l.centre === "Approvisionnement");
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  const enAttente = lignes
    .filter((l) => {
      const v = validationByKey.get(`${l.sourceTable}:${l.sourceId}`);
      return !v || v.status !== "validee";
    })
    .reduce((s, l) => s + l.montant, 0);

  const rows = lignes.map((l) => {
    const v = validationByKey.get(`${l.sourceTable}:${l.sourceId}`);
    const statut = v?.status === "validee" ? "Encaissé" : v?.status === "rejetee" ? "Rejeté" : "En attente";
    return [l.date, l.entityName ?? "—", l.lotId, fcfa(l.montant), statut];
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-lg">Prestataires / Tiers</h3>
        <ExportButtons
          filename="rapport-prestataires"
          title="Rapport Prestataires / Tiers"
          subtitle={`${from} → ${to}`}
          columns={["Date", "Prestataire", "N° Lot", "Montant facturé", "Statut"]}
          rows={rows}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <StatCard label="Total facturé" value={`${fcfaCompact(total)} F`} />
        <StatCard label="En attente d'encaissement" value={`${fcfaCompact(enAttente)} F`} tone="secondary" />
        <StatCard label="Prestations" value={String(lignes.length)} tone="gold" />
      </div>
      <DataTable columns={["Date", "Prestataire", "N° Lot", "Montant facturé", "Statut"]} rows={rows} />
    </div>
  );
}
