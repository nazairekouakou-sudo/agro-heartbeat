// Store Service Usinage — persisté sur Supabase, synchronisé en temps réel entre appareils.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type Qualite = "Blanc premium" | "Blanc" | "Moyen blanc" | "Standard" | "Écart";

export type Decorticage = {
  id: string;
  date: string;
  lotId: string;
  sacs: number;
  poidsPaddy: number;
  th: number;
  lg1x: number;
  casse2x: number;
  fb: number;
  rizBlanchi: number;
  sonPaille: number;
  rendement: number;
  tauxCasse: number;
  qualite: Qualite;
  equipe: string;
  puUsinage: number;
  coutUsinage: number;
};

export type TrieOptique = {
  id: string;
  date: string;
  lotId: string;
  decorticageId: string;
  rizEntree: number;
  rizApres: number;
  residus: number;
  ecart: number;
  tauxResidus: number;
  tauxRecuperation: number;
  agent: string;
  puTriage: number;
  coutTriage: number;
};

type State = { decorticages: Decorticage[]; tries: TrieOptique[]; loaded: boolean };

const listeners = new Set<() => void>();
let state: State = { decorticages: [], tries: [], loaded: false };

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

function computeQualite(rendement: number, tauxCasse: number): Qualite {
  if (rendement >= 70 && tauxCasse < 10) return "Blanc premium";
  if (rendement >= 67 && tauxCasse < 14) return "Blanc";
  if (rendement >= 63 && tauxCasse < 18) return "Moyen blanc";
  if (rendement >= 58) return "Standard";
  return "Écart";
}

// ---------- Row <-> App type mapping ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function decorticageFromRow(r: any): Decorticage {
  return {
    id: r.id, date: r.date, lotId: r.lot_id, sacs: r.sacs, poidsPaddy: Number(r.poids_paddy),
    th: Number(r.th), lg1x: Number(r.lg1x), casse2x: Number(r.casse2x), fb: Number(r.fb),
    rizBlanchi: Number(r.riz_blanchi), sonPaille: Number(r.son_paille),
    rendement: Number(r.rendement), tauxCasse: Number(r.taux_casse), qualite: r.qualite,
    equipe: r.equipe, puUsinage: Number(r.pu_usinage), coutUsinage: Number(r.cout_usinage),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trieFromRow(r: any): TrieOptique {
  return {
    id: r.id, date: r.date, lotId: r.lot_id, decorticageId: r.decorticage_id,
    rizEntree: Number(r.riz_entree), rizApres: Number(r.riz_apres), residus: Number(r.residus),
    ecart: Number(r.ecart), tauxResidus: Number(r.taux_residus),
    tauxRecuperation: Number(r.taux_recuperation), agent: r.agent,
    puTriage: Number(r.pu_triage), coutTriage: Number(r.cout_triage),
  };
}

// ---------- Calcul local optimiste ----------

export function mkDecorticage(
  base: Omit<Decorticage, "id" | "rizBlanchi" | "sonPaille" | "rendement" | "tauxCasse" | "qualite" | "coutUsinage"> & { id?: string },
): Decorticage {
  const rizBlanchi = +(base.lg1x + base.casse2x + base.fb).toFixed(1);
  const sonPaille = +(base.poidsPaddy - rizBlanchi).toFixed(1);
  const rendement = base.poidsPaddy ? +((rizBlanchi / base.poidsPaddy) * 100).toFixed(1) : 0;
  const tauxCasse = rizBlanchi ? +((base.casse2x / rizBlanchi) * 100).toFixed(1) : 0;
  const qualite = computeQualite(rendement, tauxCasse);
  const coutUsinage = Math.round(base.poidsPaddy * base.puUsinage);
  return { ...base, id: base.id ?? "", rizBlanchi, sonPaille, rendement, tauxCasse, qualite, coutUsinage };
}

export function mkTrie(
  base: Omit<TrieOptique, "id" | "ecart" | "tauxResidus" | "tauxRecuperation" | "coutTriage"> & { id?: string },
): TrieOptique {
  const ecart = +(base.rizEntree - base.rizApres - base.residus).toFixed(1);
  const tauxResidus = base.rizEntree ? +((base.residus / base.rizEntree) * 100).toFixed(1) : 0;
  const tauxRecuperation = base.rizEntree ? +((base.rizApres / base.rizEntree) * 100).toFixed(1) : 0;
  const coutTriage = Math.round(base.rizEntree * base.puTriage);
  return { ...base, id: base.id ?? "", ecart, tauxResidus, tauxRecuperation, coutTriage };
}

// ---------- Chargement + temps réel ----------

let initPromise: Promise<void> | null = null;

async function refetchAll() {
  const [decRes, trieRes] = await Promise.all([
    supabase.from("decorticages").select("*").order("created_at", { ascending: false }),
    supabase.from("tries").select("*").order("created_at", { ascending: false }),
  ]);
  if (decRes.error) console.error("[usinageStore] decorticages:", decRes.error.message);
  if (trieRes.error) console.error("[usinageStore] tries:", trieRes.error.message);
  state = {
    decorticages: (decRes.data ?? []).map(decorticageFromRow),
    tries: (trieRes.data ?? []).map(trieFromRow),
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
    .channel("usinage-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "decorticages" }, () => refetchAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "tries" }, () => refetchAll())
    .subscribe();
}

export function useUsinage() {
  useEffect(() => {
    ensureLoaded();
    ensureRealtime();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const usinageActions = {
  todayISO,

  addDecorticage(
    input: Omit<Decorticage, "id" | "rizBlanchi" | "sonPaille" | "rendement" | "tauxCasse" | "qualite" | "coutUsinage">,
  ) {
    const id = nextId("DEC", state.decorticages);
    const optimistic = mkDecorticage({ ...input, id });
    state = { ...state, decorticages: [optimistic, ...state.decorticages] };
    emit();

    supabase
      .from("decorticages")
      .insert({
        id, date: input.date, lot_id: input.lotId, sacs: input.sacs,
        poids_paddy: input.poidsPaddy, th: input.th, lg1x: input.lg1x,
        casse2x: input.casse2x, fb: input.fb, qualite: optimistic.qualite,
        equipe: input.equipe, pu_usinage: input.puUsinage,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[usinageStore] addDecorticage:", error.message);
          state = { ...state, decorticages: state.decorticages.filter((d) => d.id !== id) };
          emit();
        } else {
          refetchAll();
        }
      });

    return id;
  },

  addTrie(input: Omit<TrieOptique, "id" | "ecart" | "tauxResidus" | "tauxRecuperation" | "coutTriage">) {
    const id = nextId("TRI", state.tries);
    const optimistic = mkTrie({ ...input, id });
    state = { ...state, tries: [optimistic, ...state.tries] };
    emit();

    supabase
      .from("tries")
      .insert({
        id, date: input.date, lot_id: input.lotId, decorticage_id: input.decorticageId,
        riz_entree: input.rizEntree, riz_apres: input.rizApres, residus: input.residus,
        agent: input.agent, pu_triage: input.puTriage,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[usinageStore] addTrie:", error.message);
          state = { ...state, tries: state.tries.filter((t) => t.id !== id) };
          emit();
        } else {
          refetchAll();
        }
      });

    return id;
  },
};

export { computeQualite };
