import { RequireRole } from "@/components/RequireRole";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { Plus, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePaddy, type Appro } from "@/lib/paddyStore";
import { useUsinage } from "@/lib/usinageStore";
import { useCommercial } from "@/lib/commercialStore";
import { useGestion, gestionActions } from "@/lib/gestionStore";
import { useAuth } from "@/lib/authStore";
import {
  useComptable, comptableActions,
  type PretType, type PretNature, type TypePrestation,
} from "@/lib/comptableStore";

export const Route = createFileRoute("/comptable")({
  head: () => ({
    meta: [
      { title: "Service Comptable — CAPI ERP" },
      { name: "description", content: "Comptabilité par entité, dépenses, prêts, facturation de prestations." },
    ],
  }),
  component: () => (
    <RequireRole roles={["admin", "comptable"]}>
      <ComptablePage />
    </RequireRole>
  ),
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

const tabs = [
  { id: "charges", label: "Charges & paiements" },
  { id: "depenses", label: "Dépenses" },
  { id: "prets", label: "Prêts" },
  { id: "prestations", label: "Prestations facturées" },
  { id: "versements", label: "Encaissements & versements" },
] as const;
type TabId = (typeof tabs)[number]["id"];

type ChargeLine = {
  date: string; lotId: string; centre: string; libelle: string; montant: number;
  sourceTable: string; sourceId: string; entity: Appro["entity"] | null; entityName: string | null;
};

function ComptablePage() {
  const [tab, setTab] = useState<TabId>("charges");
  const { profile } = useAuth();
  const paidBy = profile?.fullName ?? "Comptabilité CAPI";

  const { appros, sechages, sorties } = usePaddy();
  const { decorticages, tries } = useUsinage();
  const { ventes, versements } = useCommercial();
  const { validations } = useGestion();
  const { depenses, prets, remboursements, factures, encaissements } = useComptable();

  const approByLot = useMemo(() => new Map(appros.map((a) => [a.id, a])), [appros]);
  const partenaires = useMemo(
    () => Array.from(new Set(appros.filter((a) => a.entity === "Partenaire").map((a) => a.entityName))),
    [appros],
  );
  const entites = useMemo(
    () => [{ id: "capi", label: "CAPI (+ prestataires)" }, ...partenaires.map((p) => ({ id: p, label: `Partenaire — ${p}` }))],
    [partenaires],
  );
  const [ent, setEnt] = useState("capi");

  const chargeLines: ChargeLine[] = useMemo(() => {
    const lines: ChargeLine[] = [];
    for (const a of appros) lines.push({ date: a.dateAppro, lotId: a.id, centre: "Approvisionnement", libelle: "CAP + frais annexes", montant: a.chargeTotale, sourceTable: "appros", sourceId: a.id, entity: a.entity, entityName: a.entityName });
    for (const s of sechages) { const a = approByLot.get(s.lotId); lines.push({ date: s.date, lotId: s.lotId, centre: "Séchage", libelle: `${s.jours} jour${s.jours > 1 ? "s" : ""}`, montant: s.montant, sourceTable: "sechages", sourceId: s.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null }); }
    for (const s of sorties) { const a = approByLot.get(s.lotId); lines.push({ date: s.date, lotId: s.lotId, centre: "Sortie / Transport", libelle: s.destination, montant: s.chargeTotale, sourceTable: "sorties", sourceId: s.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null }); }
    for (const d of decorticages) { const a = approByLot.get(d.lotId); lines.push({ date: d.date, lotId: d.lotId, centre: "Usinage", libelle: "Décorticage", montant: d.coutUsinage, sourceTable: "decorticages", sourceId: d.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null }); }
    for (const t of tries) { const a = approByLot.get(t.lotId); lines.push({ date: t.date, lotId: t.lotId, centre: "Trie optique", libelle: "Triage", montant: t.coutTriage, sourceTable: "tries", sourceId: t.id, entity: a?.entity ?? null, entityName: a?.entityName ?? null }); }
    return lines.sort((x, y) => (x.date < y.date ? 1 : -1));
  }, [appros, sechages, sorties, decorticages, tries, approByLot]);

  const validationByKey = useMemo(() => {
    const map = new Map<string, (typeof validations)[number]>();
    for (const v of validations) map.set(`${v.sourceTable}:${v.sourceId}`, v);
    return map;
  }, [validations]);

  const filteredLines = useMemo(
    () => chargeLines.filter((l) => (ent === "capi" ? l.entity === "CAPI" || l.entity === "Prestataire" || l.entity === null : l.entityName === ent)),
    [chargeLines, ent],
  );

  const depensesCumulees = useMemo(() => chargeLines.filter((l) => thisMonth(l.date)).reduce((s, l) => s + l.montant, 0) + depenses.filter((d) => thisMonth(d.date)).reduce((s, d) => s + d.montant, 0), [chargeLines, depenses]);
  const recettesCumulees = useMemo(
    () =>
      ventes.filter((v) => thisMonth(v.date)).reduce((s, v) => s + v.montant, 0) +
      factures.filter((f) => thisMonth(f.date)).reduce((s, f) => s + f.montantFacture, 0),
    [ventes, factures],
  );
  const decaissementsAVenir = useMemo(() => filteredLines.filter((l) => { const v = validationByKey.get(`${l.sourceTable}:${l.sourceId}`); return !v || v.status !== "validee" || !v.paid; }).length, [filteredLines, validationByKey]);
  const rentabilite = recettesCumulees > 0 ? ((recettesCumulees - depensesCumulees) / recettesCumulees) * 100 : 0;

  const pretsEnCours = useMemo(() => {
    return prets.reduce((sum, p) => {
      if (p.nature !== "espece") return sum;
      const rembourse = remboursements.filter((r) => r.pretId === p.id).reduce((s, r) => s + r.montant, 0);
      return sum + Math.max(0, p.montantInitial - rembourse);
    }, 0);
  }, [prets, remboursements]);

  const creancesClients = useMemo(() => {
    return factures.reduce((sum, f) => {
      const encaisse = encaissements.filter((e) => e.factureId === f.id).reduce((s, e) => s + e.montant, 0);
      return sum + Math.max(0, f.montantFacture - encaisse);
    }, 0);
  }, [factures, encaissements]);

  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Comptable" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Comptable"
          description="Entité financière exclusive : contrôle des dépenses, décaissements sur états validés, prêts et facturation de prestations."
          actions={
            <select value={ent} onChange={(e) => setEnt(e.target.value)} className="h-9 px-3 rounded-md border border-border bg-card text-sm">
              {entites.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="Dépenses cumulées" value={`${fcfaCompact(depensesCumulees)} F`} hint="Mois en cours" />
          <StatCard label="Recettes cumulées" value={`${fcfaCompact(recettesCumulees)} F`} hint="Mois en cours" tone="secondary" />
          <StatCard label="Décaissements à venir" value={String(decaissementsAVenir)} hint="Validés, non payés" tone="gold" />
          <StatCard label="Rentabilité brute" value={`${rentabilite >= 0 ? "+" : ""}${rentabilite.toFixed(0)} %`} hint="Marge sur ventes" />
          <StatCard label="Prêts en cours" value={`${fcfaCompact(pretsEnCours)} F`} hint="Espèces, solde restant" />
          <StatCard label="Créances clients" value={`${fcfaCompact(creancesClients)} F`} hint="Facturé non encaissé" tone="gold" />
        </div>

        <div className="flex flex-wrap gap-1 border-b border-border">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${tab === t.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "charges" && (
          <div>
            <h3 className="font-display text-lg mb-2">Charges par centre de coût & lot</h3>
            <DataTable
              columns={["Date", "N° Lot", "Centre de coût", "Libellé", "Montant", "Statut Gestion", "Paiement", ""]}
              rows={filteredLines.map((l) => {
                const v = validationByKey.get(`${l.sourceTable}:${l.sourceId}`);
                const gestionStatus = v?.status ?? "en_attente";
                return [
                  fmtDate(l.date), l.lotId, l.centre, l.libelle, fcfa(l.montant),
                  <Statut key={`g-${l.sourceTable}-${l.sourceId}`} k={gestionStatus === "validee" ? "Validé" : gestionStatus === "rejetee" ? "Rejeté" : "À valider"} tone={gestionStatus === "validee" ? "ok" : gestionStatus === "rejetee" ? "bad" : "warn"} />,
                  v?.paid ? <Statut key={`p-${l.sourceTable}-${l.sourceId}`} k={`Payé · ${v.paidBy ?? ""}`} tone="ok" /> : <span key={`p-${l.sourceTable}-${l.sourceId}`} className="text-muted-foreground text-xs">Non payé</span>,
                  v && v.status === "validee" && !v.paid ? (
                    <button
                      key={`btn-${l.sourceTable}-${l.sourceId}`}
                      onClick={async () => { await gestionActions.payValidation(v.id, paidBy); toast.success(`${l.lotId} · ${l.centre} marqué payé.`); }}
                      className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs inline-flex items-center gap-1"
                    >
                      <Wallet className="size-3" /> Payer
                    </button>
                  ) : "",
                ];
              })}
            />
          </div>
        )}

        {tab === "depenses" && <DepensesTab depenses={depenses} appros={appros} />}
        {tab === "prets" && <PretsTab prets={prets} remboursements={remboursements} />}
        {tab === "prestations" && <PrestationsTab factures={factures} encaissements={encaissements} appros={appros} />}

        {tab === "versements" && (
          <div>
            <h3 className="font-display text-lg mb-2">Encaissements & versements</h3>
            <DataTable
              columns={["Date", "Origine", "Libellé", "Montant", "Caisse", "Agent"]}
              rows={versements.map((v) => [fmtDate(v.date), `Boutique ${v.boutique}`, "Versement journalier", fcfa(v.montantVerse), "Caisse centrale", v.agent])}
            />
          </div>
        )}
      </div>
    </>
  );
}

function Statut({ k, tone }: { k: string; tone: "ok" | "warn" | "bad" }) {
  const m = { ok: "bg-success/15 text-success", warn: "bg-warning/15 text-warning", bad: "bg-destructive/15 text-destructive" } as const;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${m[tone]}`}>{k}</span>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

// ------------------------------------------------------------------
// Dépenses
// ------------------------------------------------------------------
function DepensesTab({ depenses, appros }: { depenses: ReturnType<typeof useComptable>["depenses"]; appros: Appro[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5"><Plus className="size-4" /> Nouvelle dépense</Button>
      </div>
      <DataTable
        columns={["Date", "N° Lot", "Tiers", "Catégorie", "Libellé", "Montant"]}
        rows={depenses.map((d) => [fmtDate(d.date), d.lotId ?? "—", d.tiers ?? "—", d.categorie, d.libelle, fcfa(d.montant)])}
      />
      <NewDepenseDialog open={open} onClose={() => setOpen(false)} appros={appros} />
    </div>
  );
}

function NewDepenseDialog({ open, onClose, appros }: { open: boolean; onClose: () => void; appros: Appro[] }) {
  const [form, setForm] = useState({ date: comptableActions.todayISO(), lotId: "", tiers: "", categorie: "Achat paddy", libelle: "", montant: 0 });
  function submit() {
    if (!form.libelle || !form.montant) { toast.error("Libellé et montant sont obligatoires."); return; }
    const id = comptableActions.addDepense({ date: form.date, lotId: form.lotId || null, tiers: form.tiers || null, categorie: form.categorie, libelle: form.libelle, montant: form.montant });
    toast.success(`Dépense ${id} enregistrée.`);
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Nouvelle dépense</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Catégorie">
            <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Achat paddy", "Transport", "Pesage / Chargement", "Prime agent", "Fournitures", "Autre"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="N° Lot (optionnel)">
            <Select value={form.lotId || "__none__"} onValueChange={(v) => setForm({ ...form, lotId: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun</SelectItem>
                {appros.map((a) => <SelectItem key={a.id} value={a.id}>{a.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tiers (optionnel)"><Input value={form.tiers} onChange={(e) => setForm({ ...form, tiers: e.target.value })} /></Field>
          <div className="col-span-2"><Field label="Libellé"><Input value={form.libelle} onChange={(e) => setForm({ ...form, libelle: e.target.value })} /></Field></div>
          <Field label="Montant (FCFA)"><Input type="number" value={form.montant || ""} onChange={(e) => setForm({ ...form, montant: Number(e.target.value) })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={submit}>Enregistrer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------
// Prêts
// ------------------------------------------------------------------
function PretsTab({ prets, remboursements }: { prets: ReturnType<typeof useComptable>["prets"]; remboursements: ReturnType<typeof useComptable>["remboursements"] }) {
  const [open, setOpen] = useState(false);
  const [rembOpen, setRembOpen] = useState<string | null>(null);

  function soldeRestant(pretId: string, initial: number) {
    const r = remboursements.filter((x) => x.pretId === pretId).reduce((s, x) => s + x.montant, 0);
    return Math.max(0, initial - r);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5"><Plus className="size-4" /> Nouveau prêt</Button>
      </div>
      <DataTable
        columns={["Date", "Type", "Bénéficiaire", "Nature", "Montant initial", "Solde restant", ""]}
        rows={prets.map((p) => [
          fmtDate(p.date), p.type === "personnel" ? "Personnel" : "Paysan", p.beneficiaire,
          p.nature === "espece" ? "Espèce" : `Nature (${p.unite ?? "—"})`,
          p.nature === "espece" ? fcfa(p.montantInitial) : `${p.montantInitial} ${p.unite ?? ""}`,
          p.nature === "espece" ? fcfa(soldeRestant(p.id, p.montantInitial)) : "—",
          p.nature === "espece" ? (
            <button key={p.id} onClick={() => setRembOpen(p.id)} className="h-7 px-2.5 rounded-md border border-border text-xs">Rembourser</button>
          ) : "",
        ])}
      />
      <NewPretDialog open={open} onClose={() => setOpen(false)} />
      {rembOpen && <NewRemboursementDialog pretId={rembOpen} onClose={() => setRembOpen(null)} />}
    </div>
  );
}

function NewPretDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ date: comptableActions.todayISO(), type: "personnel" as PretType, beneficiaire: "", nature: "espece" as PretNature, unite: "", montantInitial: 0, description: "" });
  function submit() {
    if (!form.beneficiaire || !form.montantInitial) { toast.error("Bénéficiaire et montant sont obligatoires."); return; }
    const id = comptableActions.addPret({ date: form.date, type: form.type, beneficiaire: form.beneficiaire, nature: form.nature, unite: form.nature === "nature" ? form.unite || null : null, montantInitial: form.montantInitial, description: form.description || null });
    toast.success(`Prêt ${id} enregistré.`);
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Nouveau prêt</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PretType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="personnel">Personnel</SelectItem><SelectItem value="paysan">Paysan</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Bénéficiaire"><Input value={form.beneficiaire} onChange={(e) => setForm({ ...form, beneficiaire: e.target.value })} /></Field>
          <Field label="Nature">
            <Select value={form.nature} onValueChange={(v) => setForm({ ...form, nature: v as PretNature })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="espece">Espèce</SelectItem><SelectItem value="nature">Nature</SelectItem></SelectContent>
            </Select>
          </Field>
          {form.nature === "nature" && <Field label="Unité"><Input value={form.unite} placeholder="Ex: sacs riz" onChange={(e) => setForm({ ...form, unite: e.target.value })} /></Field>}
          <Field label={form.nature === "espece" ? "Montant (FCFA)" : "Quantité"}><Input type="number" value={form.montantInitial || ""} onChange={(e) => setForm({ ...form, montantInitial: Number(e.target.value) })} /></Field>
          <div className="col-span-2"><Field label="Description (optionnel)"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={submit}>Enregistrer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewRemboursementDialog({ pretId, onClose }: { pretId: string; onClose: () => void }) {
  const [montant, setMontant] = useState(0);
  const [date, setDate] = useState(comptableActions.todayISO());
  function submit() {
    if (!montant) { toast.error("Montant obligatoire."); return; }
    comptableActions.addRemboursement({ pretId, date, montant });
    toast.success("Remboursement enregistré.");
    onClose();
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-display">Enregistrer un remboursement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Montant"><Input type="number" value={montant || ""} onChange={(e) => setMontant(Number(e.target.value))} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={submit}>Enregistrer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------------------------------------------------------------
// Prestations facturées
// ------------------------------------------------------------------
function PrestationsTab({ factures, encaissements, appros }: { factures: ReturnType<typeof useComptable>["factures"]; encaissements: ReturnType<typeof useComptable>["encaissements"]; appros: Appro[] }) {
  const [open, setOpen] = useState(false);
  const [encOpen, setEncOpen] = useState<string | null>(null);

  function encaisse(factureId: string) {
    return encaissements.filter((e) => e.factureId === factureId).reduce((s, e) => s + e.montant, 0);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5"><Plus className="size-4" /> Nouvelle facture</Button>
      </div>
      <DataTable
        columns={["Date", "N° Lot", "Tiers", "Prestation", "Montant facturé", "Encaissé", "Solde", ""]}
        rows={factures.map((f) => {
          const enc = encaisse(f.id);
          const solde = f.montantFacture - enc;
          return [
            fmtDate(f.date), f.lotId ?? "—", f.tiers, f.typePrestation, fcfa(f.montantFacture), fcfa(enc),
            <Statut key={f.id} k={solde <= 0 ? "Soldé" : enc > 0 ? "Partiel" : "Impayé"} tone={solde <= 0 ? "ok" : enc > 0 ? "warn" : "bad"} />,
            solde > 0 ? <button key={`b-${f.id}`} onClick={() => setEncOpen(f.id)} className="h-7 px-2.5 rounded-md border border-border text-xs">Encaisser</button> : "",
          ];
        })}
      />
      <NewFactureDialog open={open} onClose={() => setOpen(false)} appros={appros} />
      {encOpen && <NewEncaissementDialog factureId={encOpen} onClose={() => setEncOpen(null)} />}
    </div>
  );
}

function NewFactureDialog({ open, onClose, appros }: { open: boolean; onClose: () => void; appros: Appro[] }) {
  const [form, setForm] = useState({ date: comptableActions.todayISO(), lotId: "", tiers: "", typePrestation: "sechage" as TypePrestation, montantFacture: 0, echeance: "" });
  function submit() {
    if (!form.tiers || !form.montantFacture) { toast.error("Tiers et montant sont obligatoires."); return; }
    const id = comptableActions.addFacture({ date: form.date, lotId: form.lotId || null, tiers: form.tiers, typePrestation: form.typePrestation, montantFacture: form.montantFacture, echeance: form.echeance || null });
    toast.success(`Facture ${id} enregistrée.`);
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Nouvelle facture de prestation</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Échéance (optionnel)"><Input type="date" value={form.echeance} onChange={(e) => setForm({ ...form, echeance: e.target.value })} /></Field>
          <Field label="Tiers / client"><Input value={form.tiers} onChange={(e) => setForm({ ...form, tiers: e.target.value })} /></Field>
          <Field label="Type de prestation">
            <Select value={form.typePrestation} onValueChange={(v) => setForm({ ...form, typePrestation: v as TypePrestation })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sechage">Séchage</SelectItem>
                <SelectItem value="usinage">Usinage</SelectItem>
                <SelectItem value="triage">Trie optique</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="N° Lot (optionnel)">
            <Select value={form.lotId || "__none__"} onValueChange={(v) => setForm({ ...form, lotId: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucun</SelectItem>
                {appros.map((a) => <SelectItem key={a.id} value={a.id}>{a.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Montant facturé (FCFA)"><Input type="number" value={form.montantFacture || ""} onChange={(e) => setForm({ ...form, montantFacture: Number(e.target.value) })} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={submit}>Enregistrer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewEncaissementDialog({ factureId, onClose }: { factureId: string; onClose: () => void }) {
  const [montant, setMontant] = useState(0);
  const [date, setDate] = useState(comptableActions.todayISO());
  function submit() {
    if (!montant) { toast.error("Montant obligatoire."); return; }
    comptableActions.addEncaissement({ factureId, date, montant });
    toast.success("Encaissement enregistré.");
    onClose();
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="font-display">Enregistrer un encaissement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Montant"><Input type="number" value={montant || ""} onChange={(e) => setMontant(Number(e.target.value))} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Annuler</Button><Button onClick={submit}>Enregistrer</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
