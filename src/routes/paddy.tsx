import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { Plus, Filter, Search, X, Timer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePaddy, paddyActions, type Entity, type LotStatus } from "@/lib/paddyStore";

export const Route = createFileRoute("/paddy")({
  head: () => ({
    meta: [
      { title: "Service Paddy — CAPI ERP" },
      { name: "description", content: "Saisie terrain, séchage, sorties et suivi financier des lots de paddy avec traçabilité par N° Lot." },
    ],
  }),
  component: PaddyPage,
});

const tabs = [
  { id: "appro", label: "Approvisionnement" },
  { id: "sechage", label: "Séchage" },
  { id: "sortie", label: "Sortie" },
  { id: "financier", label: "Suivi financier" },
] as const;
type TabId = (typeof tabs)[number]["id"];

function PaddyPage() {
  const [tab, setTab] = useState<TabId>("appro");
  const [query, setQuery] = useState("");
  const [openNew, setOpenNew] = useState<null | "appro" | "sechage" | "sortie">(null);
  const [detailLot, setDetailLot] = useState<string | null>(null);
  const { appros, sechages, sorties } = usePaddy();

  const filteredAppros = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return appros;
    return appros.filter((a) =>
      [a.id, a.zone, a.entityName, a.variete, a.agent].some((v) => v.toLowerCase().includes(q))
    );
  }, [appros, query]);

  const totalStock = appros.reduce((s, a) => s + a.poids, 0);
  const thAvg = appros.length ? appros.reduce((s, a) => s + a.th, 0) / appros.length : 0;
  const enSechage = appros.filter((a) => a.status === "En séchage").length;

  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Paddy" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Paddy"
          description="Coordonne collecte, séchage et sorties. Chaque lot est tracé de son entrée à sa sortie."
          actions={
            <>
              <div className="relative">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher N° Lot, zone, entité…"
                  className="h-9 pl-8 w-64"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5"><Filter className="size-4" /> Filtrer</Button>
              <Button size="sm" className="gap-1.5" onClick={() => setOpenNew(tab === "sechage" ? "sechage" : tab === "sortie" ? "sortie" : "appro")}>
                <Plus className="size-4" /> Nouvelle opération
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Lots actifs" value={String(appros.length)} hint="Toutes entités" />
          <StatCard label="Paddy en stock" value={`${(totalStock / 1000).toFixed(1)} t`} hint="Poids courant" tone="secondary" />
          <StatCard label="TH moyen" value={`${thAvg.toFixed(1)} %`} hint="Lots en cours" tone="gold" />
          <StatCard label="En séchage" value={String(enSechage)} hint="Lots actifs" />
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "appro" && (
          <DataTable
            columns={["N° Lot", "Date entrée", "Zone", "Entité", "Variété", "TH", "TI", "Sacs", "Poids (kg)", "PM", "Statut", "Agent"]}
            rows={filteredAppros.map((a) => [
              <button className="text-primary hover:underline font-medium" onClick={() => setDetailLot(a.id)}>{a.id}</button>,
              fmtDate(a.dateEntree),
              a.zone,
              <EntityBadge k={a.entity} name={a.entityName} />,
              a.variete,
              `${a.th}%`,
              `${a.ti}%`,
              a.sacs,
              a.poids.toLocaleString("fr-FR"),
              a.pm,
              <StatusBadge s={a.status} />,
              a.agent,
            ])}
            empty="Aucun lot correspondant."
          />
        )}

        {tab === "sechage" && (
          <DataTable
            columns={["Date", "N° Lot", "TH init.", "Sacs", "Poids avant", "Jours", "TH après", "Poids après", "Variation", "Agent"]}
            rows={sechages.map((s) => [
              fmtDate(s.date),
              <button className="text-primary hover:underline" onClick={() => setDetailLot(s.lotId)}>{s.lotId}</button>,
              `${s.thInitial}%`, s.sacs, s.poidsAvant.toLocaleString("fr-FR"),
              s.jours, `${s.thApres}%`, s.poidsApres.toLocaleString("fr-FR"),
              <span className={s.variation < 0 ? "text-destructive" : ""}>{s.variation}</span>,
              s.agent,
            ])}
          />
        )}

        {tab === "sortie" && (
          <DataTable
            columns={["Date", "N° Lot", "TH", "Sacs", "Poids (kg)", "PM", "Destination", "Agent"]}
            rows={sorties.map((s) => [
              fmtDate(s.date),
              <button className="text-primary hover:underline" onClick={() => setDetailLot(s.lotId)}>{s.lotId}</button>,
              `${s.th}%`, s.sacs, s.poids.toLocaleString("fr-FR"), s.pm, s.destination, s.agent,
            ])}
          />
        )}

        {tab === "financier" && (
          <div className="space-y-6">
            <section>
              <h3 className="font-display text-lg mb-2">Charges d'approvisionnement (CAP + annexes)</h3>
              <DataTable
                columns={["N° Lot", "Poids", "PU", "CAP", "Chargé", "Pesé", "Déchargé", "Transport", "Annexes", "Prime", "Charge totale"]}
                rows={appros.map((a) => [
                  a.id, a.poids.toLocaleString("fr-FR"), a.pu,
                  fcfa(a.cap), fcfa(a.charge), fcfa(a.pesage), fcfa(a.dechargement),
                  fcfa(a.transport), fcfa(a.fraisAnnexes), fcfa(a.prime),
                  <strong>{fcfa(a.chargeTotale)}</strong>,
                ])}
              />
            </section>
            <section>
              <h3 className="font-display text-lg mb-2">Charges de séchage</h3>
              <DataTable
                columns={["Date", "N° Lot", "Sacs", "PU / sac", "Montant"]}
                rows={sechages.map((s) => [fmtDate(s.date), s.lotId, s.sacs, s.puSechage, fcfa(s.montant)])}
              />
            </section>
            <section>
              <h3 className="font-display text-lg mb-2">Charges de sortie</h3>
              <DataTable
                columns={["Date", "N° Lot", "Sacs", "Chargé", "Pesé", "Déplacement", "Charge totale"]}
                rows={sorties.map((s) => [fmtDate(s.date), s.lotId, s.sacs, fcfa(s.charge), fcfa(s.pesage), fcfa(s.deplacement), fcfa(s.chargeTotale)])}
              />
            </section>
          </div>
        )}
      </div>

      <NewApproDialog open={openNew === "appro"} onClose={() => setOpenNew(null)} />
      <NewSechageDialog open={openNew === "sechage"} onClose={() => setOpenNew(null)} />
      <NewSortieDialog open={openNew === "sortie"} onClose={() => setOpenNew(null)} />
      <LotDetailSheet lotId={detailLot} onClose={() => setDetailLot(null)} />
    </>
  );
}

