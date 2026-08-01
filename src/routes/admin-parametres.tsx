import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader } from "@/components/PageBits";
import { RequireRole } from "@/components/RequireRole";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useTarifs, tarifsActions } from "@/lib/tarifsStore";
import { useAuth } from "@/lib/authStore";
import { useVarietes, varietesActions } from "@/lib/varietesStore";
import { useBoutiques, boutiquesActions, type Boutique } from "@/lib/boutiquesStore";
import { useCampagnes, campagnesActions, type Campagne } from "@/lib/campagnesStore";
import { Trash2, Plus, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/admin-parametres")({
  head: () => ({ meta: [{ title: "Paramètres — CAPI ERP" }] }),
  component: () => (
    <RequireRole roles={["admin"]}>
      <ParametresPage />
    </RequireRole>
  ),
});

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{suffix}</span>
      </div>
    </div>
  );
}

function ParametresPage() {
  const tarifs = useTarifs();
  const { profile } = useAuth();
  const [form, setForm] = useState(tarifs);
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm(tarifs), [tarifs]);

  async function save() {
    setSaving(true);
    try {
      await tarifsActions.update(form, profile?.fullName ?? "Admin CAPI");
      toast.success("Grille tarifaire mise à jour.");
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppTopbar eyebrow="Administration" title="Paramètres" />
      <div className="p-6 space-y-6 max-w-2xl">
        <PageHeader
          title="Grille tarifaire"
          description="Prix officiels utilisés par défaut dans les formulaires de vente et de prestations. Chaque valeur reste modifiable au cas par cas lors de la saisie."
        />

        <div className="card-elevated p-5 space-y-5">
          <div>
            <h3 className="font-display text-base mb-3">Prix de vente du riz (FCFA / kg)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Long grain" value={form.prixRizBlanc} onChange={(v) => setForm({ ...form, prixRizBlanc: v })} suffix="FCFA/kg" />
              <Field label="2X Cassé" value={form.prix2xCasse} onChange={(v) => setForm({ ...form, prix2xCasse: v })} suffix="FCFA/kg" />
              <Field label="Fine Brisure" value={form.prixFineBrisure} onChange={(v) => setForm({ ...form, prixFineBrisure: v })} suffix="FCFA/kg" />
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="font-display text-base mb-1">Usinage — Coût de charge (interne CAPI)</h3>
            <p className="text-xs text-muted-foreground mb-3">Ce que le traitement coûte réellement à CAPI, utilisé pour son propre suivi financier.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Décorticage" value={form.puDecorticageCharge} onChange={(v) => setForm({ ...form, puDecorticageCharge: v })} suffix="FCFA/kg long grain" />
              <Field label="Calibrage" value={form.puCalibrageCharge} onChange={(v) => setForm({ ...form, puCalibrageCharge: v })} suffix="FCFA/kg long grain" />
              <Field label="Trie optique" value={form.puTriageCharge} onChange={(v) => setForm({ ...form, puTriageCharge: v })} suffix="FCFA/kg riz non trié" />
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="font-display text-base mb-1">Usinage — Coût de facturation (partenaires / prestataires)</h3>
            <p className="text-xs text-muted-foreground mb-3">Ce que CAPI facture au tiers propriétaire du lot pour la prestation rendue.</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Field label="Décorticage — Tranche A" value={form.puDecorticageFactureA} onChange={(v) => setForm({ ...form, puDecorticageFactureA: v })} suffix="FCFA/kg long grain" />
              <Field label="Décorticage — Tranche B" value={form.puDecorticageFactureB} onChange={(v) => setForm({ ...form, puDecorticageFactureB: v })} suffix="FCFA/kg paddy" />
              <Field label="Décorticage — Tranche Ecos" value={form.puDecorticageFactureEcos} onChange={(v) => setForm({ ...form, puDecorticageFactureEcos: v })} suffix="FCFA/kg long grain" />
              <Field label="Trie optique" value={form.puTriageFacture} onChange={(v) => setForm({ ...form, puTriageFacture: v })} suffix="FCFA/kg riz non trié" />
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="font-display text-base mb-3">Séchage (FCFA / sac)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Séchage" value={form.puSechage} onChange={(v) => setForm({ ...form, puSechage: v })} suffix="FCFA/sac" />
            </div>
          </div>

          {tarifs.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Dernière mise à jour : {new Date(tarifs.updatedAt).toLocaleString("fr-FR")} par {tarifs.updatedBy ?? "—"}
            </p>
          )}

          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer la grille tarifaire"}</Button>
        </div>

        <CampagnesCard />

        <VarietesCard />

        <BoutiquesCard />
      </div>
    </>
  );
}

