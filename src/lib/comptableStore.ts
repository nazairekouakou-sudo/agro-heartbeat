// Store Service Comptable — dépenses, prêts, facturation de prestations.
// Persisté sur Supabase, synchronisé en temps réel.
import { useEffect, useSyncExternalStore } from "react";
import { toRow } from "./rowMap";
import { supabase } from "./supabaseClient";
import { queuedInsert } from "./offlineQueue";

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
    queuedInsert("depenses", { id, date: input.date, lot_id: input.lotId, tiers: input.tiers, categorie: input.categorie, libelle: input.libelle, montant: input.montant })
      .then(({ error, queued }) => {
        if (error) {
          console.error("[comptableStore] addDepense:", error);
          state = { ...state, depenses: state.depenses.filter((d) => d.id !== id) };
          emit();
        } else if (!queued) refetchAll();
      });
    return id;
  },

  addPret(input: Omit<Pret, "id">) {
    const id = nextId("PRET", state.prets);
    const optimistic: Pret = { ...input, id };
    state = { ...state, prets: [optimistic, ...state.prets] };
    emit();
    queuedInsert("prets", {
      id, date: input.date, type: input.type, beneficiaire: input.beneficiaire, nature: input.nature,
      unite: input.unite, montant_initial: input.montantInitial, description: input.description,
    })
      .then(({ error, queued }) => {
        if (error) {
          console.error("[comptableStore] addPret:", error);
          state = { ...state, prets: state.prets.filter((p) => p.id !== id) };
          emit();
        } else if (!queued) refetchAll();
      });
    return id;
  },

  addRemboursement(input: Omit<PretRemboursement, "id">) {
    const id = nextId("REMB", state.remboursements);
    const optimistic: PretRemboursement = { ...input, id };
    state = { ...state, remboursements: [optimistic, ...state.remboursements] };
    emit();
    queuedInsert("pret_remboursements", { id, pret_id: input.pretId, date: input.date, montant: input.montant })
      .then(({ error, queued }) => {
        if (error) {
          console.error("[comptableStore] addRemboursement:", error);
          state = { ...state, remboursements: state.remboursements.filter((r) => r.id !== id) };
          emit();
        } else if (!queued) refetchAll();
      });
    return id;
  },

  addFacture(input: Omit<PrestationFacture, "id">) {
    const id = nextId("FACT", state.factures);
    const optimistic: PrestationFacture = { ...input, id };
    state = { ...state, factures: [optimistic, ...state.factures] };
    emit();
    queuedInsert("prestations_factures", {
      id, date: input.date, lot_id: input.lotId, tiers: input.tiers, type_prestation: input.typePrestation,
      montant_facture: input.montantFacture, echeance: input.echeance,
    })
      .then(({ error, queued }) => {
        if (error) {
          console.error("[comptableStore] addFacture:", error);
          state = { ...state, factures: state.factures.filter((f) => f.id !== id) };
          emit();
        } else if (!queued) refetchAll();
      });
    return id;
  },

  addEncaissement(input: Omit<PrestationEncaissement, "id">) {
    const id = nextId("ENC", state.encaissements);
    const optimistic: PrestationEncaissement = { ...input, id };
    state = { ...state, encaissements: [optimistic, ...state.encaissements] };
    emit();
    queuedInsert("prestation_encaissements", { id, facture_id: input.factureId, date: input.date, montant: input.montant })
      .then(({ error, queued }) => {
        if (error) {
          console.error("[comptableStore] addEncaissement:", error);
          state = { ...state, encaissements: state.encaissements.filter((e) => e.id !== id) };
          emit();
        } else if (!queued) refetchAll();
      });
    return id;
  },
};

// ---------- Modification / suppression ----------

const DEP_COLS: Partial<Record<keyof Depense, string>> = {
  date: "date", lotId: "lot_id", tiers: "tiers", categorie: "categorie",
  libelle: "libelle", montant: "montant",
};

const PRET_COLS: Partial<Record<keyof Pret, string>> = {
  date: "date", type: "type", beneficiaire: "beneficiaire", nature: "nature",
  unite: "unite", montantInitial: "montant_initial", description: "description",
};

const REMB_COLS: Partial<Record<keyof PretRemboursement, string>> = {
  pretId: "pret_id", date: "date", montant: "montant",
};

const FACT_COLS: Partial<Record<keyof PrestationFacture, string>> = {
  date: "date", lotId: "lot_id", tiers: "tiers", typePrestation: "type_prestation",
  montantFacture: "montant_facture", echeance: "echeance",
};

const ENC_COLS: Partial<Record<keyof PrestationEncaissement, string>> = {
  factureId: "facture_id", date: "date", montant: "montant",
};

async function comptableMutate(table: string, id: string, row: Record<string, unknown>) {
  const { error } = await supabase.from(table).update(row).eq("id", id);
  if (error) throw error;
  await refetchAll();
}

async function comptableRemove(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  await refetchAll();
}

export const comptableCrud = {
  updateDepense: (id: string, patch: Partial<Depense>) => comptableMutate("depenses", id, toRow(patch, DEP_COLS)),
  removeDepense: (id: string) => comptableRemove("depenses", id),
  updatePret: (id: string, patch: Partial<Pret>) => comptableMutate("prets", id, toRow(patch, PRET_COLS)),
  removePret: (id: string) => comptableRemove("prets", id),
  updateRemboursement: (id: string, patch: Partial<PretRemboursement>) => comptableMutate("pret_remboursements", id, toRow(patch, REMB_COLS)),
  removeRemboursement: (id: string) => comptableRemove("pret_remboursements", id),
  updateFacture: (id: string, patch: Partial<PrestationFacture>) => comptableMutate("prestations_factures", id, toRow(patch, FACT_COLS)),
  removeFacture: (id: string) => comptableRemove("prestations_factures", id),
  updateEncaissement: (id: string, patch: Partial<PrestationEncaissement>) => comptableMutate("prestation_encaissements", id, toRow(patch, ENC_COLS)),
  removeEncaissement: (id: string) => comptableRemove("prestation_encaissements", id),
};