/* --------------------------------- Helpers -------------------------------- */

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fcfa(n: number) { return n.toLocaleString("fr-FR") + " F"; }

function EntityBadge({ k, name }: { k: Entity; name?: string }) {
  const map: Record<Entity, string> = {
    CAPI: "bg-primary/10 text-primary border-primary/20",
    Partenaire: "bg-secondary/15 text-secondary border-secondary/20",
    Prestataire: "bg-gold/20 text-foreground border-gold/40",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${map[k]}`}>
      {k}{name && name !== k ? <span className="normal-case tracking-normal opacity-70">· {name}</span> : null}
    </span>
  );
}

function StatusBadge({ s }: { s: LotStatus }) {
  const map: Record<LotStatus, string> = {
    "Collecte": "bg-muted text-foreground",
    "En séchage": "bg-gold/20 text-foreground",
    "Stocké": "bg-secondary/15 text-secondary",
    "Envoyé usinage": "bg-primary/10 text-primary",
    "Sortie tiers": "bg-primary/5 text-primary",
  };
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] ${map[s]}`}>{s}</span>;
}

/* ---------------------------------- Forms --------------------------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NewApproDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nextId = paddyActions.nextLotId();
  const [form, setForm] = useState({
    dateEntree: paddyActions.todayISO(),
    zone: "", entity: "CAPI" as Entity, entityName: "CAPI", variete: "JT 11",
    th: 22, ti: 3, sacs: 0, poids: 0, agent: "",
    pu: 300, charge: 0, pesage: 0, dechargement: 0,
    transport: 0, fraisAnnexes: 0, prime: 0,
  });

  const pm = form.sacs ? +(form.poids / form.sacs).toFixed(2) : 0;
  const cap = form.poids * form.pu;
  const total = cap + form.charge + form.pesage + form.dechargement + form.transport + form.fraisAnnexes + form.prime;

  function submit() {
    if (!form.zone || !form.agent || !form.sacs || !form.poids) {
      toast.error("Zone, agent, sacs et poids sont obligatoires."); return;
    }
    const id = paddyActions.addAppro({
      dateAppro: form.dateEntree, dateEntree: form.dateEntree,
      zone: form.zone, entity: form.entity, entityName: form.entityName || form.entity,
      variete: form.variete, th: form.th, ti: form.ti,
      sacs: form.sacs, poids: form.poids, agent: form.agent,
      pu: form.pu, charge: form.charge, pesage: form.pesage,
      dechargement: form.dechargement, transport: form.transport,
      fraisAnnexes: form.fraisAnnexes, prime: form.prime,
    });
    toast.success(`Lot ${id} enregistré.`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Nouvelle entrée paddy</DialogTitle>
          <p className="text-sm text-muted-foreground">N° Lot auto : <code className="text-foreground">{nextId}</code></p>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Date d'entrée"><Input type="date" value={form.dateEntree} onChange={(e) => setForm({ ...form, dateEntree: e.target.value })} /></Field>
          <Field label="Zone"><Input value={form.zone} placeholder="Podor, Rosso…" onChange={(e) => setForm({ ...form, zone: e.target.value })} /></Field>
          <Field label="Agent"><Input value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} /></Field>

          <Field label="Entité">
            <Select value={form.entity} onValueChange={(v: Entity) => setForm({ ...form, entity: v, entityName: v === "CAPI" ? "CAPI" : form.entityName })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CAPI">CAPI (compte propre)</SelectItem>
                <SelectItem value="Partenaire">Partenaire</SelectItem>
                <SelectItem value="Prestataire">Prestataire / Tiers</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nom entité"><Input value={form.entityName} disabled={form.entity === "CAPI"} onChange={(e) => setForm({ ...form, entityName: e.target.value })} /></Field>
          <Field label="Variété">
            <Select value={form.variete} onValueChange={(v) => setForm({ ...form, variete: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="JT 11">JT 11</SelectItem>
                <SelectItem value="Bouaké">Bouaké</SelectItem>
                <SelectItem value="CY-2">CY-2</SelectItem>
                <SelectItem value="Sahel 108">Sahel 108</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="TH (%)"><Input type="number" value={form.th} onChange={(e) => setForm({ ...form, th: +e.target.value })} /></Field>
          <Field label="TI (%)"><Input type="number" value={form.ti} onChange={(e) => setForm({ ...form, ti: +e.target.value })} /></Field>
          <Field label="Nb sacs"><Input type="number" value={form.sacs || ""} onChange={(e) => setForm({ ...form, sacs: +e.target.value })} /></Field>
          <Field label="Poids total (kg)"><Input type="number" value={form.poids || ""} onChange={(e) => setForm({ ...form, poids: +e.target.value })} /></Field>
          <Field label="PM (auto)"><Input value={pm} disabled /></Field>
          <Field label="PU (F/kg)"><Input type="number" value={form.pu} onChange={(e) => setForm({ ...form, pu: +e.target.value })} /></Field>
        </div>

        <div className="mt-2 pt-4 border-t border-border">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Charges annexes</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Chargement"><Input type="number" value={form.charge || ""} onChange={(e) => setForm({ ...form, charge: +e.target.value })} /></Field>
            <Field label="Pesage"><Input type="number" value={form.pesage || ""} onChange={(e) => setForm({ ...form, pesage: +e.target.value })} /></Field>
            <Field label="Déchargement"><Input type="number" value={form.dechargement || ""} onChange={(e) => setForm({ ...form, dechargement: +e.target.value })} /></Field>
            <Field label="Transport"><Input type="number" value={form.transport || ""} onChange={(e) => setForm({ ...form, transport: +e.target.value })} /></Field>
            <Field label="Frais annexes"><Input type="number" value={form.fraisAnnexes || ""} onChange={(e) => setForm({ ...form, fraisAnnexes: +e.target.value })} /></Field>
            <Field label="Prime agent"><Input type="number" value={form.prime || ""} onChange={(e) => setForm({ ...form, prime: +e.target.value })} /></Field>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-4 rounded-md bg-muted/40 p-3 text-sm">
          <div><span className="text-muted-foreground">CAP :</span> <strong>{fcfa(cap)}</strong></div>
          <div><span className="text-muted-foreground">Charge totale :</span> <strong className="text-primary">{fcfa(total)}</strong></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer le lot</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewSechageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appros } = usePaddy();
  const [form, setForm] = useState({
    date: paddyActions.todayISO(), lotId: "",
    thInitial: 22, sacs: 0, poidsAvant: 0, jours: 3,
    thApres: 14, poidsApres: 0, agent: "", puSechage: 50,
  });

  function pickLot(id: string) {
    const a = appros.find((x) => x.id === id);
    setForm({ ...form, lotId: id, thInitial: a?.th ?? 22, sacs: a?.sacs ?? 0, poidsAvant: a?.poids ?? 0 });
  }

  function submit() {
    if (!form.lotId || !form.poidsApres || !form.agent) { toast.error("Lot, poids après et agent requis."); return; }
    paddyActions.addSechage(form);
    toast.success("Séchage enregistré.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="font-display">Nouveau séchage</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="N° Lot">
            <Select value={form.lotId} onValueChange={pickLot}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>{appros.map((a) => <SelectItem key={a.id} value={a.id}>{a.id} — {a.zone}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Agent"><Input value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} /></Field>
          <Field label="TH initial"><Input type="number" value={form.thInitial} onChange={(e) => setForm({ ...form, thInitial: +e.target.value })} /></Field>
          <Field label="Sacs"><Input type="number" value={form.sacs || ""} onChange={(e) => setForm({ ...form, sacs: +e.target.value })} /></Field>
          <Field label="Jours au soleil"><Input type="number" value={form.jours} onChange={(e) => setForm({ ...form, jours: +e.target.value })} /></Field>
          <Field label="Poids avant (kg)"><Input type="number" value={form.poidsAvant || ""} onChange={(e) => setForm({ ...form, poidsAvant: +e.target.value })} /></Field>
          <Field label="Poids après (kg)"><Input type="number" value={form.poidsApres || ""} onChange={(e) => setForm({ ...form, poidsApres: +e.target.value })} /></Field>
          <Field label="TH après"><Input type="number" value={form.thApres} onChange={(e) => setForm({ ...form, thApres: +e.target.value })} /></Field>
          <Field label="PU séchage (F/sac)"><Input type="number" value={form.puSechage} onChange={(e) => setForm({ ...form, puSechage: +e.target.value })} /></Field>
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          Variation : <strong className={form.poidsApres - form.poidsAvant < 0 ? "text-destructive" : "text-foreground"}>
            {form.poidsAvant ? (form.poidsApres - form.poidsAvant).toFixed(0) : "—"} kg
          </strong> · Montant séchage : <strong className="text-foreground">{fcfa(form.sacs * form.puSechage)}</strong>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewSortieDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appros } = usePaddy();
  const [form, setForm] = useState({
    date: paddyActions.todayISO(), lotId: "", th: 13, sacs: 0, poids: 0,
    destination: "Usinage", agent: "", charge: 0, pesage: 0, deplacement: 0,
  });

  function pickLot(id: string) {
    const a = appros.find((x) => x.id === id);
    setForm({ ...form, lotId: id, th: a?.th ?? 13, sacs: a?.sacs ?? 0, poids: a?.poids ?? 0 });
  }

  function submit() {
    if (!form.lotId || !form.poids || !form.agent) { toast.error("Lot, poids et agent requis."); return; }
    paddyActions.addSortie(form);
    toast.success("Sortie enregistrée.");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="font-display">Nouvelle sortie</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="N° Lot">
            <Select value={form.lotId} onValueChange={pickLot}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>{appros.map((a) => <SelectItem key={a.id} value={a.id}>{a.id} — {a.zone}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Destination">
            <Select value={form.destination} onValueChange={(v) => setForm({ ...form, destination: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Usinage">Usinage</SelectItem>
                <SelectItem value="Client tiers">Client tiers</SelectItem>
                <SelectItem value="Reprise partenaire">Reprise partenaire</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="TH"><Input type="number" value={form.th} onChange={(e) => setForm({ ...form, th: +e.target.value })} /></Field>
          <Field label="Sacs"><Input type="number" value={form.sacs || ""} onChange={(e) => setForm({ ...form, sacs: +e.target.value })} /></Field>
          <Field label="Poids (kg)"><Input type="number" value={form.poids || ""} onChange={(e) => setForm({ ...form, poids: +e.target.value })} /></Field>
          <Field label="Agent"><Input value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} /></Field>
          <Field label="Chargement"><Input type="number" value={form.charge || ""} onChange={(e) => setForm({ ...form, charge: +e.target.value })} /></Field>
          <Field label="Pesage"><Input type="number" value={form.pesage || ""} onChange={(e) => setForm({ ...form, pesage: +e.target.value })} /></Field>
          <Field label="Déplacement"><Input type="number" value={form.deplacement || ""} onChange={(e) => setForm({ ...form, deplacement: +e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Lot detail drawer ----------------------------- */

