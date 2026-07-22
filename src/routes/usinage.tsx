import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { Plus, Search, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePaddy } from "@/lib/paddyStore";
import {
  useUsinage, usinageActions, mkDecorticage, mkTrie,
  type Qualite, type Decorticage,
} from "@/lib/usinageStore";

export const Route = createFileRoute("/usinage")({
  head: () => ({
    meta: [
      { title: "Service Usinage — CAPI ERP" },
      { name: "description", content: "Décorticage, trie optique et suivi financier de l'usinage avec calcul des rendements et qualités." },
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
  const [query, setQuery] = useState("");
  const [openNew, setOpenNew] = useState<null | "dec" | "trie">(null);
  const { decorticages, tries } = useUsinage();

  const totalRiz = decorticages.reduce((s, d) => s + d.rizBlanchi, 0);
  const totalPaddy = decorticages.reduce((s, d) => s + d.poidsPaddy, 0);
  const rendementMoyen = totalPaddy ? (totalRiz / totalPaddy) * 100 : 0;
  const totalTrie = tries.reduce((s, t) => s + t.rizApres, 0);
  const tauxResidusAvg = tries.length ? tries.reduce((s, t) => s + t.tauxResidus, 0) / tries.length : 0;

  const filteredDec = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decorticages;
    return decorticages.filter((d) => [d.id, d.lotId, d.equipe].some((v) => v.toLowerCase().includes(q)));
  }, [decorticages, query]);
  const filteredTrie = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tries;
    return tries.filter((t) => [t.id, t.lotId, t.agent].some((v) => v.toLowerCase().includes(q)));
  }, [tries, query]);

  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Usinage" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Usinage"
          description="Décorticage du paddy puis trie optique du riz. Rendements et qualités calculés automatiquement."
          actions={
            <>
              <div className="relative">
                <Search className="size-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher lot, opération, équipe…"
                  className="h-9 pl-8 w-64"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-1.5"><Filter className="size-4" /> Filtrer</Button>
              <Button size="sm" className="gap-1.5" onClick={() => setOpenNew(tab === "trie" ? "trie" : "dec")}>
                <Plus className="size-4" /> Nouvelle opération
              </Button>
            </>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Riz blanchi" value={`${(totalRiz / 1000).toFixed(1)} t`} hint="Cumul décorticage" />
          <StatCard label="Rendement moyen" value={`${rendementMoyen.toFixed(1)} %`} hint="Riz blanc / paddy" tone="secondary" />
          <StatCard label="Trie optique" value={`${(totalTrie / 1000).toFixed(1)} t`} hint="Riz trié" tone="gold" />
          <StatCard label="Taux résidus moyen" value={`${tauxResidusAvg.toFixed(1)} %`} />
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

        {tab === "decorticage" && (
          <DataTable
            columns={["Date", "N° Lot", "Sacs", "Paddy (kg)", "TH", "LG+1X", "2X Cassé", "FB", "Riz blanchi", "Rendement", "Taux cassé", "Qualité", "Équipe"]}
            rows={filteredDec.map((d) => [
              fmtDate(d.date), d.lotId, d.sacs,
              d.poidsPaddy.toLocaleString("fr-FR"),
              `${d.th}%`,
              d.lg1x.toLocaleString("fr-FR"),
              d.casse2x.toLocaleString("fr-FR"),
              d.fb.toLocaleString("fr-FR"),
              d.rizBlanchi.toLocaleString("fr-FR"),
              <RendementBadge v={d.rendement} />,
              `${d.tauxCasse}%`,
              <QualiteBadge q={d.qualite} />,
              d.equipe,
            ])}
            empty="Aucune opération de décorticage."
          />
        )}
        {tab === "trie" && (
          <DataTable
            columns={["Date", "N° Lot", "Riz (kg)", "Après trie", "Résidus", "Écart", "Taux résidus", "Récupération", "Agent"]}
            rows={filteredTrie.map((t) => [
              fmtDate(t.date), t.lotId,
              t.rizEntree.toLocaleString("fr-FR"),
              t.rizApres.toLocaleString("fr-FR"),
              t.residus.toLocaleString("fr-FR"),
              <span className={t.ecart !== 0 ? "text-destructive" : ""}>{t.ecart}</span>,
              `${t.tauxResidus}%`,
              `${t.tauxRecuperation}%`,
              t.agent,
            ])}
            empty="Aucun trie enregistré."
          />
        )}
        {tab === "financier" && (
          <div className="space-y-6">
            <section>
              <h3 className="font-display text-lg mb-2">Coût de décorticage</h3>
              <DataTable
                columns={["Date", "N° Lot", "Sacs", "Paddy (kg)", "Riz blanchi", "PU usinage", "Coût usinage", "Rendement", "Qualité"]}
                rows={decorticages.map((d) => [
                  fmtDate(d.date), d.lotId, d.sacs,
                  d.poidsPaddy.toLocaleString("fr-FR"),
                  d.rizBlanchi.toLocaleString("fr-FR"),
                  `${d.puUsinage} F/kg`,
                  <strong>{fcfa(d.coutUsinage)}</strong>,
                  `${d.rendement}%`,
                  <QualiteBadge q={d.qualite} />,
                ])}
              />
              <TotalsRow label="Total décorticage" total={decorticages.reduce((s, d) => s + d.coutUsinage, 0)} />
            </section>
            <section>
              <h3 className="font-display text-lg mb-2">Coût de triage</h3>
              <DataTable
                columns={["Date", "N° Lot", "Riz entrée", "Riz trié", "PU triage", "Coût triage", "Récupération"]}
                rows={tries.map((t) => [
                  fmtDate(t.date), t.lotId,
                  t.rizEntree.toLocaleString("fr-FR"),
                  t.rizApres.toLocaleString("fr-FR"),
                  `${t.puTriage} F/kg`,
                  <strong>{fcfa(t.coutTriage)}</strong>,
                  `${t.tauxRecuperation}%`,
                ])}
              />
              <TotalsRow label="Total triage" total={tries.reduce((s, t) => s + t.coutTriage, 0)} />
            </section>
            <section>
              <h3 className="font-display text-lg mb-2">Synthèse par lot</h3>
              <DataTable
                columns={["N° Lot", "Paddy (kg)", "Riz blanchi", "Riz trié", "Coût usinage", "Coût triage", "Coût total"]}
                rows={synthesePar(decorticages, tries)}
              />
            </section>
          </div>
        )}
      </div>

      <NewDecorticageDialog open={openNew === "dec"} onClose={() => setOpenNew(null)} />
      <NewTrieDialog open={openNew === "trie"} onClose={() => setOpenNew(null)} />
    </>
  );
}

