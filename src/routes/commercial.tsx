import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useUsinage, type Decorticage } from "@/lib/usinageStore";
import { useGestion, gestionActions, type RizCategorie } from "@/lib/gestionStore";
import { useCommercial, commercialActions, BOUTIQUES } from "@/lib/commercialStore";

export const Route = createFileRoute("/commercial")({
  head: () => ({
    meta: [
      { title: "Service Commercial — CAPI ERP" },
      { name: "description", content: "Commandes, ventes par boutique et versements caisse." },
    ],
  }),
  component: CommercialPage,
});

const tabs = [
  { id: "commandes", label: "Commandes" },
  { id: "ventes", label: "Ventes par boutique" },
  { id: "versements", label: "Versements caisse" },
] as const;
type TabId = (typeof tabs)[number]["id"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
function fcfa(n: number) {
  return n.toLocaleString("fr-FR") + " F";
}
function fcfaCompact(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " Md";
  if (n >= 1_000_000) return Math.round(n / 1_000_000).toLocaleString("fr-FR") + " M";
  return n.toLocaleString("fr-FR");
}
function daysAgo(iso: string) {
  return (Date.now() - new Date(iso + "T00:00:00").getTime()) / 86_400_000;
}
function thisMonth(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function CommercialPage() {
  const [tab, setTab] = useState<TabId>("commandes");
  const [openCommande, setOpenCommande] = useState(false);
  const [openVente, setOpenVente] = useState(false);
  const [openVersement, setOpenVersement] = useState(false);

  const { decorticages } = useUsinage();
  const { sortiesRiz } = useGestion();
  const { ventes, versements } = useCommercial();

  const caDuMois = useMemo(() => ventes.filter((v) => thisMonth(v.date)).reduce((s, v) => s + v.montant, 0), [ventes]);
  const versementsSemaine = useMemo(
    () => versements.filter((v) => daysAgo(v.date) <= 7).reduce((s, v) => s + v.montantVerse, 0),
    [versements],
  );

  // Groupes de ventes par boutique + date
  const ventesGroupes = useMemo(() => {
    const map = new Map<string, typeof ventes>();
    for (const v of ventes) {
      const key = `${v.boutique} · ${v.date}`;
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return Array.from(map.entries());
  }, [ventes]);

  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Commercial" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Commercial"
          description="Commande le riz auprès de la Gestion, vend en boutique, verse les recettes à la Comptabilité."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="CA du mois" value={fcfaCompact(caDuMois)} hint="FCFA" />
          <StatCard label="Commandes" value={String(sortiesRiz.length)} hint="Toutes qualités" tone="secondary" />
          <StatCard label="Boutiques" value={String(BOUTIQUES.length)} hint={BOUTIQUES.join(" · ")} tone="gold" />
          <StatCard label="Versements semaine" value={fcfaCompact(versementsSemaine)} hint="FCFA" />
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

        {tab === "commandes" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setOpenCommande(true)} className="gap-1.5">
                <Plus className="size-4" /> Nouvelle commande
              </Button>
            </div>
            <DataTable
              columns={["Id commande", "Date", "N° Lot", "Désignation", "Quantité (kg)", "Prix de vente", "Boutique"]}
              rows={sortiesRiz.map((s) => [
                s.commandeId ?? s.id, fmtDate(s.date), s.lotId, s.categorie,
                s.quantite.toLocaleString("fr-FR"), `${s.prixVente}`, s.boutique ?? "—",
              ])}
            />
          </div>
        )}

        {tab === "ventes" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setOpenVente(true)} className="gap-1.5">
                <Plus className="size-4" /> Nouvelle vente
              </Button>
            </div>
            {ventesGroupes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune vente enregistrée.</p>
            )}
            {ventesGroupes.map(([key, rows]) => {
              const total = rows.reduce((s, r) => s + r.montant, 0);
              return (
                <div key={key}>
                  <h3 className="font-display text-lg mb-2">Boutique {key}</h3>
                  <DataTable
                    columns={["Produit", "Stock initial", "Entrée", "Total", "Sortie", "Stock final", "Prix de vente", "Montant"]}
                    rows={[
                      ...rows.map((r) => [
                        r.produit, r.stockInitial.toLocaleString("fr-FR"), r.entree.toLocaleString("fr-FR"),
                        (r.stockInitial + r.entree).toLocaleString("fr-FR"), r.sortie.toLocaleString("fr-FR"),
                        r.stockFinal.toLocaleString("fr-FR"), r.prixVente, fcfa(r.montant),
                      ]),
                      ["Total", "—", "—", "—", "—", "—", "—", fcfa(total)],
                    ]}
                  />
                </div>
              );
            })}
          </div>
        )}

        {tab === "versements" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setOpenVersement(true)} className="gap-1.5">
                <Plus className="size-4" /> Nouveau versement
              </Button>
            </div>
            <DataTable
              columns={["Date", "Boutique", "Montant versé", "Solde restant caisse", "Agent encaisseur"]}
              rows={versements.map((v) => [
                fmtDate(v.date), v.boutique, fcfa(v.montantVerse), fcfa(v.soldeRestant), v.agent,
              ])}
            />
          </div>
        )}
      </div>

      <NewCommandeDialog open={openCommande} onClose={() => setOpenCommande(false)} decorticages={decorticages} existingCount={sortiesRiz.length} />
      <NewVenteDialog open={openVente} onClose={() => setOpenVente(false)} />
      <NewVersementDialog open={openVersement} onClose={() => setOpenVersement(false)} />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

