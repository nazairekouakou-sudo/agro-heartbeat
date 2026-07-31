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
import { Trash2, Plus } from "lucide-react";

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

        <VarietesCard />
      </div>
    </>
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
