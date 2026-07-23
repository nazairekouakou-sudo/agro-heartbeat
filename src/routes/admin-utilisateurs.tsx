import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireRole } from "@/components/RequireRole";
import { AppTopbar } from "@/components/AppTopbar";
import { PageHeader, DataTable } from "@/components/PageBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { usePaddy } from "@/lib/paddyStore";
import type { AppRole } from "@/lib/authStore";

export const Route = createFileRoute("/admin-utilisateurs")({
  head: () => ({ meta: [{ title: "Gestion des comptes — CAPI ERP" }] }),
  component: () => (
    <RequireRole roles={["admin"]}>
      <AdminUtilisateursPage />
    </RequireRole>
  ),
});

const roleLabels: Record<AppRole, string> = {
  admin: "Admin",
  paddy: "Paddy",
  usinage: "Usinage",
  gestion: "Gestion",
  commercial: "Commercial",
  comptable: "Comptable",
  partenaire: "Partenaire",
};

type ProfileRow = { id: string; fullName: string; role: AppRole; entityName: string | null; pin: string | null; createdAt: string };

function randomPin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function AdminUtilisateursPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEmploye, setOpenEmploye] = useState(false);
  const [openPartenaire, setOpenPartenaire] = useState(false);
  const { appros } = usePaddy();

  const partenairesExistants = useMemo(
    () => Array.from(new Set(appros.filter((a) => a.entity === "Partenaire").map((a) => a.entityName))),
    [appros],
  );

  async function loadProfiles() {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Erreur de chargement : " + error.message);
    } else {
      setProfiles(
        (data ?? []).map((r) => ({
          id: r.id, fullName: r.full_name, role: r.role, entityName: r.entity_name, pin: r.pin, createdAt: r.created_at,
        })),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadProfiles();
  }, []);

  return (
    <>
      <AppTopbar eyebrow="Administration" title="Gestion des comptes" />
      <div className="p-6 space-y-6 overflow-y-auto">
        <PageHeader
          title="Comptes utilisateurs"
          description="Crée et consulte les comptes employés (PIN) et partenaires (email) de CAPI ERP."
          actions={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpenPartenaire(true)} className="gap-1.5">
                <Plus className="size-4" /> Partenaire
              </Button>
              <Button size="sm" onClick={() => setOpenEmploye(true)} className="gap-1.5">
                <Plus className="size-4" /> Employé
              </Button>
            </div>
          }
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : (
          <DataTable
            columns={["Nom", "Rôle", "PIN / Entité", "Créé le"]}
            rows={profiles.map((p) => [
              p.fullName,
              roleLabels[p.role] ?? p.role,
              p.role === "partenaire" ? (p.entityName ?? "—") : (p.pin ?? "—"),
              new Date(p.createdAt).toLocaleDateString("fr-FR"),
            ])}
          />
        )}
      </div>

      <NewEmployeDialog open={openEmploye} onClose={() => setOpenEmploye(false)} onCreated={loadProfiles} />
      <NewPartenaireDialog
        open={openPartenaire}
        onClose={() => setOpenPartenaire(false)}
        onCreated={loadProfiles}
        entitesConnues={partenairesExistants}
      />
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

const employeRoles: AppRole[] = ["admin", "paddy", "usinage", "gestion", "commercial", "comptable"];

function NewEmployeDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("paddy");
  const [pin, setPin] = useState(randomPin());
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!fullName || pin.length !== 6) {
      toast.error("Nom et PIN à 6 chiffres obligatoires.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-create-account", {
      body: { fullName, role, pin },
    });
    setLoading(false);
    if (error || data?.error) {
      toast.error("Erreur : " + (data?.error ?? error?.message ?? "inconnue"));
      return;
    }
    toast.success(`Compte créé pour ${fullName}. PIN : ${pin}`);
    setFullName("");
    setPin(randomPin());
    onCreated();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display">Nouvel employé</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Nom complet"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus /></Field>
          <Field label="Rôle">
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {employeRoles.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="PIN à 6 chiffres">
            <div className="flex gap-2">
              <Input
                value={pin}
                maxLength={6}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="font-mono tracking-widest"
              />
              <Button type="button" variant="outline" onClick={() => setPin(randomPin())}>Régénérer</Button>
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Création…" : "Créer le compte"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewPartenaireDialog({
  open, onClose, onCreated, entitesConnues,
}: {
  open: boolean; onClose: () => void; onCreated: () => void; entitesConnues: string[];
}) {
  const [fullName, setFullName] = useState("");
  const [entityName, setEntityName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!fullName || !entityName || !email || password.length < 6) {
      toast.error("Tous les champs sont obligatoires (mot de passe : 6 caractères min).");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-create-account", {
      body: { fullName, role: "partenaire", email, password, entityName },
    });
    setLoading(false);
    if (error || data?.error) {
      toast.error("Erreur : " + (data?.error ?? error?.message ?? "inconnue"));
      return;
    }
    toast.success(`Compte partenaire créé pour ${fullName}.`);
    setFullName(""); setEntityName(""); setEmail(""); setPassword("");
    onCreated();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display">Nouveau partenaire</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Nom complet"><Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus /></Field>
          <Field label="Entité (doit correspondre exactement au nom utilisé dans Paddy)">
            <Input
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
              placeholder="ex: Partenaire NORD"
              list="entites-connues"
            />
            <datalist id="entites-connues">
              {entitesConnues.map((e) => <option key={e} value={e} />)}
            </datalist>
          </Field>
          <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Mot de passe temporaire"><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={loading}>{loading ? "Création…" : "Créer le compte"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
