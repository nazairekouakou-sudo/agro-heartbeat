// Actions génériques de ligne : modification et suppression.
// Utilisé par tous les services pour éditer/supprimer une donnée enregistrée.
import { useEffect, useState } from "react";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export type FieldSpec = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "select";
  options?: readonly string[];
};

export type RowValues = Record<string, unknown>;

export function RowActions({
  label,
  fields,
  values,
  onSave,
  onDelete,
  title = "Modifier",
}: {
  label: string;
  fields: FieldSpec[];
  values: RowValues;
  onSave: (patch: RowValues) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  title?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState<RowValues>(values);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) setForm(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  async function save() {
    setBusy(true);
    try {
      const patch: RowValues = {};
      for (const f of fields) patch[f.key] = form[f.key];
      await onSave(patch);
      toast.success(`${label} modifié.`);
      setEditing(false);
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await onDelete();
      toast.success(`${label} supprimé.`);
      setConfirming(false);
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions ${label}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditing(true)} className="gap-2">
            <Pencil className="size-3.5" /> Modifier
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirming(true)} className="gap-2 text-destructive focus:text-destructive">
            <Trash2 className="size-3.5" /> Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={(v) => !v && setEditing(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {title} — {label}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                {f.type === "select" ? (
                  <Select
                    value={String(form[f.key] ?? "")}
                    onValueChange={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={
                      form[f.key] === null || form[f.key] === undefined ? "" : String(form[f.key])
                    }
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Annuler
            </Button>
            <Button onClick={save} disabled={busy}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={(v) => !v && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {label} ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. La donnée sera retirée de tous les suivis et rapports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
