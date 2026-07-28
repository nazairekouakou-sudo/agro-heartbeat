import { RequireRole } from "@/components/RequireRole";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { Plus, Search, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePaddy, reliquat, type Appro } from "@/lib/paddyStore";
import { useGestion, gestionActions, type ReceptionRizExterne } from "@/lib/gestionStore";
import { useTarifs } from "@/lib/tarifsStore";
import {
  useUsinage, usinageActions, mkDecorticage, mkCalibrage, mkTrie,
  type Qualite, type Decorticage, type LotSource, type Facturation,
} from "@/lib/usinageStore";

export const Route = createFileRoute("/usinage")({
  head: () => ({
    meta: [
      { title: "Service Usinage — CAPI ERP" },
      { name: "description", content: "Décorticage, calibrage, trie optique et suivi financier de l'usinage avec calcul des rendements et qualités." },
    ],
  }),
  component: UsinagePage,
});

const tabs = [
  { id: "decorticage", label: "Décorticage" },
  { id: "calibrage", label: "Calibrage" },
  { id: "trie", label: "Trie optique" },
  { id: "financier", label: "Suivi financier" },
] as const;
type TabId = (typeof tabs)[number]["id"];

function UsinagePage() {
  const [tab, setTab] = useState<TabId>("decorticage");
  const [query, setQuery] = useState("");
  const [openNew, setOpenNew] = useState<null | "dec" | "cal" | "trie">(null);
  const { decorticages, calibrages, tries } = useUsinage();

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
  const filteredCal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return calibrages;
    return calibrages.filter((c) => [c.id, c.lotId, c.equipe].some((v) => v.toLowerCase().includes(q)));
  }, [calibrages, query]);
  const filteredTrie = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tries;
    return tries.filter((t) => [t.id, t.lotId, t.agent].some((v) => v.toLowerCase().includes(q)));
  }, [tries, query]);

  return (
    <RequireRole roles={["admin", "usinage"]}>
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
              <Button size="sm" className="gap-1.5" onClick={() => setOpenNew(tab === "trie" ? "trie" : tab === "calibrage" ? "cal" : "dec")}>
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
            columns={["Date", "N° Lot", "Sacs", "Paddy (kg)", "TH", "Riz blanc", "2X Cassé", "FB", "Riz blanchi", "Rendement", "Taux cassé", "Qualité", "Équipe"]}
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
        {tab === "calibrage" && (
          <DataTable
            columns={["Date", "N° Lot", "Décorticage", "Riz avant (kg)", "Riz après (kg)", "Perte", "PU calibrage", "Coût", "Équipe"]}
            rows={filteredCal.map((c) => [
              fmtDate(c.date), c.lotId, c.decorticageId,
              c.poidsAvant.toLocaleString("fr-FR"), c.poidsApres.toLocaleString("fr-FR"),
              <span className={c.perte > 0 ? "text-destructive" : ""}>{c.perte.toLocaleString("fr-FR")} kg</span>,
              `${c.puCalibrage} F/kg`, fcfa(c.coutCalibrage), c.equipe,
            ])}
            empty="Aucune opération de calibrage."
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
              <h3 className="font-display text-lg mb-2">Coût de calibrage</h3>
              <DataTable
                columns={["Date", "N° Lot", "Riz avant", "Riz après", "PU calibrage", "Coût calibrage"]}
                rows={calibrages.map((c) => [
                  fmtDate(c.date), c.lotId,
                  c.poidsAvant.toLocaleString("fr-FR"),
                  c.poidsApres.toLocaleString("fr-FR"),
                  `${c.puCalibrage} F/kg`,
                  <strong>{fcfa(c.coutCalibrage)}</strong>,
                ])}
              />
              <TotalsRow label="Total calibrage" total={calibrages.reduce((s, c) => s + c.coutCalibrage, 0)} />
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
                columns={["N° Lot", "Paddy (kg)", "Riz blanchi", "Riz trié", "Coût usinage", "Coût calibrage", "Coût triage", "Coût total"]}
                rows={synthesePar(decorticages, calibrages, tries)}
              />
            </section>
          </div>
        )}
      </div>

      <NewDecorticageDialog open={openNew === "dec"} onClose={() => setOpenNew(null)} />
      <NewCalibrageDialog open={openNew === "cal"} onClose={() => setOpenNew(null)} />
      <NewTrieDialog open={openNew === "trie"} onClose={() => setOpenNew(null)} />
    </>
    </RequireRole>
  );
}

