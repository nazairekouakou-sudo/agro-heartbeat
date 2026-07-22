// Mock in-memory store for Service Usinage — client-side only.
import { useSyncExternalStore } from "react";

export type Qualite = "Blanc premium" | "Blanc" | "Moyen blanc" | "Standard" | "Écart";

export type Decorticage = {
  id: string;
  date: string;
  lotId: string;
  sacs: number;
  poidsPaddy: number; // kg
  th: number; // %
  lg1x: number; // kg (LG + 1X — grain entier)
  casse2x: number; // kg
  fb: number; // kg (farine / brisures fines)
  rizBlanchi: number; // auto = lg1x + casse2x + fb
  sonPaille: number; // auto = poidsPaddy - rizBlanchi
  rendement: number; // % auto = rizBlanchi / poidsPaddy
  tauxCasse: number; // % auto = casse2x / rizBlanchi
  qualite: Qualite;
  equipe: string;
  puUsinage: number; // FCFA / kg
  coutUsinage: number; // auto = poidsPaddy * puUsinage
};

export type TrieOptique = {
  id: string;
  date: string;
  lotId: string;
  decorticageId: string;
  rizEntree: number; // kg
  rizApres: number; // kg
  residus: number; // kg
  ecart: number; // auto = rizEntree - rizApres - residus
  tauxResidus: number; // % auto = residus / rizEntree
  tauxRecuperation: number; // % auto = rizApres / rizEntree
  agent: string;
  puTriage: number; // FCFA / kg
  coutTriage: number; // auto = rizEntree * puTriage
};

type State = { decorticages: Decorticage[]; tries: TrieOptique[] };

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return state; }

function todayISO() { return new Date().toISOString().slice(0, 10); }
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

export function mkDecorticage(
  base: Omit<Decorticage, "id" | "rizBlanchi" | "sonPaille" | "rendement" | "tauxCasse" | "qualite" | "coutUsinage"> & { id?: string }
): Decorticage {
  const rizBlanchi = +(base.lg1x + base.casse2x + base.fb).toFixed(1);
  const sonPaille = +(base.poidsPaddy - rizBlanchi).toFixed(1);
  const rendement = base.poidsPaddy ? +((rizBlanchi / base.poidsPaddy) * 100).toFixed(1) : 0;
  const tauxCasse = rizBlanchi ? +((base.casse2x / rizBlanchi) * 100).toFixed(1) : 0;
  const qualite = computeQualite(rendement, tauxCasse);
  const coutUsinage = Math.round(base.poidsPaddy * base.puUsinage);
  return {
    ...base,
    id: base.id ?? "",
    rizBlanchi, sonPaille, rendement, tauxCasse, qualite, coutUsinage,
  };
}

export function mkTrie(
  base: Omit<TrieOptique, "id" | "ecart" | "tauxResidus" | "tauxRecuperation" | "coutTriage"> & { id?: string }
): TrieOptique {
  const ecart = +(base.rizEntree - base.rizApres - base.residus).toFixed(1);
  const tauxResidus = base.rizEntree ? +((base.residus / base.rizEntree) * 100).toFixed(1) : 0;
  const tauxRecuperation = base.rizEntree ? +((base.rizApres / base.rizEntree) * 100).toFixed(1) : 0;
  const coutTriage = Math.round(base.rizEntree * base.puTriage);
  return { ...base, id: base.id ?? "", ecart, tauxResidus, tauxRecuperation, coutTriage };
}

const seedDec: Decorticage[] = [
  mkDecorticage({
    id: "DEC-001", date: "2026-07-14", lotId: "PAD-2607-0230",
    sacs: 180, poidsPaddy: 8780, th: 13,
    lg1x: 5100, casse2x: 780, fb: 120,
    equipe: "Équipe A", puUsinage: 25,
  }),
  mkDecorticage({
    id: "DEC-002", date: "2026-07-14", lotId: "PAD-2607-0231",
    sacs: 120, poidsPaddy: 5850, th: 14,
    lg1x: 3400, casse2x: 520, fb: 80,
    equipe: "Équipe B", puUsinage: 25,
  }),
];

const seedTries: TrieOptique[] = [
  mkTrie({
    id: "TRI-001", date: "2026-07-14", lotId: "PAD-2607-0230", decorticageId: "DEC-001",
    rizEntree: 5100, rizApres: 4880, residus: 200,
    agent: "A. Sarr", puTriage: 10,
  }),
];

const state: State = { decorticages: seedDec, tries: seedTries };

export function useUsinage() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const usinageActions = {
  todayISO,
  addDecorticage(input: Omit<Decorticage, "id" | "rizBlanchi" | "sonPaille" | "rendement" | "tauxCasse" | "qualite" | "coutUsinage">) {
    const id = nextId("DEC", state.decorticages);
    state.decorticages = [mkDecorticage({ ...input, id }), ...state.decorticages];
    emit();
    return id;
  },
  addTrie(input: Omit<TrieOptique, "id" | "ecart" | "tauxResidus" | "tauxRecuperation" | "coutTriage">) {
    const id = nextId("TRI", state.tries);
    state.tries = [mkTrie({ ...input, id }), ...state.tries];
    emit();
    return id;
  },
};

export { computeQualite };
