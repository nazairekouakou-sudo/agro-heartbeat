// Store Service Gestion — sorties riz blanchi, réceptions riz externe,
// file de validations. Persisté sur Supabase, synchronisé en temps réel.
import { useEffect, useSyncExternalStore } from "react";
import { toRow } from "./rowMap";
import { supabase } from "./supabaseClient";
import type { Entity } from "./paddyStore";

export type RizCategorie = "Long grain" | "2X Cassé" | "Fine Brisure";

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

export type ReceptionRizExterneStatut = "recu" | "en_triage" | "trie";

// La variété du riz vient du référentiel partagé (voir varietesStore.ts).

export type DestinationRizExterne = "Calibrage" | "Trieuse optique" | "Vente";
export const DESTINATIONS_RIZ_EXTERNE: DestinationRizExterne[] = ["Calibrage", "Trieuse optique", "Vente"];

// Riz blanc déjà décortiqué, envoyé par un partenaire/prestataire
// directement pour triage (sans passer par Paddy → Décorticage CAPI).
// A son propre numéro de lot, distinct des lots paddy (appros).
export type ReceptionRizExterne = {
  id: string; // numéro de lot dédié, ex: REXT-001
  date: string;
  entityType: Entity;
  entityName: string;
  poids: number;
  variete: string;
  destination: DestinationRizExterne;
  statut: ReceptionRizExterneStatut;
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
  paid: boolean;
  paidAt: string | null;
  paidBy: string | null;
};

type State = {
  sortiesRiz: SortieRiz[];
  receptionsExternes: ReceptionRizExterne[];
  validations: Validation[];
  loaded: boolean;
};

const listeners = new Set<() => void>();
let state: State = { sortiesRiz: [], receptionsExternes: [], validations: [], loaded: false };

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
function receptionFromRow(r: any): ReceptionRizExterne {
  return {
    id: r.id, date: r.date, entityType: r.entity_type, entityName: r.entity_name,
    poids: Number(r.poids),
    variete: r.variete ?? r.qualite ?? "—",
    destination: (r.destination ?? "Trieuse optique") as DestinationRizExterne,
    statut: r.statut,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validationFromRow(r: any): Validation {
  return {
    id: r.id, ref: r.ref, service: r.service, montant: r.montant, status: r.status,
    sourceTable: r.source_table, sourceId: r.source_id, createdAt: r.created_at,
    resolvedAt: r.resolved_at, resolvedBy: r.resolved_by,
    paid: r.paid ?? false, paidAt: r.paid_at ?? null, paidBy: r.paid_by ?? null,
  };
}

// ---------- Chargement + temps réel ----------

let initPromise: Promise<void> | null = null;

async function refetchAll() {
  const [sortiesRes, receptionsRes, validationsRes] = await Promise.all([
    supabase.from("sorties_riz").select("*").order("created_at", { ascending: false }),
    supabase.from("receptions_riz_externe").select("*").order("created_at", { ascending: false }),
    supabase.from("validations").select("*").order("created_at", { ascending: false }),
  ]);
  if (sortiesRes.error) console.error("[gestionStore] sorties_riz:", sortiesRes.error.message);
  if (receptionsRes.error) console.error("[gestionStore] receptions_riz_externe:", receptionsRes.error.message);
  if (validationsRes.error) console.error("[gestionStore] validations:", validationsRes.error.message);
  state = {
    sortiesRiz: (sortiesRes.data ?? []).map(sortieRizFromRow),
    receptionsExternes: (receptionsRes.data ?? []).map(receptionFromRow),
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
    .on("postgres_changes", { event: "*", schema: "public", table: "receptions_riz_externe" }, () => refetchAll())
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

  addReceptionExterne(input: Omit<ReceptionRizExterne, "id" | "statut">) {
    const id = nextId("REXT", state.receptionsExternes);
    const optimistic: ReceptionRizExterne = { ...input, id, statut: "recu" };
    state = { ...state, receptionsExternes: [optimistic, ...state.receptionsExternes] };
    emit();

    supabase
      .from("receptions_riz_externe")
      .insert({
        id, date: input.date, entity_type: input.entityType, entity_name: input.entityName,
        poids: input.poids, variete: input.variete, destination: input.destination,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[gestionStore] addReceptionExterne:", error.message);
          state = { ...state, receptionsExternes: state.receptionsExternes.filter((r) => r.id !== id) };
          emit();
        } else {
          refetchAll();
        }
      });

    return id;
  },

  async updateReceptionStatut(id: string, statut: ReceptionRizExterneStatut) {
    state = {
      ...state,
      receptionsExternes: state.receptionsExternes.map((r) => (r.id === id ? { ...r, statut } : r)),
    };
    emit();
    const { error } = await supabase.from("receptions_riz_externe").update({ statut }).eq("id", id);
    if (error) {
      console.error("[gestionStore] updateReceptionStatut:", error.message);
      refetchAll();
    }
  },

  async resolveValidation(id: string, status: "validee" | "rejetee", resolvedBy = "Admin CAPI") {
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

  async payValidation(id: string, paidBy = "Comptabilité CAPI") {
    state = {
      ...state,
      validations: state.validations.map((v) =>
        v.id === id ? { ...v, paid: true, paidAt: new Date().toISOString(), paidBy } : v,
      ),
    };
    emit();

    const { error } = await supabase
      .from("validations")
      .update({ paid: true, paid_at: new Date().toISOString(), paid_by: paidBy })
      .eq("id", id);
    if (error) {
      console.error("[gestionStore] payValidation:", error.message);
      refetchAll();
    }
  },
};

// ---------- Modification / suppression ----------

const SORTIE_RIZ_COLS: Partial<Record<keyof SortieRiz, string>> = {
  date: "date", commandeId: "commande_id", lotId: "lot_id", categorie: "categorie",
  quantite: "quantite", prixVente: "prix_vente", boutique: "boutique",
};

const RECEPTION_COLS: Partial<Record<keyof ReceptionRizExterne, string>> = {
  date: "date", entityType: "entity_type", entityName: "entity_name", poids: "poids",
  variete: "variete", destination: "destination", statut: "statut",
};

async function gestionMutate(table: string, id: string, row: Record<string, unknown>) {
  const { error } = await supabase.from(table).update(row).eq("id", id);
  if (error) throw error;
  await refetchAll();
}

async function gestionRemove(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  await refetchAll();
}

export const gestionCrud = {
  updateSortieRiz: (id: string, patch: Partial<SortieRiz>) => gestionMutate("sorties_riz", id, toRow(patch, SORTIE_RIZ_COLS)),
  removeSortieRiz: (id: string) => gestionRemove("sorties_riz", id),
  updateReceptionExterne: (id: string, patch: Partial<ReceptionRizExterne>) => gestionMutate("receptions_riz_externe", id, toRow(patch, RECEPTION_COLS)),
  removeReceptionExterne: (id: string) => gestionRemove("receptions_riz_externe", id),
  updateValidation: (id: string, patch: { ref?: string; service?: string; montant?: string }) => gestionMutate("validations", id, patch),
  removeValidation: (id: string) => gestionRemove("validations", id),
};
