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
      <AppTopbar eyebrow="Administration" title="Paramètres — Grille tarifaire" />
      <div className="p-6 space-y-6 max-w-2xl">
        <PageHeader
          title="Grille tarifaire"
          description="Prix officiels utilisés par défaut dans les formulaires de vente et de prestations. Chaque valeur reste modifiable au cas par cas lors de la saisie."
        />

        <div className="card-elevated p-5 space-y-5">
          <div>
            <h3 className="font-display text-base mb-3">Prix de vente du riz (FCFA / kg)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Riz blanc" value={form.prixRizBlanc} onChange={(v) => setForm({ ...form, prixRizBlanc: v })} suffix="FCFA/kg" />
              <Field label="2X Cassé" value={form.prix2xCasse} onChange={(v) => setForm({ ...form, prix2xCasse: v })} suffix="FCFA/kg" />
              <Field label="Fine Brisure" value={form.prixFineBrisure} onChange={(v) => setForm({ ...form, prixFineBrisure: v })} suffix="FCFA/kg" />
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h3 className="font-display text-base mb-3">Tarifs de prestations (FCFA / kg)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Décorticage" value={form.puDecorticage} onChange={(v) => setForm({ ...form, puDecorticage: v })} suffix="FCFA/kg" />
              <Field label="Trie optique" value={form.puTriage} onChange={(v) => setForm({ ...form, puTriage: v })} suffix="FCFA/kg" />
              <Field label="Séchage (par sac)" value={form.puSechage} onChange={(v) => setForm({ ...form, puSechage: v })} suffix="FCFA/sac" />
            </div>
          </div>

          {tarifs.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Dernière mise à jour : {new Date(tarifs.updatedAt).toLocaleString("fr-FR")} par {tarifs.updatedBy ?? "—"}
            </p>
          )}

          <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer la grille tarifaire"}</Button>
        </div>
      </div>
    </>
  );
}
