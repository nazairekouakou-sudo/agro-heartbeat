import { RequireRole } from "@/components/RequireRole";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Sprout,
  Factory,
  Truck,
  Wallet,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Wheat,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AppTopbar } from "@/components/AppTopbar";
import { usePaddy, type Appro } from "@/lib/paddyStore";
import { useUsinage } from "@/lib/usinageStore";
import { useGestion } from "@/lib/gestionStore";
import { useCommercial } from "@/lib/commercialStore";
import { useComptable } from "@/lib/comptableStore";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAPI ERP — Tableau de bord global" },
      {
        name: "description",
        content:
          "Pilotage temps réel du Complexe Agro Pastoral & Industriel : paddy, usinage, commercial et partenaires.",
      },
    ],
  }),
  component: () => (
   <RequireRole roles={["admin", "gestion"]}>
      <Dashboard />
    </RequireRole>
  ),
});

// ---------- Helpers ----------
function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function inRange(date: string, from: string, to: string) {
  return date >= from && date <= to;
}
function tonnes(kg: number) {
  return kg / 1000;
}
function fmtT(kg: number) {
  return `${tonnes(kg).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`;
}
function fcfaCompact(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " Md";
  if (n >= 1_000_000) return (n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 }) + " M";
  return Math.round(n).toLocaleString("fr-FR");
}
function pctDelta(current: number, previous: number) {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
function thisMonth(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function lastMonthRange() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

function Dashboard() {
  const { appros } = usePaddy();
  const { decorticages } = useUsinage();
  const { sortiesRiz, validations } = useGestion();
  const { ventes, versements } = useCommercial();
  const { factures } = useComptable();

  const approByLot = useMemo(() => new Map(appros.map((a) => [a.id, a])), [appros]);

  // ---------- KPI ----------
  const paddy7 = useMemo(
    () => appros.filter((a) => inRange(a.dateEntree, daysAgoISO(6), daysAgoISO(0))).reduce((s, a) => s + (a.poids ?? 0), 0),
    [appros],
  );
  const paddyPrev7 = useMemo(
    () => appros.filter((a) => inRange(a.dateEntree, daysAgoISO(13), daysAgoISO(7))).reduce((s, a) => s + (a.poids ?? 0), 0),
    [appros],
  );
  const paddyDelta = pctDelta(paddy7, paddyPrev7);

  const totalRizBlanchi = useMemo(() => decorticages.reduce((s, d) => s + d.rizBlanchi, 0), [decorticages]);
  const totalPaddyUsine = useMemo(() => decorticages.reduce((s, d) => s + d.poidsPaddy, 0), [decorticages]);
  const rendementMoyen = totalPaddyUsine > 0 ? (totalRizBlanchi / totalPaddyUsine) * 100 : 0;

  const commandesTotal = sortiesRiz.length;
  const commandesPartenaires = useMemo(
    () => sortiesRiz.filter((s) => approByLot.get(s.lotId)?.entity === "Partenaire").length,
    [sortiesRiz, approByLot],
  );

  const caMois = useMemo(
    () =>
      ventes.filter((v) => thisMonth(v.date)).reduce((s, v) => s + v.montant, 0) +
      factures.filter((f) => thisMonth(f.date)).reduce((s, f) => s + f.montantFacture, 0),
    [ventes, factures],
  );
  const { from: prevFrom, to: prevTo } = lastMonthRange();
  const caMoisPrec = useMemo(
    () =>
      ventes.filter((v) => inRange(v.date, prevFrom, prevTo)).reduce((s, v) => s + v.montant, 0) +
      factures.filter((f) => inRange(f.date, prevFrom, prevTo)).reduce((s, f) => s + f.montantFacture, 0),
    [ventes, factures, prevFrom, prevTo],
  );
  const caDelta = pctDelta(caMois, caMoisPrec);

  // ---------- Flux paddy 7 jours par modèle ----------
  const paddyFlow = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => 6 - i).map((n) => daysAgoISO(n));
    return days.map((date) => {
      const dayLots = appros.filter((a) => a.dateEntree === date);
      const label = new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short" });
      return {
        m: label.charAt(0).toUpperCase() + label.slice(1),
        propre: +tonnes(dayLots.filter((a) => a.entity === "CAPI").reduce((s, a) => s + (a.poids ?? 0), 0)).toFixed(1),
        partenaires: +tonnes(dayLots.filter((a) => a.entity === "Partenaire").reduce((s, a) => s + (a.poids ?? 0), 0)).toFixed(1),
        prestations: +tonnes(dayLots.filter((a) => a.entity === "Prestataire").reduce((s, a) => s + (a.poids ?? 0), 0)).toFixed(1),
      };
    });
  }, [appros]);

  // ---------- Répartition par modèle (tout l'historique) ----------
  const repartition = useMemo(() => {
    const total = appros.reduce((s, a) => s + (a.poids ?? 0), 0);
    if (total === 0) return [];
    const parts: [string, string, number][] = [
      ["Compte propre", "var(--color-primary)", appros.filter((a) => a.entity === "CAPI").reduce((s, a) => s + (a.poids ?? 0), 0)],
      ["Partenaires", "var(--color-secondary)", appros.filter((a) => a.entity === "Partenaire").reduce((s, a) => s + (a.poids ?? 0), 0)],
      ["Prestations tiers", "var(--color-gold)", appros.filter((a) => a.entity === "Prestataire").reduce((s, a) => s + (a.poids ?? 0), 0)],
    ];
    return parts.filter(([, , v]) => v > 0).map(([name, color, v]) => ({ name, color, value: Math.round((v / total) * 100) }));
  }, [appros]);

  // ---------- Rendement usinage — 7 dernières semaines ----------
  const rendementParSemaine = useMemo(() => {
    function weekKey(dateStr: string) {
      const d = new Date(dateStr + "T00:00:00");
      const onejan = new Date(d.getFullYear(), 0, 1);
      const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
      return `${d.getFullYear()}-${String(week).padStart(2, "0")}`;
    }
    const map = new Map<string, { riz: number; paddy: number }>();
    for (const d of decorticages) {
      const k = weekKey(d.date);
      const cur = map.get(k) ?? { riz: 0, paddy: 0 };
      cur.riz += d.rizBlanchi;
      cur.paddy += d.poidsPaddy;
      map.set(k, cur);
    }
    const sorted = Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-7);
    return sorted.map(([k, v], i, arr) => ({
      j: i === arr.length - 1 ? "S" : `S-${arr.length - 1 - i}`,
      rendement: v.paddy > 0 ? Math.round((v.riz / v.paddy) * 100) : 0,
    }));
  }, [decorticages]);

  const rendementActuel = rendementParSemaine.length ? rendementParSemaine[rendementParSemaine.length - 1].rendement : 0;
  const rendementPrecedent = rendementParSemaine.length > 1 ? rendementParSemaine[rendementParSemaine.length - 2].rendement : 0;

  // ---------- Partenaires actifs ----------
  const partenairesActifs = useMemo(() => {
    const byName = new Map<string, Appro[]>();
    for (const a of appros.filter((a) => a.entity === "Partenaire")) {
      byName.set(a.entityName, [...(byName.get(a.entityName) ?? []), a]);
    }
    return Array.from(byName.entries()).map(([nom, lots]) => {
      const stockKg = lots.filter((a) => a.status === "Collecte" || a.status === "En séchage" || a.status === "Stocké").reduce((s, a) => s + (a.poids ?? 0), 0);
      const actif = lots.some((a) => a.dateEntree >= daysAgoISO(45));
      return { nom, lots: lots.length, stock: fmtT(stockKg), statut: actif ? "Actif" : "En attente" };
    });
  }, [appros]);

  // ---------- Activités récentes (fusion multi-services) ----------
  type Activite = { type: string; ref: string; partie: string; modele: string; qte: string; date: string; tone: "success" | "primary" | "gold" | "info" };
  const activites = useMemo(() => {
    const items: Activite[] = [];
    for (const a of appros.slice(0, 6)) {
      items.push({
        type: "Entrée paddy", ref: a.id, partie: a.entityName,
        modele: a.entity === "CAPI" ? "Compte propre" : a.entity === "Partenaire" ? "Partenaire" : "Prestataire",
        qte: fmtT(a.poids ?? 0), date: a.dateEntree, tone: "success",
      });
    }
    for (const s of sortiesRiz.slice(0, 6)) {
      const a = approByLot.get(s.lotId);
      items.push({
        type: "Vente riz", ref: s.commandeId ?? s.id, partie: s.boutique ?? a?.entityName ?? "—",
        modele: a?.entity === "CAPI" || !a ? "Compte propre" : "Partenaire",
        qte: `${s.quantite.toLocaleString("fr-FR")} kg`, date: s.date, tone: "primary",
      });
    }
    for (const f of factures.slice(0, 6)) {
      items.push({ type: "Facturation", ref: f.id, partie: f.tiers, modele: "Prestation", qte: `${fcfaCompact(f.montantFacture)} FCFA`, date: f.date, tone: "gold" });
    }
    for (const v of versements.slice(0, 6)) {
      items.push({ type: "Versement caisse", ref: v.id, partie: `Boutique ${v.boutique}`, modele: "Compte propre", qte: `${fcfaCompact(v.montantVerse)} FCFA`, date: v.date, tone: "info" });
    }
    return items.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0)).slice(0, 8);
  }, [appros, sortiesRiz, factures, versements, approByLot]);

  const aValiderCount = useMemo(() => validations.filter((v) => v.status === "en_attente").length, [validations]);

  return (
    <>
      <AppTopbar eyebrow="Administration" title="Tableau de bord global" />
      <div className="p-6 space-y-6 overflow-y-auto">
        {/* Hero band */}
        <section className="card-elevated overflow-hidden relative">
          <div className="absolute inset-0 gradient-primary opacity-[0.97]" />
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-gold/20 blur-3xl" />
          <div className="relative p-6 md:p-8 grid md:grid-cols-3 gap-6 text-primary-foreground">
            <div className="md:col-span-2">
              <div className="text-[11px] uppercase tracking-widest text-primary-foreground/70">
                Vue temps réel · {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <h2 className="font-display text-3xl md:text-4xl mt-2 leading-tight">
                Chaîne de valeur du riz sous contrôle
              </h2>
              <p className="mt-3 text-sm text-primary-foreground/80 max-w-xl">
                Suivi consolidé des flux physiques et financiers pour les trois modèles d'activité : compte propre,
                partenaires et prestations à façon.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Compte propre", "Partenaires", "Prestations tiers"].map((t, i) => (
                  <span key={t} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-primary-foreground/10 border border-primary-foreground/15">
                    <span className="size-1.5 rounded-full" style={{ background: i === 0 ? "oklch(0.9 0.03 85)" : i === 1 ? "oklch(0.74 0.09 75)" : "oklch(0.85 0.06 80)" }} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 content-center">
              <MiniStat label="Paddy 7j" value={fmtT(paddy7)} delta={paddyDelta} />
              <MiniStat label="Riz blanc produit" value={fmtT(totalRizBlanchi)} delta={null} />
              <MiniStat label="Rendement" value={`${rendementMoyen.toFixed(0)}%`} delta={null} />
              <MiniStat label="CA mois" value={`${fcfaCompact(caMois)} F`} delta={caDelta} />
            </div>
          </div>
        </section>

        {/* KPI row */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Kpi icon={Sprout} label="Paddy collecté (7j)" value={fmtT(paddy7)} delta={paddyDelta} tone="primary" hint="Toutes origines confondues" />
          <Kpi icon={Factory} label="Riz blanc produit (cumul)" value={fmtT(totalRizBlanchi)} delta={null} tone="secondary" hint={`Rendement moyen ${rendementMoyen.toFixed(0)}%`} />
          <Kpi icon={Truck} label="Commandes riz" value={String(commandesTotal)} delta={null} tone="gold" hint={`Dont ${commandesPartenaires} lots partenaires`} />
          <Kpi icon={Wallet} label="Chiffre d'affaires" value={`${fcfaCompact(caMois)} FCFA`} delta={caDelta} tone="dark" hint="Mois en cours" />
        </section>

        {/* Charts row */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card-elevated p-5 xl:col-span-2">
            <div className="mb-4">
              <h3 className="font-display text-lg">Flux paddy par modèle d'activité</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tonnes reçues sur les 7 derniers jours</p>
            </div>
            <div className="h-72">
              {paddyFlow.every((d) => d.propre + d.partenaires + d.prestations === 0) ? (
                <EmptyChart label="Aucune entrée paddy sur les 7 derniers jours" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={paddyFlow} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.32 0.06 160)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="oklch(0.32 0.06 160)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.5 0.09 155)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="oklch(0.5 0.09 155)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.74 0.09 75)" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="oklch(0.74 0.09 75)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="oklch(0.87 0.02 85)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="m" stroke="oklch(0.42 0.02 140)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="oklch(0.42 0.02 140)" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Area type="monotone" dataKey="propre" name="Compte propre" stroke="oklch(0.32 0.06 160)" fill="url(#g1)" strokeWidth={2} />
                    <Area type="monotone" dataKey="partenaires" name="Partenaires" stroke="oklch(0.5 0.09 155)" fill="url(#g2)" strokeWidth={2} />
                    <Area type="monotone" dataKey="prestations" name="Prestations" stroke="oklch(0.74 0.09 75)" fill="url(#g3)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card-elevated p-5">
            <div className="mb-4">
              <h3 className="font-display text-lg">Répartition</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Part de chaque modèle (volume paddy cumulé)</p>
            </div>
            {repartition.length === 0 ? (
              <EmptyChart label="Aucune donnée" small />
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={repartition} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="none">
                        {repartition.map((e) => <Cell key={e.name} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {repartition.map((r) => (
                    <div key={r.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="size-2.5 rounded-sm" style={{ background: r.color }} />
                        <span className="text-foreground/80">{r.name}</span>
                      </div>
                      <span className="font-medium tabular-nums">{r.value}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Second row: usinage + partenaires */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="card-elevated p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-display text-lg">Rendement usinage</h3>
                <p className="text-xs text-muted-foreground mt-0.5">% riz blanc / paddy — 7 dernières semaines</p>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl leading-none">{rendementActuel}%</div>
                {rendementPrecedent > 0 && (
                  <div className={`text-[11px] flex items-center gap-0.5 justify-end mt-1 ${rendementActuel >= rendementPrecedent ? "text-success" : "text-destructive"}`}>
                    {rendementActuel >= rendementPrecedent ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
                    {(rendementActuel - rendementPrecedent).toFixed(0)} pt
                  </div>
                )}
              </div>
            </div>
            <div className="h-44">
              {rendementParSemaine.length === 0 ? (
                <EmptyChart label="Aucun décorticage enregistré" small />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rendementParSemaine} margin={{ top: 8, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid stroke="oklch(0.87 0.02 85)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="j" stroke="oklch(0.42 0.02 140)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="oklch(0.42 0.02 140)" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="rendement" fill="oklch(0.5 0.09 155)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card-elevated p-5 xl:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display text-lg">Partenaires actifs</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Accès cloisonné · chaque partenaire ne voit que ses données</p>
              </div>
              <span className="text-xs text-muted-foreground">{aValiderCount} opération(s) à valider</span>
            </div>
            {partenairesActifs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun partenaire pour l'instant.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr className="text-left text-xs uppercase tracking-wider">
                      <th className="px-4 py-2.5 font-medium">Partenaire</th>
                      <th className="px-4 py-2.5 font-medium">Lots actifs</th>
                      <th className="px-4 py-2.5 font-medium">Stock</th>
                      <th className="px-4 py-2.5 font-medium">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {partenairesActifs.map((p) => (
                      <tr key={p.nom} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{p.nom}</td>
                        <td className="px-4 py-3 tabular-nums">{p.lots}</td>
                        <td className="px-4 py-3 tabular-nums">{p.stock}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] ${p.statut === "Actif" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                            <span className={`size-1.5 rounded-full ${p.statut === "Actif" ? "bg-success" : "bg-warning"}`} />
                            {p.statut}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Activity feed */}
        <section className="card-elevated p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-display text-lg flex items-center gap-2">
                <Activity className="size-4 text-secondary" /> Activités récentes
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Flux physiques et financiers consolidés</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-success">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Connecté
            </span>
          </div>
          {activites.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune activité pour l'instant.</p>
          ) : (
            <ul className="divide-y divide-border">
              {activites.map((a, i) => (
                <li key={`${a.ref}-${i}`} className="py-3 flex items-center gap-4">
                  <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${a.tone === "primary" ? "bg-primary/10 text-primary" : a.tone === "gold" ? "bg-gold/20 text-gold-foreground" : a.tone === "info" ? "bg-info/15 text-info" : "bg-success/15 text-success"}`}>
                    <Package className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.type}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{a.ref}</span>
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${a.modele === "Compte propre" ? "bg-primary/10 text-primary" : a.modele === "Partenaire" ? "bg-secondary/15 text-secondary" : "bg-gold/20 text-gold-foreground"}`}>
                        {a.modele}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.partie}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium tabular-nums">{a.qte}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(a.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="pt-2 pb-6 text-center text-[11px] text-muted-foreground">
          CAPI · Complexe Agro Pastoral & Industriel — Tableau de bord temps réel
        </footer>
      </div>
    </>
  );
}

function EmptyChart({ label, small }: { label: string; small?: boolean }) {
  return (
    <div className={`h-full flex flex-col items-center justify-center text-center text-muted-foreground gap-2 ${small ? "" : ""}`}>
      <Wheat className="size-6 opacity-40" />
      <p className="text-xs max-w-[220px]">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, delta }: { label: string; value: string; delta: number | null }) {
  return (
    <div className="rounded-lg bg-primary-foreground/8 border border-primary-foreground/15 p-3 backdrop-blur">
      <div className="text-[10px] uppercase tracking-widest text-primary-foreground/60">{label}</div>
      <div className="font-display text-xl mt-1 leading-none">{value}</div>
      {delta !== null ? (
        <div className={`text-[11px] mt-1 flex items-center gap-0.5 ${delta >= 0 ? "text-gold" : "text-primary-foreground/70"}`}>
          {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
        </div>
      ) : (
        <div className="text-[11px] mt-1 text-primary-foreground/50">—</div>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, delta, hint, tone,
}: {
  icon: typeof Sprout; label: string; value: string; delta: number | null; hint: string;
  tone: "primary" | "secondary" | "gold" | "dark";
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/15 text-secondary",
    gold: "bg-gold/25 text-gold-foreground",
    dark: "bg-foreground/10 text-foreground",
  };
  return (
    <div className="card-elevated p-5 group hover:-translate-y-0.5 transition-transform">
      <div className="flex items-start justify-between">
        <div className={`size-11 rounded-xl flex items-center justify-center ${toneMap[tone]}`}>
          <Icon className="size-5" />
        </div>
        {delta !== null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${delta < 0 ? "text-destructive" : "text-success"}`}>
            {delta < 0 ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
            {delta >= 0 ? "+" : ""}{delta.toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-2xl mt-1 leading-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
      </div>
    </div>
  );
}
