import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Sprout,
  Factory,
  Truck,
  Wallet,
  Users,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  LayoutDashboard,
  Warehouse,
  ShoppingCart,
  FileBarChart,
  Settings,
  Bell,
  Search,
  Wheat,
  CircleDot,
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
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AppTopbar } from "@/components/AppTopbar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CAPI ERP — Tableau de bord global" },
      {
        name: "description",
        content:
          "Pilotage temps réel du Complexe Agro Pastoral & Industriel : paddy, usinage, commercial et partenaires.",
      },
      { property: "og:title", content: "CAPI ERP — Tableau de bord global" },
      {
        property: "og:description",
        content:
          "Suivi en temps réel des trois modèles d'activités du CAPI : compte propre, partenaires, prestations.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Dashboard,
});

const nav = [
  { icon: LayoutDashboard, label: "Tableau de bord", active: true },
  { icon: Sprout, label: "Paddy & collecte" },
  { icon: Factory, label: "Usinage" },
  { icon: Warehouse, label: "Stocks" },
  { icon: ShoppingCart, label: "Commercial" },
  { icon: Users, label: "Partenaires" },
  { icon: Wallet, label: "Comptabilité" },
  { icon: FileBarChart, label: "Rapports" },
  { icon: Settings, label: "Paramètres" },
];

const paddyFlow = [
  { m: "Lun", propre: 240, partenaires: 180, prestations: 90 },
  { m: "Mar", propre: 280, partenaires: 210, prestations: 110 },
  { m: "Mer", propre: 260, partenaires: 240, prestations: 95 },
  { m: "Jeu", propre: 310, partenaires: 260, prestations: 130 },
  { m: "Ven", propre: 340, partenaires: 220, prestations: 160 },
  { m: "Sam", propre: 300, partenaires: 280, prestations: 140 },
  { m: "Dim", propre: 190, partenaires: 150, prestations: 70 },
];

const usinage = [
  { j: "S-6", rendement: 64 },
  { j: "S-5", rendement: 66 },
  { j: "S-4", rendement: 65 },
  { j: "S-3", rendement: 68 },
  { j: "S-2", rendement: 67 },
  { j: "S-1", rendement: 70 },
  { j: "S", rendement: 69 },
];

const repartition = [
  { name: "Compte propre", value: 52, color: "var(--color-primary)" },
  { name: "Partenaires", value: 33, color: "var(--color-secondary)" },
  { name: "Prestations tiers", value: 15, color: "var(--color-gold)" },
];

const activites = [
  {
    type: "Entrée paddy",
    ref: "PAD-2409-0231",
    partie: "Coopérative Ndiaye",
    modele: "Partenaire",
    qte: "12,4 t",
    time: "il y a 4 min",
    tone: "success",
  },
  {
    type: "Sortie usinage",
    ref: "USI-2409-0117",
    partie: "Lot CAPI-A12",
    modele: "Compte propre",
    qte: "8,7 t riz blanc",
    time: "il y a 22 min",
    tone: "primary",
  },
  {
    type: "Prestation à façon",
    ref: "PRE-2409-0044",
    partie: "M. Diouf (particulier)",
    modele: "Prestation",
    qte: "1,2 t",
    time: "il y a 1 h",
    tone: "gold",
  },
  {
    type: "Facturation",
    ref: "FAC-2409-0812",
    partie: "GIE Fanaye",
    modele: "Partenaire",
    qte: "3 240 000 FCFA",
    time: "il y a 2 h",
    tone: "info",
  },
  {
    type: "Livraison client",
    ref: "LIV-2409-0301",
    partie: "Auchan Dakar",
    modele: "Compte propre",
    qte: "24 t",
    time: "il y a 3 h",
    tone: "primary",
  },
];

