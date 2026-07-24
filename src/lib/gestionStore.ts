// Store Service Gestion — sorties riz blanchi + file de validations.
// Persisté sur Supabase, synchronisé en temps réel.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type RizCategorie = "Riz blanc" | "2X Cassé" | "Fine Brisure";

export type SortieRiz = {
  id: string;
  date: string;
  commandeId: string | null;
  lotId: string;
  categorie: RizCategorie;
  quantite: number;
  prixVente: number;
  montant: number;
  boutique: string | null;
};

export type ValidationStatus = "en_attente" | "validee" | "rejetee";

export type Validation = {
  id: string;
  ref: string;
  service: string;
  montant: string;
  status: ValidationStatus;
  sourceTable: string;
  sourceId: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
};

type State = { sortiesRiz: SortieRiz[]; validations: Validation[]; loaded: boolean };

const listeners = new Set<() => void>();
let state: State = { sortiesRiz: [], validations: [], loaded: false };

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function getSnapshot() {
  return state;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nextId(prefix: string, list: { id: string }[]) {
  return `${prefix}-${String(list.length + 1).padStart(3, "0")}`;
}

// ---------- Row <-> App type mapping ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortieRizFromRow(r: any): SortieRiz {
  return {
    id: r.id, date: r.date, commandeId: r.commande_id, lotId: r.lot_id,
    categorie: r.categorie, quantite: Number(r.quantite), prixVente: Number(r.prix_vente),
    montant: Number(r.montant), boutique: r.boutique ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validationFromRow(r: any): Validation {
  return {
    id: r.id, ref: r.ref, service: r.service, montant: r.montant, status: r.status,
    sourceTable: r.source_table, sourceId: r.source_id, createdAt: r.created_at,
    resolvedAt: r.resolved_at, resolvedBy: r.resolved_by,
  };
}

// ---------- Chargement + temps réel ----------

let initPromise: Promise<void> | null = null;

async function refetchAll() {
  const [sortiesRes, validationsRes] = await Promise.all([
    supabase.from("sorties_riz").select("*").order("created_at", { ascending: false }),
    supabase.from("validations").select("*").order("created_at", { ascending: false }),
  ]);
  if (sortiesRes.error) console.error("[gestionStore] sorties_riz:", sortiesRes.error.message);
  if (validationsRes.error) console.error("[gestionStore] validations:", validationsRes.error.message);
  state = {
    sortiesRiz: (sortiesRes.data ?? []).map(sortieRizFromRow),
    validations: (validationsRes.data ?? []).map(validationFromRow),
    loaded: true,
  };
  emit();
}

function ensureLoaded() {
  if (!initPromise) initPromise = refetchAll();
  return initPromise;
}

let realtimeStarted = false;
function ensureRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;
  supabase
    .channel("gestion-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "sorties_riz" }, () => refetchAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "validations" }, () => refetchAll())
    .subscribe();
}

export function useGestion() {
  useEffect(() => {
    ensureLoaded();
    ensureRealtime();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const gestionActions = {
  todayISO,

  addSortieRiz(input: Omit<SortieRiz, "id" | "montant">) {
    const id = nextId("SOR-RIZ", state.sortiesRiz);
    const montant = input.quantite * input.prixVente;
    const optimistic: SortieRiz = { ...input, id, montant };
    state = { ...state, sortiesRiz: [optimistic, ...state.sortiesRiz] };
    emit();

    supabase
      .from("sorties_riz")
      .insert({
        id, date: input.date, commande_id: input.commandeId, lot_id: input.lotId,
        categorie: input.categorie, quantite: input.quantite, prix_vente: input.prixVente,
        boutique: input.boutique,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[gestionStore] addSortieRiz:", error.message);
          state = { ...state, sortiesRiz: state.sortiesRiz.filter((s) => s.id !== id) };
          emit();
        } else {
          refetchAll();
        }
      });

    return id;
  },

  async resolveValidation(id: string, status: "validee" | "rejetee", resolvedBy = "Admin CAPI") {
    // Optimistic
    state = {
      ...state,
      validations: state.validations.map((v) =>
        v.id === id ? { ...v, status, resolvedAt: new Date().toISOString(), resolvedBy } : v,
      ),
    };
    emit();

    const { error } = await supabase
      .from("validations")
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
      .eq("id", id);
    if (error) {
      console.error("[gestionStore] resolveValidation:", error.message);
      refetchAll();
    }
  },
};
