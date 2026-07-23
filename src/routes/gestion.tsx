import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable, StatCard } from "@/components/PageBits";
import { ShieldCheck, XCircle, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePaddy, type Appro, type LotStatus } from "@/lib/paddyStore";
import { useUsinage, type Decorticage } from "@/lib/usinageStore";
import { useGestion, gestionActions, type RizCategorie } from "@/lib/gestionStore";

export const Route = createFileRoute("/gestion")({
  head: () => ({
    meta: [
      { title: "Service Gestion — CAPI ERP" },
      {
        name: "description",
        content: "Contrôle, validation et arbitrage des flux physiques et financiers.",
      },
    ],
  }),
  component: GestionPage,
});

const tabs = [
  { id: "stock-paddy", label: "Stock paddy" },
  { id: "entree-riz", label: "Entrée riz blanchi" },
  { id: "sortie-riz", label: "Sortie riz blanchi" },
  { id: "validation", label: "Validations en attente" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}
function fcfa(n: number) {
  return n.toLocaleString("fr-FR") + " F";
}
function kg(n: number) {
  return n.toLocaleString("fr-FR");
}

// Regroupe les statuts de lot en apparence visuelle
function statusTone(status: LotStatus): "ok" | "warn" | "muted" {
  if (status === "Stocké") return "ok";
  if (status === "En séchage" || status === "Collecte") return "warn";
  return "muted"; // Envoyé usinage / Sortie tiers
}

function GestionPage() {
  const [tab, setTab] = useState<TabId>("stock-paddy");
  const [openSortie, setOpenSortie] = useState(false);

  const { appros, sechages, sorties } = usePaddy();
  const { decorticages, tries } = useUsinage();
  const { sortiesRiz, validations } = useGestion();

  // ---------- Stock paddy : dérivé des données Paddy ----------
  const stockPaddyTonnes = useMemo(
    () =>
      appros
        .filter((a) => a.status === "Collecte" || a.status === "En séchage" || a.status === "Stocké")
        .reduce((sum, a) => sum + a.poids, 0) / 1000,
    [appros],
  );

  function derniereOperation(a: Appro): string {
    const sechagesLot = sechages.filter((s) => s.lotId === a.id);
    const sortiesLot = sorties.filter((s) => s.lotId === a.id);
    const events = [
      { date: a.dateEntree, label: "Entrée" },
      ...sechagesLot.map((s) => ({ date: s.date, label: "Séchage" })),
      ...sortiesLot.map((s) => ({ date: s.date, label: `Sortie → ${s.destination}` })),
    ].sort((x, y) => (x.date < y.date ? 1 : -1));
    const last = events[0];
    return `${last.label} ${fmtDate(last.date)}`;
  }

  // ---------- Entrée riz blanchi : dérivé des décorticages Usinage ----------
  const rizEntreeRows = useMemo(() => {
    const rows: { date: string; lotId: string; categorie: string; qte: number; entity: string }[] = [];
    for (const d of decorticages) {
      const appro = appros.find((a) => a.id === d.lotId);
      const entity = appro?.entityName ?? "—";
      if (d.lg1x > 0) rows.push({ date: d.date, lotId: d.lotId, categorie: "LG + 1X", qte: d.lg1x, entity });
      if (d.casse2x > 0) rows.push({ date: d.date, lotId: d.lotId, categorie: "2X Cassé", qte: d.casse2x, entity });
      if (d.fb > 0) rows.push({ date: d.date, lotId: d.lotId, categorie: "Fine Brisure", qte: d.fb, entity });
    }
    return rows;
  }, [decorticages, appros]);

  const stockRizTonnes = useMemo(() => {
    const produit = decorticages.reduce((sum, d) => sum + d.rizBlanchi, 0);
    const sorti = sortiesRiz.reduce((sum, s) => sum + s.quantite, 0);
    return Math.max(0, produit - sorti) / 1000;
  }, [decorticages, sortiesRiz]);

  const ecartsDetectes = useMemo(() => tries.filter((t) => Math.abs(t.ecart) > 0).length, [tries]);
  const aValiderCount = useMemo(() => validations.filter((v) => v.status === "en_attente").length, [validations]);

  return (
    <>
      <AppTopbar eyebrow="Chaîne de valeur" title="Service Gestion" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Service Gestion"
          description="Ne paie pas, n'exécute pas. Contrôle, valide, arbitre et certifie toutes les opérations avant transmission à la comptabilité."
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Stock paddy total" value={`${stockPaddyTonnes.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`} hint={`${appros.length} lots suivis`} />
          <StatCard label="Stock riz blanchi" value={`${stockRizTonnes.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} t`} hint="LG+1X · 2X · FB" tone="secondary" />
          <StatCard label="À valider" value={String(aValiderCount)} hint="États en attente" tone="gold" />
          <StatCard label="Écarts détectés" value={String(ecartsDetectes)} hint="Trie optique" />
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
              {t.id === "validation" && aValiderCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center size-4 rounded-full bg-gold/25 text-gold-foreground text-[10px]">
                  {aValiderCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "stock-paddy" && (
          <DataTable
            columns={["N° Lot", "Zone", "Entité", "Variété", "TH", "Sacs", "Poids (kg)", "Statut", "Dernière opération"]}
            rows={appros.map((a) => [
              a.id, a.zone, a.entityName, a.variete, `${a.th}%`, a.sacs, kg(a.poids),
              <StatusPill key={a.id} k={a.status} tone={statusTone(a.status)} />,
              derniereOperation(a),
            ])}
          />
        )}

        {tab === "entree-riz" && (
          <DataTable
            columns={["Date", "N° Lot", "Qualité", "Quantité (kg)", "Entité"]}
            rows={rizEntreeRows.map((r) => [fmtDate(r.date), r.lotId, r.categorie, kg(r.qte), r.entity])}
          />
        )}

        {tab === "sortie-riz" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setOpenSortie(true)} className="gap-1.5">
                <Plus className="size-4" /> Nouvelle sortie
              </Button>
            </div>
            <DataTable
              columns={["Date", "Id commande", "N° Lot", "Qualité", "Quantité (kg)", "Prix de vente"]}
              rows={sortiesRiz.map((s) => [
                fmtDate(s.date), s.commandeId ?? "—", s.lotId, s.categorie, kg(s.quantite), `${s.prixVente} FCFA/kg`,
              ])}
            />
          </div>
        )}

        {tab === "validation" && (
          <div className="card-elevated p-4 space-y-2">
            {validations.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune validation pour l'instant.</p>
            )}
            {validations.map((v) => (
              <div key={v.id} className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/40 border border-border">
                <div
                  className={`size-9 rounded-lg flex items-center justify-center ${
                    v.status === "validee"
                      ? "bg-success/15 text-success"
                      : v.status === "rejetee"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-warning/15 text-warning"
                  }`}
                >
                  {v.status === "validee" ? (
                    <CheckCircle2 className="size-4" />
                  ) : v.status === "rejetee" ? (
                    <XCircle className="size-4" />
                  ) : (
                    <AlertCircle className="size-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{v.ref}</div>
                  <div className="text-xs text-muted-foreground">{v.service}</div>
                </div>
                <div className="text-sm tabular-nums font-medium">{v.montant}</div>
                {v.status === "en_attente" ? (
                  <div className="flex gap-1.5">
                    <button
                      onClick={async () => {
                        await gestionActions.resolveValidation(v.id, "validee");
                        toast.success(`${v.ref} validé.`);
                      }}
                      className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs inline-flex items-center gap-1.5"
                    >
                      <ShieldCheck className="size-3.5" /> Valider
                    </button>
                    <button
                      onClick={async () => {
                        await gestionActions.resolveValidation(v.id, "rejetee");
                        toast.error(`${v.ref} rejeté.`);
                      }}
                      className="h-8 px-3 rounded-md border border-border text-xs inline-flex items-center gap-1.5"
                    >
                      <XCircle className="size-3.5" /> Rejeter
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground w-20 text-right capitalize">{v.status}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <NewSortieRizDialog open={openSortie} onClose={() => setOpenSortie(false)} decorticages={decorticages} />
    </>
  );
}

function StatusPill({ k, tone }: { k: string; tone: "ok" | "warn" | "muted" }) {
  const m = {
    ok: "bg-success/15 text-success",
    warn: "bg-warning/15 text-warning",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] ${m[tone]}`}>{k}</span>;
}

const rizCategories: RizCategorie[] = ["LG + 1X", "2X Cassé", "Fine Brisure"];

function NewSortieRizDialog({
  open,
  onClose,
  decorticages,
}: {
  open: boolean;
  onClose: () => void;
  decorticages: Decorticage[];
}) {
  const lotIds = useMemo(() => Array.from(new Set(decorticages.map((d) => d.lotId))), [decorticages]);
  const [form, setForm] = useState({
    date: gestionActions.todayISO(),
    commandeId: "",
    lotId: lotIds[0] ?? "",
    categorie: "LG + 1X" as RizCategorie,
    quantite: 0,
    prixVente: 550,
  });

  function submit() {
    if (!form.lotId || !form.quantite || !form.prixVente) {
      toast.error("Lot, quantité et prix de vente sont obligatoires.");
      return;
    }
    const id = gestionActions.addSortieRiz({
      date: form.date,
      commandeId: form.commandeId || null,
      lotId: form.lotId,
      categorie: form.categorie,
      quantite: form.quantite,
      prixVente: form.prixVente,
      boutique: null,
    });
    toast.success(`Sortie ${id} enregistrée.`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Nouvelle sortie riz blanchi</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Id commande (optionnel)">
            <Input value={form.commandeId} placeholder="CMD-0812" onChange={(e) => setForm({ ...form, commandeId: e.target.value })} />
          </Field>
          <Field label="N° Lot">
            <Select value={form.lotId} onValueChange={(v) => setForm({ ...form, lotId: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir un lot" /></SelectTrigger>
              <SelectContent>
                {lotIds.map((id) => (
                  <SelectItem key={id} value={id}>{id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Qualité">
            <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v as RizCategorie })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {rizCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Quantité (kg)">
            <Input type="number" value={form.quantite || ""} onChange={(e) => setForm({ ...form, quantite: Number(e.target.value) })} />
          </Field>
          <Field label="Prix de vente (FCFA/kg)">
            <Input type="number" value={form.prixVente || ""} onChange={(e) => setForm({ ...form, prixVente: Number(e.target.value) })} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