function CampagneRow({ campagne, busy, setBusy }: { campagne: Campagne; busy: boolean; setBusy: (b: boolean) => void }) {
  const [nom, setNom] = useState(campagne.nom);
  const [debut, setDebut] = useState(campagne.dateDebut ?? "");
  const [fin, setFin] = useState(campagne.dateFin ?? "");

  useEffect(() => {
    setNom(campagne.nom);
    setDebut(campagne.dateDebut ?? "");
    setFin(campagne.dateFin ?? "");
  }, [campagne.nom, campagne.dateDebut, campagne.dateFin]);

  const dirty = nom !== campagne.nom || debut !== (campagne.dateDebut ?? "") || fin !== (campagne.dateFin ?? "");

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end border-t border-border pt-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Campagne {campagne.active && <span className="text-primary">— en cours</span>}
        </Label>
        <Input value={nom} onChange={(e) => setNom(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Début</Label>
        <Input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Fin</Label>
        <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy || !dirty}
          onClick={() => run(() => campagnesActions.update(campagne.id, { nom, dateDebut: debut, dateFin: fin }), "Campagne mise à jour.")}
        >
          Enregistrer
        </Button>
        {!campagne.active && (
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            disabled={busy}
            onClick={() => run(() => campagnesActions.setActive(campagne.id), `« ${campagne.nom} » est désormais la campagne en cours.`)}
          >
            <CheckCircle2 className="size-4" /> Rendre active
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive"
          disabled={busy}
          aria-label={`Supprimer ${campagne.nom}`}
          onClick={() => run(() => campagnesActions.remove(campagne.id), `Campagne « ${campagne.nom} » supprimée.`)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function CampagnesCard() {
  const { campagnes } = useCampagnes();
  const [nom, setNom] = useState("");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!nom.trim()) {
      toast.error("Saisissez le nom de la campagne (ex : 2024-2025).");
      return;
    }
    setBusy(true);
    try {
      await campagnesActions.add({ nom, dateDebut: debut, dateFin: fin });
      toast.success(`Campagne « ${nom.trim()} » ajoutée.`);
      setNom(""); setDebut(""); setFin("");
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-elevated p-5 space-y-4">
      <div>
        <h3 className="font-display text-base mb-1">Campagnes agricoles</h3>
        <p className="text-xs text-muted-foreground">
          Référentiel des campagnes. La campagne « en cours » est proposée par défaut lors des saisies,
          mais il reste possible de choisir une campagne antérieure (reprise d'historique).
        </p>
      </div>

      {campagnes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucune campagne enregistrée. Créez d'abord la campagne antérieure, puis la campagne en cours.
        </p>
      )}
      {campagnes.map((c) => (
        <CampagneRow key={c.id} campagne={c} busy={busy} setBusy={setBusy} />
      ))}

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end border-t border-border pt-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nouvelle campagne</Label>
          <Input value={nom} placeholder="Ex : 2024-2025" onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Début</Label>
          <Input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Fin</Label>
          <Input type="date" value={fin} onChange={(e) => setFin(e.target.value)} />
        </div>
        <Button onClick={add} disabled={busy} className="gap-1.5">
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>
    </div>
  );
}

function VarietesCard() {
  const { varietes } = useVarietes();
  const [nom, setNom] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!nom.trim()) {
      toast.error("Saisissez le nom de la variété.");
      return;
    }
    setBusy(true);
    try {
      await varietesActions.add(nom);
      toast.success(`Variété « ${nom.trim()} » ajoutée.`);
      setNom("");
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, label: string) {
    setBusy(true);
    try {
      await varietesActions.remove(id);
      toast.success(`Variété « ${label} » supprimée.`);
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-elevated p-5 space-y-4">
      <div>
        <h3 className="font-display text-base mb-1">Variétés de riz</h3>
        <p className="text-xs text-muted-foreground">
          Référentiel partagé : utilisé dans le Service Paddy (approvisionnement) et dans les réceptions de
          riz externe du Service Gestion.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {varietes.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune variété enregistrée.</p>
        )}
        {varietes.map((v) => (
          <span
            key={v.id}
            className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full border border-border text-sm"
          >
            {v.nom}
            <button
              onClick={() => remove(v.id, v.nom)}
              disabled={busy}
              aria-label={`Supprimer ${v.nom}`}
              className="size-5 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-end gap-2 max-w-sm">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nouvelle variété</Label>
          <Input
            value={nom}
            placeholder="Ex : Nerica 4"
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
        </div>
        <Button onClick={add} disabled={busy} className="gap-1.5">
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>
    </div>
  );
}

function BoutiqueRow({ boutique, busy, setBusy }: { boutique: Boutique; busy: boolean; setBusy: (b: boolean) => void }) {
  const [name, setName] = useState(boutique.name);
  const [seller, setSeller] = useState(boutique.sellerName ?? "");

  useEffect(() => {
    setName(boutique.name);
    setSeller(boutique.sellerName ?? "");
  }, [boutique.name, boutique.sellerName]);

  const dirty = name !== boutique.name || seller !== (boutique.sellerName ?? "");

  async function save() {
    setBusy(true);
    try {
      await boutiquesActions.update(boutique.id, { name, sellerName: seller });
      toast.success("Boutique mise à jour.");
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await boutiquesActions.remove(boutique.id);
      toast.success(`Boutique « ${boutique.name} » supprimée.`);
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end border-t border-border pt-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Boutique</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Vendeuse</Label>
        <Input value={seller} placeholder="Nom de la vendeuse" onChange={(e) => setSeller(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={save} disabled={busy || !dirty}>Enregistrer</Button>
        <Button size="sm" variant="ghost" onClick={remove} disabled={busy} aria-label={`Supprimer ${boutique.name}`}>
          <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function BoutiquesCard() {
  const { boutiques, loaded } = useBoutiques();
  const [nom, setNom] = useState("");
  const [vendeuse, setVendeuse] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!nom.trim()) {
      toast.error("Saisissez le nom de la boutique.");
      return;
    }
    setBusy(true);
    try {
      await boutiquesActions.add(nom, vendeuse);
      toast.success(`Boutique « ${nom.trim()} » ajoutée.`);
      setNom("");
      setVendeuse("");
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-elevated p-5 space-y-4">
      <div>
        <h3 className="font-display text-base mb-1">Boutiques &amp; vendeuses</h3>
        <p className="text-xs text-muted-foreground">
          Référentiel partagé : utilisé dans le Service Commercial (commandes, ventes par boutique, versements
          de caisse).
        </p>
      </div>

      <div className="space-y-3">
        {loaded && boutiques.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune boutique enregistrée.</p>
        )}
        {boutiques.map((b) => (
          <BoutiqueRow key={b.id} boutique={b} busy={busy} setBusy={setBusy} />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end border-t border-border pt-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nouvelle boutique</Label>
          <Input value={nom} placeholder="Ex : Boutique Tazibouo" onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Vendeuse</Label>
          <Input
            value={vendeuse}
            placeholder="Nom de la vendeuse"
            onChange={(e) => setVendeuse(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
        </div>
        <Button onClick={add} disabled={busy} className="gap-1.5">
          <Plus className="size-4" /> Ajouter
        </Button>
      </div>
    </div>
  );
}
