// Store Service Commercial — ventes par boutique + versements caisse.
// Les "commandes" réutilisent la table sorties_riz de Gestion (voir gestionStore.ts).
// Persisté sur Supabase, synchronisé en temps réel.
import { useEffect, useSyncExternalStore } from "react";
import { toRow } from "./rowMap";
import { supabase } from "./supabaseClient";
import { queuedInsert } from "./offlineQueue";

export const BOUTIQUES = ["Dakar Centre", "St-Louis", "Thiès", "Louga"] as const;
export type Boutique = (typeof BOUTIQUES)[number];

export type VenteBoutique = {
  id: string;
  date: string;
  boutique: string;
  produit: string;
  stockInitial: number;
  entree: number;
  sortie: number;
  stockFinal: number;
  prixVente: number;
  montant: number;
};

export type VersementCaisse = {
  id: string;
  date: string;
  boutique: string;
  montantVerse: number;
  soldeRestant: number;
  agent: string;
};

type State = { ventes: VenteBoutique[]; versements: VersementCaisse[]; loaded: boolean };

const listeners = new Set<() => void>();
let state: State = { ventes: [], versements: [], loaded: false };

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
function venteFromRow(r: any): VenteBoutique {
  return {
    id: r.id, date: r.date, boutique: r.boutique, produit: r.produit,
    stockInitial: Number(r.stock_initial), entree: Number(r.entree), sortie: Number(r.sortie),
    stockFinal: Number(r.stock_final), prixVente: Number(r.prix_vente), montant: Number(r.montant),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function versementFromRow(r: any): VersementCaisse {
  return {
    id: r.id, date: r.date, boutique: r.boutique, montantVerse: Number(r.montant_verse),
    soldeRestant: Number(r.solde_restant), agent: r.agent,
  };
}

// ---------- Chargement + temps réel ----------

let initPromise: Promise<void> | null = null;

async function refetchAll() {
  const [ventesRes, versementsRes] = await Promise.all([
    supabase.from("ventes_boutique").select("*").order("created_at", { ascending: false }),
    supabase.from("versements_caisse").select("*").order("created_at", { ascending: false }),
  ]);
  if (ventesRes.error) console.error("[commercialStore] ventes_boutique:", ventesRes.error.message);
  if (versementsRes.error) console.error("[commercialStore] versements_caisse:", versementsRes.error.message);
  state = {
    ventes: (ventesRes.data ?? []).map(venteFromRow),
    versements: (versementsRes.data ?? []).map(versementFromRow),
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
    .channel("commercial-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "ventes_boutique" }, () => refetchAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "versements_caisse" }, () => refetchAll())
    .subscribe();
}

export function useCommercial() {
  useEffect(() => {
    ensureLoaded();
    ensureRealtime();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const commercialActions = {
  todayISO,

  addVente(input: Omit<VenteBoutique, "id" | "stockFinal" | "montant">) {
    const id = nextId("VTE", state.ventes);
    const stockFinal = input.stockInitial + input.entree - input.sortie;
    const montant = input.sortie * input.prixVente;
    const optimistic: VenteBoutique = { ...input, id, stockFinal, montant };
    state = { ...state, ventes: [optimistic, ...state.ventes] };
    emit();

    queuedInsert("ventes_boutique", {
      id, date: input.date, boutique: input.boutique, produit: input.produit,
      stock_initial: input.stockInitial, entree: input.entree, sortie: input.sortie,
      prix_vente: input.prixVente,
    }).then(({ error, queued }) => {
      if (error) {
        console.error("[commercialStore] addVente:", error);
        state = { ...state, ventes: state.ventes.filter((v) => v.id !== id) };
        emit();
      } else if (!queued) {
        refetchAll();
      }
    });

    return id;
  },

  addVersement(input: Omit<VersementCaisse, "id">) {
    const id = nextId("VER", state.versements);
    const optimistic: VersementCaisse = { ...input, id };
    state = { ...state, versements: [optimistic, ...state.versements] };
    emit();

    queuedInsert("versements_caisse", {
      id, date: input.date, boutique: input.boutique, montant_verse: input.montantVerse,
      solde_restant: input.soldeRestant, agent: input.agent,
    }).then(({ error, queued }) => {
      if (error) {
        console.error("[commercialStore] addVersement:", error);
        state = { ...state, versements: state.versements.filter((v) => v.id !== id) };
        emit();
      } else if (!queued) {
        refetchAll();
      }
    });

    return id;
  },
};

// ---------- Modification / suppression ----------

const VENTE_COLS: Partial<Record<keyof VenteBoutique, string>> = {
  date: "date", boutique: "boutique", produit: "produit", stockInitial: "stock_initial",
  entree: "entree", sortie: "sortie", prixVente: "prix_vente",
};

const VERS_COLS: Partial<Record<keyof VersementCaisse, string>> = {
  date: "date", boutique: "boutique", montantVerse: "montant_verse",
  soldeRestant: "solde_restant", agent: "agent",
};

async function commercialMutate(table: string, id: string, row: Record<string, unknown>) {
  const { error } = await supabase.from(table).update(row).eq("id", id);
  if (error) throw error;
  await refetchAll();
}

async function commercialRemove(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  await refetchAll();
}

export const commercialCrud = {
  updateVente: (id: string, patch: Partial<VenteBoutique>) => commercialMutate("ventes_boutique", id, toRow(patch, VENTE_COLS)),
  removeVente: (id: string) => commercialRemove("ventes_boutique", id),
  updateVersement: (id: string, patch: Partial<VersementCaisse>) => commercialMutate("versements_caisse", id, toRow(patch, VERS_COLS)),
  removeVersement: (id: string) => commercialRemove("versements_caisse", id),
};