/* --------------------------------- Helpers -------------------------------- */
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fcfa(n: number) { return n.toLocaleString("fr-FR") + " F"; }

function QualiteBadge({ q }: { q: Qualite | string }) {
  const map: Record<string, string> = {
    "Blanc": "bg-primary/15 text-primary border-primary/25",
    "Moyen blanc": "bg-secondary/15 text-secondary border-secondary/25",
    "Rouge": "bg-destructive/10 text-destructive border-destructive/25",
    "Autre": "bg-muted text-foreground border-border",
  };
  const cls = map[q] ?? "bg-muted text-foreground border-border";
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${cls}`}>{q}</span>;
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

function synthesePar(decs: Decorticage[], cals: ReturnType<typeof useUsinage>["calibrages"], tries: ReturnType<typeof useUsinage>["tries"]) {
  const lots = Array.from(new Set([...decs.map((d) => d.lotId), ...cals.map((c) => c.lotId), ...tries.map((t) => t.lotId)]));
  return lots.map((lot) => {
    const d = decs.filter((x) => x.lotId === lot);
    const c = cals.filter((x) => x.lotId === lot);
    const t = tries.filter((x) => x.lotId === lot);
    const paddy = d.reduce((s, x) => s + x.poidsPaddy, 0);
    const rizBl = d.reduce((s, x) => s + x.rizBlanchi, 0);
    const rizTr = t.reduce((s, x) => s + x.rizApres, 0);
    const cU = d.reduce((s, x) => s + x.coutUsinage, 0);
    const cC = c.reduce((s, x) => s + x.coutCalibrage, 0);
    const cT = t.reduce((s, x) => s + x.coutTriage, 0);
    return [
      lot,
      paddy.toLocaleString("fr-FR"),
      rizBl.toLocaleString("fr-FR"),
      rizTr.toLocaleString("fr-FR"),
      fcfa(cU),
      fcfa(cC),
      fcfa(cT),
      <strong>{fcfa(cU + cC + cT)}</strong>,
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
  const { appros, sorties } = usePaddy();
  const { decorticages: decorticagesExistants } = useUsinage();
  const tarifs = useTarifs();
  const [form, setForm] = useState({
    date: usinageActions.todayISO(), lotId: "",
    sacs: 0, poidsPaddy: 0, th: 13,
    lg1x: 0, casse2x: 0, fb: 0,
    equipe: "Équipe A", puUsinage: tarifs.puDecorticageCharge,
  });
  const [tranche, setTranche] = useState<"A" | "B" | "ecos">("A");
  const [prixFacture, setPrixFacture] = useState(tarifs.puDecorticageFactureA);

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, puUsinage: tarifs.puDecorticageCharge }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const lotSelectionne = appros.find((a) => a.id === form.lotId);
  const factureAuTiers = lotSelectionne && (lotSelectionne.entity === "Partenaire" || lotSelectionne.entity === "Prestataire");
  const dispo = lotSelectionne ? reliquat(lotSelectionne, sorties, decorticagesExistants) : null;

  function pickLot(id: string) {
    const a = appros.find((x) => x.id === id);
    setForm({ ...form, lotId: id, sacs: a?.sacs ?? 0, poidsPaddy: a?.poids ?? 0, th: a?.th ?? 13 });
    if (a?.tranche) setTrancheChoice(a.tranche as "A" | "B" | "ecos");
  }

  function setTrancheChoice(t: "A" | "B" | "ecos") {
    setTranche(t);
    setPrixFacture(
      t === "A" ? tarifs.puDecorticageFactureA : t === "B" ? tarifs.puDecorticageFactureB : tarifs.puDecorticageFactureEcos,
    );
  }

  // Preview computed values
  const preview = mkDecorticage({
    id: "", date: form.date, lotId: form.lotId || "—",
    sacs: form.sacs, poidsPaddy: form.poidsPaddy, th: form.th,
    lg1x: form.lg1x, casse2x: form.casse2x, fb: form.fb,
    equipe: form.equipe, puUsinage: form.puUsinage,
  });

  const montantFacture = tranche === "B" ? form.poidsPaddy * prixFacture : preview.rizBlanchi * prixFacture;

  function submit() {
    if (!form.lotId || !form.poidsPaddy || (form.lg1x + form.casse2x + form.fb) === 0) {
      toast.error("Lot, poids paddy et sortie riz obligatoires."); return;
    }
    if (preview.rizBlanchi > form.poidsPaddy) {
      toast.error("Le riz blanchi ne peut pas dépasser le poids du paddy."); return;
    }
    if (dispo && form.sacs > dispo.sacs) {
      toast.error(`Stock insuffisant : seulement ${dispo.sacs} sac(s) restant(s) sur ce lot.`); return;
    }
    const facturation: Facturation | null = factureAuTiers && lotSelectionne
      ? { tiers: lotSelectionne.entityName, montantFacture, typePrestation: "usinage" }
      : null;
    const id = usinageActions.addDecorticage({
      date: form.date, lotId: form.lotId,
      sacs: form.sacs, poidsPaddy: form.poidsPaddy, th: form.th,
      lg1x: form.lg1x, casse2x: form.casse2x, fb: form.fb,
      equipe: form.equipe, puUsinage: form.puUsinage,
    }, facturation);
    toast.success(
      facturation
        ? `Décorticage ${id} enregistré — ${lotSelectionne!.entityName} facturé ${fcfa(montantFacture)}.`
        : `Décorticage ${id} enregistré — ${preview.qualite} (${preview.rendement}%).`,
    );
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
                {appros.map((a) => <SelectItem key={a.id} value={a.id}>{a.id} — {a.zone} · {a.variete} ({a.entity})</SelectItem>)}
              </SelectContent>
            </Select>
            {dispo && (
              <p className={`text-xs mt-1 ${form.sacs > dispo.sacs ? "text-destructive" : "text-muted-foreground"}`}>
                Stock disponible : {dispo.sacs} sac(s){dispo.poids !== null ? ` · ${dispo.poids.toLocaleString("fr-FR")} kg` : ""}
              </p>
            )}
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
            <Field label="Long grain (kg)"><Input type="number" value={form.lg1x || ""} onChange={(e) => setForm({ ...form, lg1x: +e.target.value })} /></Field>
            <Field label="2X Cassé (kg)"><Input type="number" value={form.casse2x || ""} onChange={(e) => setForm({ ...form, casse2x: +e.target.value })} /></Field>
            <Field label="FB (kg)"><Input type="number" value={form.fb || ""} onChange={(e) => setForm({ ...form, fb: +e.target.value })} /></Field>
            <Field label="PU coût interne (F/kg)"><Input type="number" value={form.puUsinage} onChange={(e) => setForm({ ...form, puUsinage: +e.target.value })} /></Field>
          </div>
        </div>

        {factureAuTiers && (
          <div className="mt-2 pt-4 border-t border-border">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Facturation à {lotSelectionne!.entityName}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Tranche">
                <Select value={tranche} onValueChange={(v) => setTrancheChoice(v as "A" | "B" | "ecos")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Tranche A — sur long grain</SelectItem>
                    <SelectItem value="B">Tranche B — sur paddy</SelectItem>
                    <SelectItem value="ecos">Tranche Ecos — sur long grain</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Prix facturé (F/kg)"><Input type="number" value={prixFacture} onChange={(e) => setPrixFacture(+e.target.value)} /></Field>
              <div className="flex flex-col justify-end pb-1.5">
                <div className="text-xs text-muted-foreground">Montant facturé</div>
                <strong className="text-primary">{fcfa(montantFacture)}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 rounded-md bg-muted/40 p-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Riz blanchi</div><strong>{preview.rizBlanchi.toLocaleString("fr-FR")} kg</strong></div>
          <div><div className="text-xs text-muted-foreground">Son / paille</div><strong>{preview.sonPaille.toLocaleString("fr-FR")} kg</strong></div>
          <div><div className="text-xs text-muted-foreground">Rendement</div><strong className="text-primary">{preview.rendement}%</strong></div>
          <div><div className="text-xs text-muted-foreground">Taux cassé</div><strong>{preview.tauxCasse}%</strong></div>
          <div><div className="text-xs text-muted-foreground">Qualité</div><QualiteBadge q={preview.qualite} /></div>
          <div className="md:col-span-5 pt-2 border-t border-border"><span className="text-muted-foreground">Coût interne :</span> <strong className="text-primary">{fcfa(preview.coutUsinage)}</strong></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewCalibrageDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { decorticages } = useUsinage();
  const tarifs = useTarifs();
  const [form, setForm] = useState({
    date: usinageActions.todayISO(),
    decorticageId: "", lotId: "",
    poidsAvant: 0, poidsApres: 0,
    equipe: "Équipe A", puCalibrage: tarifs.puCalibrageCharge,
  });

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, puCalibrage: tarifs.puCalibrageCharge }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pickDec(id: string) {
    const d = decorticages.find((x) => x.id === id);
    setForm({ ...form, decorticageId: id, lotId: d?.lotId ?? "", poidsAvant: d?.rizBlanchi ?? 0 });
  }

  const preview = mkCalibrage({
    id: "", date: form.date, lotId: form.lotId || "—", decorticageId: form.decorticageId,
    poidsAvant: form.poidsAvant, poidsApres: form.poidsApres, equipe: form.equipe, puCalibrage: form.puCalibrage,
  });

  function submit() {
    if (!form.decorticageId || !form.poidsApres) { toast.error("Décorticage source et riz après calibrage requis."); return; }
    if (form.poidsApres > form.poidsAvant) { toast.error("Le riz après calibrage ne peut pas dépasser le riz avant."); return; }
    const id = usinageActions.addCalibrage({
      date: form.date, lotId: form.lotId, decorticageId: form.decorticageId,
      poidsAvant: form.poidsAvant, poidsApres: form.poidsApres, equipe: form.equipe, puCalibrage: form.puCalibrage,
    });
    toast.success(`Calibrage ${id} enregistré — perte ${preview.perte} kg.`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Nouveau calibrage</DialogTitle>
          <p className="text-sm text-muted-foreground">Sélectionnez la sortie de décorticage à calibrer.</p>
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

          <Field label="Riz avant (kg)"><Input type="number" value={form.poidsAvant || ""} onChange={(e) => setForm({ ...form, poidsAvant: +e.target.value })} /></Field>
          <Field label="Riz après calibrage (kg)"><Input type="number" value={form.poidsApres || ""} onChange={(e) => setForm({ ...form, poidsApres: +e.target.value })} /></Field>
          <Field label="PU calibrage (F/kg)"><Input type="number" value={form.puCalibrage} onChange={(e) => setForm({ ...form, puCalibrage: +e.target.value })} /></Field>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Perte</div><strong className={preview.perte > 0 ? "text-destructive" : ""}>{preview.perte.toLocaleString("fr-FR")} kg</strong></div>
          <div><div className="text-xs text-muted-foreground">Coût calibrage</div><strong className="text-primary">{fcfa(preview.coutCalibrage)}</strong></div>
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
  const { appros } = usePaddy();
  const { receptionsExternes } = useGestion();
  const tarifs = useTarifs();
  const [source, setSource] = useState<LotSource>("paddy");
  const [form, setForm] = useState({
    date: usinageActions.todayISO(),
    decorticageId: "", lotId: "",
    rizEntree: 0, rizApres: 0, residus: 0,
    agent: "", puTriage: tarifs.puTriageCharge,
  });
  const [prixFacture, setPrixFacture] = useState(tarifs.puTriageFacture);

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, puTriage: tarifs.puTriageCharge }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function pickDec(id: string) {
    const d = decorticages.find((x) => x.id === id);
    setForm({ ...form, decorticageId: id, lotId: d?.lotId ?? "", rizEntree: d?.lg1x ?? 0 });
  }

  function pickReception(id: string) {
    const r = receptionsExternes.find((x) => x.id === id);
    setForm({ ...form, decorticageId: "", lotId: id, rizEntree: r?.poids ?? 0 });
  }

  // Détermine le tiers à facturer selon la source du lot
  const lotAppro = source === "paddy" ? appros.find((a) => a.id === form.lotId) : null;
  const reception = source === "riz_externe" ? receptionsExternes.find((r) => r.id === form.lotId) : null;
  const tiers = lotAppro?.entityName ?? reception?.entityName ?? null;
  const entityType = lotAppro?.entity ?? reception?.entityType ?? null;
  const factureAuTiers = tiers && (entityType === "Partenaire" || entityType === "Prestataire");

  const preview = mkTrie({
    id: "", date: form.date, lotId: form.lotId || "—", lotSource: source, decorticageId: form.decorticageId || null,
    rizEntree: form.rizEntree, rizApres: form.rizApres, residus: form.residus,
    agent: form.agent, puTriage: form.puTriage,
  });

  const montantFacture = form.rizEntree * prixFacture;

  function submit() {
    if (!form.lotId || !form.rizApres || !form.agent) {
      toast.error("Lot source, riz après et agent requis."); return;
    }
    if (source === "paddy" && !form.decorticageId) {
      toast.error("Décorticage source requis."); return;
    }
    if (form.rizApres + form.residus > form.rizEntree) {
      toast.error("Riz trié + résidus ne peut pas dépasser le riz d'entrée."); return;
    }
    const facturation: Facturation | null = factureAuTiers && tiers
      ? { tiers, montantFacture, typePrestation: "triage" }
      : null;
    const id = usinageActions.addTrie({
      date: form.date, lotId: form.lotId, lotSource: source, decorticageId: source === "paddy" ? form.decorticageId : null,
      rizEntree: form.rizEntree, rizApres: form.rizApres, residus: form.residus,
      agent: form.agent, puTriage: form.puTriage,
    }, facturation);
    if (source === "riz_externe") {
      gestionActions.updateReceptionStatut(form.lotId, "trie");
    }
    toast.success(
      facturation
        ? `Trie ${id} enregistré — ${tiers} facturé ${fcfa(montantFacture)}.`
        : `Trie ${id} — récupération ${preview.tauxRecuperation}%.`,
    );
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Nouveau trie optique</DialogTitle>
          <p className="text-sm text-muted-foreground">Riz issu du décorticage CAPI, ou riz blanc reçu directement d'un tiers pour triage seul.</p>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border mb-1">
          <button
            onClick={() => { setSource("paddy"); setForm({ ...form, lotId: "", decorticageId: "", rizEntree: 0 }); }}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${source === "paddy" ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}
          >
            Lot interne (paddy CAPI)
          </button>
          <button
            onClick={() => { setSource("riz_externe"); setForm({ ...form, lotId: "", decorticageId: "", rizEntree: 0 }); }}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${source === "riz_externe" ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}
          >
            Riz externe reçu
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          {source === "paddy" ? (
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
          ) : (
            <Field label="Réception riz externe">
              <Select value={form.lotId} onValueChange={pickReception}>
                <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {receptionsExternes.filter((r) => r.statut !== "trie").map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.id} — {r.entityName} · {r.poids.toLocaleString("fr-FR")} kg</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Agent"><Input value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} /></Field>

          <Field label="Riz entrée (kg)"><Input type="number" value={form.rizEntree || ""} onChange={(e) => setForm({ ...form, rizEntree: +e.target.value })} /></Field>
          <Field label="Riz après trie (kg)"><Input type="number" value={form.rizApres || ""} onChange={(e) => setForm({ ...form, rizApres: +e.target.value })} /></Field>
          <Field label="Résidus (kg)"><Input type="number" value={form.residus || ""} onChange={(e) => setForm({ ...form, residus: +e.target.value })} /></Field>
          <Field label="PU coût interne (F/kg)"><Input type="number" value={form.puTriage} onChange={(e) => setForm({ ...form, puTriage: +e.target.value })} /></Field>
        </div>

        {factureAuTiers && (
          <div className="mt-2 pt-4 border-t border-border">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Facturation à {tiers}</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prix facturé (F/kg)"><Input type="number" value={prixFacture} onChange={(e) => setPrixFacture(+e.target.value)} /></Field>
              <div className="flex flex-col justify-end pb-1.5">
                <div className="text-xs text-muted-foreground">Montant facturé</div>
                <strong className="text-primary">{fcfa(montantFacture)}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 rounded-md bg-muted/40 p-3 text-sm">
          <div><div className="text-xs text-muted-foreground">Écart</div><strong className={preview.ecart !== 0 ? "text-destructive" : ""}>{preview.ecart} kg</strong></div>
          <div><div className="text-xs text-muted-foreground">Taux résidus</div><strong>{preview.tauxResidus}%</strong></div>
          <div><div className="text-xs text-muted-foreground">Récupération</div><strong className="text-primary">{preview.tauxRecuperation}%</strong></div>
          <div><div className="text-xs text-muted-foreground">Coût interne</div><strong className="text-primary">{fcfa(preview.coutTriage)}</strong></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