const partenaires = [
  { nom: "Coopérative Ndiaye", lots: 14, stock: "184 t", statut: "Actif" },
  { nom: "GIE Fanaye", lots: 9, stock: "72 t", statut: "Actif" },
  { nom: "Union des Producteurs Podor", lots: 21, stock: "310 t", statut: "Actif" },
  { nom: "Coop. Rosso-Sénégal", lots: 6, stock: "48 t", statut: "En attente" },
];

function Dashboard() {
  const totalPaddy = useMemo(
    () => paddyFlow.reduce((a, b) => a + b.propre + b.partenaires + b.prestations, 0),
    []
  );

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
                  Vue temps réel · {new Date().toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </div>
                <h2 className="font-display text-3xl md:text-4xl mt-2 leading-tight">
                  Chaîne de valeur du riz sous contrôle
                </h2>
                <p className="mt-3 text-sm text-primary-foreground/80 max-w-xl">
                  Suivi consolidé des flux physiques et financiers pour les trois modèles
                  d'activité : compte propre, partenaires et prestations à façon.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {["Compte propre", "Partenaires", "Prestations tiers"].map((t, i) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-primary-foreground/10 border border-primary-foreground/15"
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{
                          background:
                            i === 0
                              ? "oklch(0.9 0.03 85)"
                              : i === 1
                                ? "oklch(0.74 0.09 75)"
                                : "oklch(0.85 0.06 80)",
                        }}
                      />
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 content-center">
                <MiniStat label="Paddy J" value="712 t" delta="+8,4%" up />
                <MiniStat label="Riz blanc J" value="486 t" delta="+5,1%" up />
                <MiniStat label="Rendement" value="69%" delta="+1,2 pt" up />
                <MiniStat label="CA jour" value="184 M" delta="−2,3%" />
              </div>
            </div>
          </section>

          {/* KPI row */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi
              icon={Sprout}
              label="Paddy collecté (7j)"
              value={`${totalPaddy.toLocaleString("fr-FR")} t`}
              delta="+12,4%"
              tone="primary"
              hint="Toutes origines confondues"
            />
            <Kpi
              icon={Factory}
              label="Usinage cumulé"
              value="3 128 t"
              delta="+6,1%"
              tone="secondary"
              hint="Rendement moyen 68,4%"
            />
            <Kpi
              icon={Truck}
              label="Livraisons"
              value="214"
              delta="+4,8%"
              tone="gold"
              hint="Dont 62 lots partenaires"
            />
            <Kpi
              icon={Wallet}
              label="Chiffre d'affaires"
              value="1,24 Md FCFA"
              delta="−1,9%"
              tone="dark"
              hint="Mois en cours"
              down
            />
          </section>

          {/* Charts row */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="card-elevated p-5 xl:col-span-2">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg">Flux paddy par modèle d'activité</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tonnes reçues sur les 7 derniers jours
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  {["7j", "30j", "Campagne"].map((r, i) => (
                    <button
                      key={r}
                      className={`px-2.5 py-1 rounded-md border ${
                        i === 0
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-72">
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
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Area
                      type="monotone"
                      dataKey="propre"
                      name="Compte propre"
                      stroke="oklch(0.32 0.06 160)"
                      fill="url(#g1)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="partenaires"
                      name="Partenaires"
                      stroke="oklch(0.5 0.09 155)"
                      fill="url(#g2)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="prestations"
                      name="Prestations"
                      stroke="oklch(0.74 0.09 75)"
                      fill="url(#g3)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-elevated p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg">Répartition</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Part de chaque modèle (volume mois)
                  </p>
                </div>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={repartition}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {repartition.map((e) => (
                        <Cell key={e.name} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
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
            </div>
          </section>

          {/* Second row: usinage + partenaires */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="card-elevated p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-display text-lg">Rendement usinage</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    % riz blanc / paddy — 7 dernières semaines
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-display text-2xl leading-none">69%</div>
                  <div className="text-[11px] text-success flex items-center gap-0.5 justify-end mt-1">
                    <ArrowUpRight className="size-3" /> +2,1 pt
                  </div>
                </div>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={usinage} margin={{ top: 8, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid stroke="oklch(0.87 0.02 85)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="j" stroke="oklch(0.42 0.02 140)" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="oklch(0.42 0.02 140)" fontSize={11} tickLine={false} axisLine={false} domain={[55, 75]} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="rendement" fill="oklch(0.5 0.09 155)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card-elevated p-5 xl:col-span-2">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display text-lg">Partenaires actifs</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Accès cloisonné · chaque partenaire ne voit que ses données
                  </p>
                </div>
                <button className="text-xs text-secondary hover:underline">
                  Gérer les accès →
                </button>
              </div>
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
                    {partenaires.map((p) => (
                      <tr key={p.nom} className="hover:bg-muted/40">
                        <td className="px-4 py-3 font-medium">{p.nom}</td>
                        <td className="px-4 py-3 tabular-nums">{p.lots}</td>
                        <td className="px-4 py-3 tabular-nums">{p.stock}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] ${
                              p.statut === "Actif"
                                ? "bg-success/15 text-success"
                                : "bg-warning/15 text-warning"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                p.statut === "Actif" ? "bg-success" : "bg-warning"
                              }`}
                            />
                            {p.statut}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Activity feed */}
          <section className="card-elevated p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display text-lg flex items-center gap-2">
                  <Activity className="size-4 text-secondary" />
                  Activités temps réel
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Flux physiques et financiers consolidés
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs text-success">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                Connecté
              </span>
            </div>
            <ul className="divide-y divide-border">
              {activites.map((a) => (
                <li key={a.ref} className="py-3 flex items-center gap-4">
                  <div
                    className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
                      a.tone === "primary"
                        ? "bg-primary/10 text-primary"
                        : a.tone === "gold"
                          ? "bg-gold/20 text-gold-foreground"
                          : a.tone === "info"
                            ? "bg-info/15 text-info"
                            : "bg-success/15 text-success"
                    }`}
                  >
                    <Package className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{a.type}</span>
                      <span className="text-[11px] font-mono text-muted-foreground">{a.ref}</span>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          a.modele === "Compte propre"
                            ? "bg-primary/10 text-primary"
                            : a.modele === "Partenaire"
                              ? "bg-secondary/15 text-secondary"
                              : "bg-gold/20 text-gold-foreground"
                        }`}
                      >
                        {a.modele}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{a.partie}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium tabular-nums">{a.qte}</div>
                    <div className="text-[11px] text-muted-foreground">{a.time}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <footer className="pt-2 pb-6 text-center text-[11px] text-muted-foreground">
            CAPI · Complexe Agro Pastoral & Industriel — Prototype V1 du tableau de bord global
          </footer>
      </div>
    </>
  );
}

function MiniStat({
  label,
  value,
  delta,
  up,
}: {
  label: string;
  value: string;
  delta: string;
  up?: boolean;
}) {
  return (
    <div className="rounded-lg bg-primary-foreground/8 border border-primary-foreground/15 p-3 backdrop-blur">
      <div className="text-[10px] uppercase tracking-widest text-primary-foreground/60">
        {label}
      </div>
      <div className="font-display text-xl mt-1 leading-none">{value}</div>
      <div
        className={`text-[11px] mt-1 flex items-center gap-0.5 ${
          up ? "text-gold" : "text-primary-foreground/70"
        }`}
      >
        {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
        {delta}
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  delta,
  hint,
  tone,
  down,
}: {
  icon: typeof Sprout;
  label: string;
  value: string;
  delta: string;
  hint: string;
  tone: "primary" | "secondary" | "gold" | "dark";
  down?: boolean;
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
        <span
          className={`inline-flex items-center gap-0.5 text-xs font-medium ${
            down ? "text-destructive" : "text-success"
          }`}
        >
          {down ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
          {delta}
        </span>
      </div>
      <div className="mt-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-display text-2xl mt-1 leading-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>
      </div>
    </div>
  );
}
