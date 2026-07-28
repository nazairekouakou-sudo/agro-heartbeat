// Store Service Usinage — persisté sur Supabase, synchronisé en temps réel entre appareils.
// Étapes : Décorticage → Calibrage (optionnel) → Trie optique.
// Double tarification : coût de charge (interne CAPI) vs coût de
// facturation (facturé au partenaire/prestataire propriétaire du lot,
// via une entrée automatique dans prestations_factures).
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type Qualite = "Blanc" | "Moyen blanc" | "Rouge" | "Autre";
export const QUALITES: Qualite[] = ["Blanc", "Moyen blanc", "Rouge", "Autre"];

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
  puUsinage: number; // coût de charge interne (FCFA/kg riz blanc)
  coutUsinage: number;
};

export type Calibrage = {
  id: string;
  date: string;
  lotId: string;
  decorticageId: string;
  poidsAvant: number;
  poidsApres: number;
  perte: number;
  equipe: string;
  puCalibrage: number;
  coutCalibrage: number;
};

export type LotSource = "paddy" | "riz_externe";

export type TrieOptique = {
  id: string;
  date: string;
  lotId: string;
  lotSource: LotSource;
  decorticageId: string | null;
  rizEntree: number;
  rizApres: number;
  residus: number;
  ecart: number;
  tauxResidus: number;
  tauxRecuperation: number;
  agent: string;
  puTriage: number; // coût de charge interne (FCFA/kg)
  coutTriage: number;
};

// Facturation optionnelle générée automatiquement quand le lot appartient
// à un partenaire/prestataire (créée dans prestations_factures, Comptable).
export type Facturation = { tiers: string; montantFacture: number; typePrestation: "usinage" | "triage" };

type State = { decorticages: Decorticage[]; calibrages: Calibrage[]; tries: TrieOptique[]; loaded: boolean };

const listeners = new Set<() => void>();
let state: State = { decorticages: [], calibrages: [], tries: [], loaded: false };

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

// Qualité désormais saisie manuellement par l'opérateur (couleur/grade du riz blanchi).


async function createFacturation(f: Facturation, date: string, lotId: string | null) {
  const id = `FACT-USI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const { error } = await supabase.from("prestations_factures").insert({
    id, date, lot_id: lotId, tiers: f.tiers, type_prestation: f.typePrestation, montant_facture: f.montantFacture,
  });
  if (error) console.error("[usinageStore] createFacturation:", error.message);
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
function calibrageFromRow(r: any): Calibrage {
  return {
    id: r.id, date: r.date, lotId: r.lot_id, decorticageId: r.decorticage_id,
    poidsAvant: Number(r.poids_avant), poidsApres: Number(r.poids_apres), perte: Number(r.perte),
    equipe: r.equipe, puCalibrage: Number(r.pu_calibrage), coutCalibrage: Number(r.cout_calibrage),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trieFromRow(r: any): TrieOptique {
  return {
    id: r.id, date: r.date, lotId: r.lot_id, lotSource: r.lot_source ?? "paddy", decorticageId: r.decorticage_id,
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

export function mkCalibrage(
  base: Omit<Calibrage, "id" | "perte" | "coutCalibrage"> & { id?: string },
): Calibrage {
  const perte = +(base.poidsAvant - base.poidsApres).toFixed(1);
  const coutCalibrage = Math.round(base.poidsAvant * base.puCalibrage);
  return { ...base, id: base.id ?? "", perte, coutCalibrage };
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
  const [decRes, calRes, trieRes] = await Promise.all([
    supabase.from("decorticages").select("*").order("created_at", { ascending: false }),
    supabase.from("calibrages").select("*").order("created_at", { ascending: false }),
    supabase.from("tries").select("*").order("created_at", { ascending: false }),
  ]);
  if (decRes.error) console.error("[usinageStore] decorticages:", decRes.error.message);
  if (calRes.error) console.error("[usinageStore] calibrages:", calRes.error.message);
  if (trieRes.error) console.error("[usinageStore] tries:", trieRes.error.message);
  state = {
    decorticages: (decRes.data ?? []).map(decorticageFromRow),
    calibrages: (calRes.data ?? []).map(calibrageFromRow),
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
    .on("postgres_changes", { event: "*", schema: "public", table: "calibrages" }, () => refetchAll())
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
    facturation?: Facturation | null,
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
          if (facturation) createFacturation(facturation, input.date, input.lotId);
        }
      });

    return id;
  },

  addCalibrage(input: Omit<Calibrage, "id" | "perte" | "coutCalibrage">) {
    const id = nextId("CAL", state.calibrages);
    const optimistic = mkCalibrage({ ...input, id });
    state = { ...state, calibrages: [optimistic, ...state.calibrages] };
    emit();

    supabase
      .from("calibrages")
      .insert({
        id, date: input.date, lot_id: input.lotId, decorticage_id: input.decorticageId,
        poids_avant: input.poidsAvant, poids_apres: input.poidsApres,
        equipe: input.equipe, pu_calibrage: input.puCalibrage,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[usinageStore] addCalibrage:", error.message);
          state = { ...state, calibrages: state.calibrages.filter((c) => c.id !== id) };
          emit();
        } else {
          refetchAll();
        }
      });

    return id;
  },

  addTrie(
    input: Omit<TrieOptique, "id" | "ecart" | "tauxResidus" | "tauxRecuperation" | "coutTriage">,
    facturation?: Facturation | null,
  ) {
    const id = nextId("TRI", state.tries);
    const optimistic = mkTrie({ ...input, id });
    state = { ...state, tries: [optimistic, ...state.tries] };
    emit();

    supabase
      .from("tries")
      .insert({
        id, date: input.date, lot_id: input.lotId, lot_source: input.lotSource,
        decorticage_id: input.decorticageId, riz_entree: input.rizEntree, riz_apres: input.rizApres,
        residus: input.residus, agent: input.agent, pu_triage: input.puTriage,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[usinageStore] addTrie:", error.message);
          state = { ...state, tries: state.tries.filter((t) => t.id !== id) };
          emit();
        } else {
          refetchAll();
          if (facturation) createFacturation(facturation, input.date, input.lotId);
        }
      });

    return id;
  },
};

export { computeQualite };
