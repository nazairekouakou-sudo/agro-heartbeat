// Store Service Comptable — dépenses, prêts, facturation de prestations.
// Persisté sur Supabase, synchronisé en temps réel.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type Depense = {
  id: string;
  date: string;
  lotId: string | null;
  tiers: string | null;
  categorie: string;
  libelle: string;
  montant: number;
};

export type PretType = "personnel" | "paysan";
export type PretNature = "espece" | "nature";

export type Pret = {
  id: string;
  date: string;
  type: PretType;
  beneficiaire: string;
  nature: PretNature;
  unite: string | null;
  montantInitial: number;
  description: string | null;
};

export type PretRemboursement = {
  id: string;
  pretId: string;
  date: string;
  montant: number;
};

export type TypePrestation = "sechage" | "usinage" | "triage" | "autre";

export type PrestationFacture = {
  id: string;
  date: string;
  lotId: string | null;
  tiers: string;
  typePrestation: TypePrestation;
  montantFacture: number;
  echeance: string | null;
};

export type PrestationEncaissement = {
  id: string;
  factureId: string;
  date: string;
  montant: number;
};

type State = {
  depenses: Depense[];
  prets: Pret[];
  remboursements: PretRemboursement[];
  factures: PrestationFacture[];
  encaissements: PrestationEncaissement[];
  loaded: boolean;
};

const listeners = new Set<() => void>();
let state: State = { depenses: [], prets: [], remboursements: [], factures: [], encaissements: [], loaded: false };

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function depenseFromRow(r: any): Depense {
  return { id: r.id, date: r.date, lotId: r.lot_id, tiers: r.tiers, categorie: r.categorie, libelle: r.libelle, montant: Number(r.montant) };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pretFromRow(r: any): Pret {
  return {
    id: r.id, date: r.date, type: r.type, beneficiaire: r.beneficiaire, nature: r.nature,
    unite: r.unite, montantInitial: Number(r.montant_initial), description: r.description,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function remboursementFromRow(r: any): PretRemboursement {
  return { id: r.id, pretId: r.pret_id, date: r.date, montant: Number(r.montant) };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function factureFromRow(r: any): PrestationFacture {
  return {
    id: r.id, date: r.date, lotId: r.lot_id, tiers: r.tiers, typePrestation: r.type_prestation,
    montantFacture: Number(r.montant_facture), echeance: r.echeance,
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function encaissementFromRow(r: any): PrestationEncaissement {
  return { id: r.id, factureId: r.facture_id, date: r.date, montant: Number(r.montant) };
}

let initPromise: Promise<void> | null = null;

async function refetchAll() {
  const [depRes, pretRes, rembRes, factRes, encRes] = await Promise.all([
    supabase.from("depenses").select("*").order("created_at", { ascending: false }),
    supabase.from("prets").select("*").order("created_at", { ascending: false }),
    supabase.from("pret_remboursements").select("*").order("created_at", { ascending: false }),
    supabase.from("prestations_factures").select("*").order("created_at", { ascending: false }),
    supabase.from("prestation_encaissements").select("*").order("created_at", { ascending: false }),
  ]);
  for (const [name, res] of [
    ["depenses", depRes], ["prets", pretRes], ["pret_remboursements", rembRes],
    ["prestations_factures", factRes], ["prestation_encaissements", encRes],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ] as [string, any][]) {
    if (res.error) console.error(`[comptableStore] ${name}:`, res.error.message);
  }
  state = {
    depenses: (depRes.data ?? []).map(depenseFromRow),
    prets: (pretRes.data ?? []).map(pretFromRow),
    remboursements: (rembRes.data ?? []).map(remboursementFromRow),
    factures: (factRes.data ?? []).map(factureFromRow),
    encaissements: (encRes.data ?? []).map(encaissementFromRow),
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
    .channel("comptable-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "depenses" }, () => refetchAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "prets" }, () => refetchAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "pret_remboursements" }, () => refetchAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "prestations_factures" }, () => refetchAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "prestation_encaissements" }, () => refetchAll())
    .subscribe();
}

export function useComptable() {
  useEffect(() => {
    ensureLoaded();
    ensureRealtime();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const comptableActions = {
  todayISO,

  addDepense(input: Omit<Depense, "id">) {
    const id = nextId("DEP", state.depenses);
    const optimistic: Depense = { ...input, id };
    state = { ...state, depenses: [optimistic, ...state.depenses] };
    emit();
    supabase
      .from("depenses")
      .insert({ id, date: input.date, lot_id: input.lotId, tiers: input.tiers, categorie: input.categorie, libelle: input.libelle, montant: input.montant })
      .then(({ error }) => {
        if (error) {
          console.error("[comptableStore] addDepense:", error.message);
          state = { ...state, depenses: state.depenses.filter((d) => d.id !== id) };
          emit();
        } else refetchAll();
      });
    return id;
  },

  addPret(input: Omit<Pret, "id">) {
    const id = nextId("PRET", state.prets);
    const optimistic: Pret = { ...input, id };
    state = { ...state, prets: [optimistic, ...state.prets] };
    emit();
    supabase
      .from("prets")
      .insert({
        id, date: input.date, type: input.type, beneficiaire: input.beneficiaire, nature: input.nature,
        unite: input.unite, montant_initial: input.montantInitial, description: input.description,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[comptableStore] addPret:", error.message);
          state = { ...state, prets: state.prets.filter((p) => p.id !== id) };
          emit();
        } else refetchAll();
      });
    return id;
  },

  addRemboursement(input: Omit<PretRemboursement, "id">) {
    const id = nextId("REMB", state.remboursements);
    const optimistic: PretRemboursement = { ...input, id };
    state = { ...state, remboursements: [optimistic, ...state.remboursements] };
    emit();
    supabase
      .from("pret_remboursements")
      .insert({ id, pret_id: input.pretId, date: input.date, montant: input.montant })
      .then(({ error }) => {
        if (error) {
          console.error("[comptableStore] addRemboursement:", error.message);
          state = { ...state, remboursements: state.remboursements.filter((r) => r.id !== id) };
          emit();
        } else refetchAll();
      });
    return id;
  },

  addFacture(input: Omit<PrestationFacture, "id">) {
    const id = nextId("FACT", state.factures);
    const optimistic: PrestationFacture = { ...input, id };
    state = { ...state, factures: [optimistic, ...state.factures] };
    emit();
    supabase
      .from("prestations_factures")
      .insert({
        id, date: input.date, lot_id: input.lotId, tiers: input.tiers, type_prestation: input.typePrestation,
        montant_facture: input.montantFacture, echeance: input.echeance,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[comptableStore] addFacture:", error.message);
          state = { ...state, factures: state.factures.filter((f) => f.id !== id) };
          emit();
        } else refetchAll();
      });
    return id;
  },

  addEncaissement(input: Omit<PrestationEncaissement, "id">) {
    const id = nextId("ENC", state.encaissements);
    const optimistic: PrestationEncaissement = { ...input, id };
    state = { ...state, encaissements: [optimistic, ...state.encaissements] };
    emit();
    supabase
      .from("prestation_encaissements")
      .insert({ id, facture_id: input.factureId, date: input.date, montant: input.montant })
      .then(({ error }) => {
        if (error) {
          console.error("[comptableStore] addEncaissement:", error.message);
          state = { ...state, encaissements: state.encaissements.filter((e) => e.id !== id) };
          emit();
        } else refetchAll();
      });
    return id;
  },
};