/* --------------------------------- Helpers -------------------------------- */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fcfa(n: number) { return n.toLocaleString("fr-FR") + " F"; }

function QualiteBadge({ q }: { q: Qualite }) {
  const map: Record<Qualite, string> = {
    "Blanc premium": "bg-primary/15 text-primary border-primary/25",
    "Blanc": "bg-secondary/15 text-secondary border-secondary/25",
    "Moyen blanc": "bg-gold/25 text-foreground border-gold/40",
    "Standard": "bg-muted text-foreground border-border",
    "Écart": "bg-destructive/10 text-destructive border-destructive/25",
  };
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${map[q]}`}>{q}</span>;
}

function RendementBadge({ v }: { v: number }) {
  const tone = v >= 68 ? "text-primary" : v >= 63 ? "text-foreground" : "text-destructive";
  return <span className={`font-medium ${tone}`}>{v}%</span>;
}

function TotalsRow({ label, total }: { label: string; total: number }) {
  return (
    <div className="mt-2 flex justify-end text-sm">
      <span className="text-muted-foreground mr-2">{label} :</span>
      <strong className="text-primary">{fcfa(total)}</strong>
    </div>
  );
}

function synthesePar(decs: Decorticage[], tries: ReturnType<typeof useUsinage>["tries"]) {
  const lots = Array.from(new Set([...decs.map((d) => d.lotId), ...tries.map((t) => t.lotId)]));
  return lots.map((lot) => {
    const d = decs.filter((x) => x.lotId === lot);
    const t = tries.filter((x) => x.lotId === lot);
    const paddy = d.reduce((s, x) => s + x.poidsPaddy, 0);
    const rizBl = d.reduce((s, x) => s + x.rizBlanchi, 0);
    const rizTr = t.reduce((s, x) => s + x.rizApres, 0);
    const cU = d.reduce((s, x) => s + x.coutUsinage, 0);
    const cT = t.reduce((s, x) => s + x.coutTriage, 0);
    return [
      lot,
      paddy.toLocaleString("fr-FR"),
      rizBl.toLocaleString("fr-FR"),
      rizTr.toLocaleString("fr-FR"),
      fcfa(cU),
      fcfa(cT),
      <strong>{fcfa(cU + cT)}</strong>,
    ];
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* --------------------------------- Forms --------------------------------- */

function NewDecorticageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appros } = usePaddy();
  const [form, setForm] = useState({
    date: usinageActions.todayISO(), lotId: "",
    sacs: 0, poidsPaddy: 0, th: 13,
    lg1x: 0, casse2x: 0, fb: 0,
    equipe: "Équipe A", puUsinage: 25,
  });

  function pickLot(id: string) {
    const a = appros.find((x) => x.id === id);
    setForm({ ...form, lotId: id, sacs: a?.sacs ?? 0, poidsPaddy: a?.poids ?? 0, th: a?.th ?? 13 });
  }

  // Preview computed values
  const preview = mkDecorticage({
    id: "", date: form.date, lotId: form.lotId || "—",
    sacs: form.sacs, poidsPaddy: form.poidsPaddy, th: form.th,
    lg1x: form.lg1x, casse2x: form.casse2x, fb: form.fb,
    equipe: form.equipe, puUsinage: form.puUsinage,
  });

  function submit() {
    if (!form.lotId || !form.poidsPaddy || (form.lg1x + form.casse2x + form.fb) === 0) {
      toast.error("Lot, poids paddy et sortie riz obligatoires."); return;
    }
    if (preview.rizBlanchi > form.poidsPaddy) {
      toast.error("Le riz blanchi ne peut pas dépasser le poids du paddy."); return;
    }
    const id = usinageActions.addDecorticage({
      date: form.date, lotId: form.lotId,
      sacs: form.sacs, poidsPaddy: form.poidsPaddy, th: form.th,
      lg1x: form.lg1x, casse2x: form.casse2x, fb: form.fb,
      equipe: form.equipe, puUsinage: form.puUsinage,
    });
    toast.success(`Décorticage ${id} enregistré — ${preview.qualite} (${preview.rendement}%).`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Nouveau décorticage</DialogTitle>
          <p className="text-sm text-muted-foreground">Rendement, qualité et coût calculés automatiquement.</p>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="N° Lot paddy">
            <Select value={form.lotId} onValueChange={pickLot}>
              <SelectTrigger><SelectValue placeholder="Choisir un lot…" /></SelectTrigger>
              <SelectContent>
                {appros.map((a) => <SelectItem key={a.id} value={a.id}>{a.id} — {a.zone} · {a.variete}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Équipe">
            <Select value={form.equipe} onValueChange={(v) => setForm({ ...form, equipe: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Équipe A">Équipe A</SelectItem>
                <SelectItem value="Équipe B">Équipe B</SelectItem>
                <SelectItem value="Équipe C">Équipe C</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Sacs entrés"><Input type="number" value={form.sacs || ""} onChange={(e) => setForm({ ...form, sacs: +e.target.value })} /></Field>
          <Field label="Poids paddy (kg)"><Input type="number" value={form.poidsPaddy || ""} onChange={(e) => setForm({ ...form, poidsPaddy: +e.target.value })} /></Field>
          <Field label="TH (%)"><Input type="number" value={form.th} onChange={(e) => setForm({ ...form, th: +e.target.value })} /></Field>
        </div>

        <div className="mt-2 pt-4 border-t border-border">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Sortie décorticage</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="LG + 1X (kg)"><Input type="number" value={form.lg1x || ""} onChange={(e) => setForm({ ...form, lg1x: +e.target.value })} /></Field>
            <Field label="2X Cassé (kg)"><Input type="number" value={form.casse2x || ""} onChange={(e) => setForm({ ...form, casse2x: +e.target.value })} /></Field>
            <Field label="FB (kg)"><Input type="number" value={form.fb || ""} onChange={(e) => setForm({ ...form, fb: +e.target.value })} /></Field>
            <Field label="PU usinage (F/kg)"><Input type="number" value={form.puUsinage} onChange={(e) => setForm({ ...form, puUsinage: +e.target.value })} /></Field>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 rounded-md bg-muted/40 p-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Riz blanchi</div><strong>{preview.rizBlanchi.toLocaleString("fr-FR")} kg</strong></div>
          <div><div className="text-xs text-muted-foreground">Son / paille</div><strong>{preview.sonPaille.toLocaleString("fr-FR")} kg</strong></div>
          <div><div className="text-xs text-muted-foreground">Rendement</div><strong className="text-primary">{preview.rendement}%</strong></div>
          <div><div className="text-xs text-muted-foreground">Taux cassé</div><strong>{preview.tauxCasse}%</strong></div>
          <div><div className="text-xs text-muted-foreground">Qualité</div><QualiteBadge q={preview.qualite} /></div>
          <div className="md:col-span-5 pt-2 border-t border-border"><span className="text-muted-foreground">Coût d'usinage :</span> <strong className="text-primary">{fcfa(preview.coutUsinage)}</strong></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTrieDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { decorticages } = useUsinage();
  const [form, setForm] = useState({
    date: usinageActions.todayISO(),
    decorticageId: "", lotId: "",
    rizEntree: 0, rizApres: 0, residus: 0,
    agent: "", puTriage: 10,
  });

  function pickDec(id: string) {
    const d = decorticages.find((x) => x.id === id);
    setForm({ ...form, decorticageId: id, lotId: d?.lotId ?? "", rizEntree: d?.lg1x ?? 0 });
  }

  const preview = mkTrie({
    id: "", date: form.date, lotId: form.lotId || "—", decorticageId: form.decorticageId,
    rizEntree: form.rizEntree, rizApres: form.rizApres, residus: form.residus,
    agent: form.agent, puTriage: form.puTriage,
  });

  function submit() {
    if (!form.decorticageId || !form.rizApres || !form.agent) {
      toast.error("Décorticage source, riz après et agent requis."); return;
    }
    if (form.rizApres + form.residus > form.rizEntree) {
      toast.error("Riz trié + résidus ne peut pas dépasser le riz d'entrée."); return;
    }
    const id = usinageActions.addTrie({
      date: form.date, lotId: form.lotId, decorticageId: form.decorticageId,
      rizEntree: form.rizEntree, rizApres: form.rizApres, residus: form.residus,
      agent: form.agent, puTriage: form.puTriage,
    });
    toast.success(`Trie ${id} — récupération ${preview.tauxRecuperation}%.`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Nouveau trie optique</DialogTitle>
          <p className="text-sm text-muted-foreground">Sélectionnez la sortie de décorticage à trier.</p>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Décorticage source">
            <Select value={form.decorticageId} onValueChange={pickDec}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {decorticages.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.id} — {d.lotId} · {d.lg1x.toLocaleString("fr-FR")} kg</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Agent"><Input value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} /></Field>

          <Field label="Riz entrée (kg)"><Input type="number" value={form.rizEntree || ""} onChange={(e) => setForm({ ...form, rizEntree: +e.target.value })} /></Field>
          <Field label="Riz après trie (kg)"><Input type="number" value={form.rizApres || ""} onChange={(e) => setForm({ ...form, rizApres: +e.target.value })} /></Field>
          <Field label="Résidus (kg)"><Input type="number" value={form.residus || ""} onChange={(e) => setForm({ ...form, residus: +e.target.value })} /></Field>
          <Field label="PU triage (F/kg)"><Input type="number" value={form.puTriage} onChange={(e) => setForm({ ...form, puTriage: +e.target.value })} /></Field>
        </div>

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md bg-muted/40 p-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Écart</div><strong className={preview.ecart !== 0 ? "text-destructive" : ""}>{preview.ecart} kg</strong></div>
          <div><div className="text-xs text-muted-foreground">Taux résidus</div><strong>{preview.tauxResidus}%</strong></div>
          <div><div className="text-xs text-muted-foreground">Récupération</div><strong className="text-primary">{preview.tauxRecuperation}%</strong></div>
          <div><div className="text-xs text-muted-foreground">Coût triage</div><strong className="text-primary">{fcfa(preview.coutTriage)}</strong></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