function LotDetailSheet({ lotId, onClose }: { lotId: string | null; onClose: () => void }) {
  const { appros, sechages, sorties } = usePaddy();
  const a = appros.find((x) => x.id === lotId);

  const timeline = useMemo(() => {
    if (!a) return [];
    const items: { date: string; label: string; detail: string }[] = [
      { date: a.dateEntree, label: "Entrée", detail: `${a.sacs} sacs · ${a.poids.toLocaleString("fr-FR")} kg · TH ${a.th}%` },
    ];
    sechages.filter((s) => s.lotId === a.id).forEach((s) => {
      items.push({ date: s.date, label: `Séchage (${s.jours}j)`, detail: `TH ${s.thInitial}% → ${s.thApres}% · variation ${s.variation} kg` });
    });
    sorties.filter((s) => s.lotId === a.id).forEach((s) => {
      items.push({ date: s.date, label: `Sortie → ${s.destination}`, detail: `${s.sacs} sacs · ${s.poids.toLocaleString("fr-FR")} kg` });
    });
    return items.sort((x, y) => x.date.localeCompare(y.date));
  }, [a, sechages, sorties]);

  return (
    <Sheet open={!!lotId} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {a ? (
          <>
            <SheetHeader>
              <SheetTitle className="font-display flex items-center gap-2">
                {a.id}
                <StatusBadge s={a.status} />
              </SheetTitle>
              <div className="flex items-center gap-2 pt-1">
                <EntityBadge k={a.entity} name={a.entityName} />
                <Badge variant="outline">{a.variete}</Badge>
                <Badge variant="outline">{a.zone}</Badge>
              </div>
            </SheetHeader>

            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Kv k="Sacs" v={a.sacs} /><Kv k="Poids" v={`${a.poids.toLocaleString("fr-FR")} kg`} />
              <Kv k="TH / TI" v={`${a.th}% / ${a.ti}%`} /><Kv k="PM" v={`${a.pm} kg`} />
              <Kv k="Agent" v={a.agent} /><Kv k="PU" v={`${a.pu} F/kg`} />
              <Kv k="CAP" v={fcfa(a.cap)} /><Kv k="Charge totale" v={fcfa(a.chargeTotale)} />
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="size-4 text-primary" />
                <h4 className="font-medium">Frise chronologique</h4>
              </div>
              <ol className="relative border-l border-border ml-2 space-y-4">
                {timeline.map((t, i) => (
                  <li key={i} className="pl-4 relative">
                    <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-primary" />
                    <div className="text-xs text-muted-foreground">{fmtDate(t.date)}</div>
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.detail}</div>
                  </li>
                ))}
              </ol>
            </div>

            <button className="absolute top-3 right-3 p-1 rounded hover:bg-muted" onClick={onClose}><X className="size-4" /></button>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Kv({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border/60 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-medium">{v}</div>
    </div>
  );
}