const rizCategories: RizCategorie[] = ["LG + 1X", "2X Cassé", "Fine Brisure"];

function NewCommandeDialog({
  open, onClose, decorticages, existingCount,
}: {
  open: boolean; onClose: () => void; decorticages: Decorticage[]; existingCount: number;
}) {
  const lotIds = useMemo(() => Array.from(new Set(decorticages.map((d) => d.lotId))), [decorticages]);
  const [form, setForm] = useState({
    date: gestionActions.todayISO(),
    lotId: lotIds[0] ?? "",
    categorie: "LG + 1X" as RizCategorie,
    quantite: 0,
    prixVente: 550,
    boutique: BOUTIQUES[0] as string,
  });

  function submit() {
    if (!form.lotId || !form.quantite || !form.prixVente) {
      toast.error("Lot, quantité et prix de vente sont obligatoires.");
      return;
    }
    const commandeId = `CMD-${String(800 + existingCount + 1)}`;
    const id = gestionActions.addSortieRiz({
      date: form.date, commandeId, lotId: form.lotId, categorie: form.categorie,
      quantite: form.quantite, prixVente: form.prixVente, boutique: form.boutique,
    });
    toast.success(`Commande ${commandeId} enregistrée (${id}).`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Nouvelle commande</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Boutique">
            <Select value={form.boutique} onValueChange={(v) => setForm({ ...form, boutique: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BOUTIQUES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="N° Lot">
            <Select value={form.lotId} onValueChange={(v) => setForm({ ...form, lotId: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir un lot" /></SelectTrigger>
              <SelectContent>{lotIds.map((id) => <SelectItem key={id} value={id}>{id}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Qualité">
            <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v as RizCategorie })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{rizCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Quantité (kg)"><Input type="number" value={form.quantite || ""} onChange={(e) => setForm({ ...form, quantite: Number(e.target.value) })} /></Field>
          <Field label="Prix de vente (FCFA/kg)"><Input type="number" value={form.prixVente || ""} onChange={(e) => setForm({ ...form, prixVente: Number(e.target.value) })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewVenteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    date: commercialActions.todayISO(),
    boutique: BOUTIQUES[0] as string,
    produit: "",
    stockInitial: 0,
    entree: 0,
    sortie: 0,
    prixVente: 550,
  });

  function submit() {
    if (!form.produit || !form.prixVente) {
      toast.error("Produit et prix de vente sont obligatoires.");
      return;
    }
    const id = commercialActions.addVente(form);
    toast.success(`Vente ${id} enregistrée.`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Nouvelle vente (journal boutique)</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Boutique">
            <Select value={form.boutique} onValueChange={(v) => setForm({ ...form, boutique: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BOUTIQUES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Produit"><Input value={form.produit} placeholder="PAD-2607-0221 · LG+1X" onChange={(e) => setForm({ ...form, produit: e.target.value })} /></Field>
          <Field label="Prix de vente (FCFA/kg)"><Input type="number" value={form.prixVente || ""} onChange={(e) => setForm({ ...form, prixVente: Number(e.target.value) })} /></Field>
          <Field label="Stock initial (kg)"><Input type="number" value={form.stockInitial || ""} onChange={(e) => setForm({ ...form, stockInitial: Number(e.target.value) })} /></Field>
          <Field label="Entrée (kg)"><Input type="number" value={form.entree || ""} onChange={(e) => setForm({ ...form, entree: Number(e.target.value) })} /></Field>
          <Field label="Sortie / vendu (kg)"><Input type="number" value={form.sortie || ""} onChange={(e) => setForm({ ...form, sortie: Number(e.target.value) })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewVersementDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    date: commercialActions.todayISO(),
    boutique: BOUTIQUES[0] as string,
    montantVerse: 0,
    soldeRestant: 0,
    agent: "",
  });

  function submit() {
    if (!form.montantVerse || !form.agent) {
      toast.error("Montant versé et agent sont obligatoires.");
      return;
    }
    const id = commercialActions.addVersement(form);
    toast.success(`Versement ${id} enregistré.`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-display">Nouveau versement caisse</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Boutique">
            <Select value={form.boutique} onValueChange={(v) => setForm({ ...form, boutique: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BOUTIQUES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Montant versé (FCFA)"><Input type="number" value={form.montantVerse || ""} onChange={(e) => setForm({ ...form, montantVerse: Number(e.target.value) })} /></Field>
          <Field label="Solde restant caisse (FCFA)"><Input type="number" value={form.soldeRestant || ""} onChange={(e) => setForm({ ...form, soldeRestant: Number(e.target.value) })} /></Field>
          <Field label="Agent encaisseur"><Input value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
