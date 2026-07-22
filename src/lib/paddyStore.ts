// Mock in-memory store for Service Paddy — client-side only, no persistence.
import { useSyncExternalStore } from "react";

export type Entity = "CAPI" | "Partenaire" | "Prestataire";
export type LotStatus =
  | "Collecte"
  | "En séchage"
  | "Stocké"
  | "Envoyé usinage"
  | "Sortie tiers";

export type Appro = {
  id: string; // N° Lot
  dateAppro: string;
  dateEntree: string;
  zone: string;
  entity: Entity;
  entityName: string; // ex: "CAPI", "Partenaire NORD", "M. Diouf"
  variete: string;
  th: number; // %
  ti: number; // %
  sacs: number;
  poids: number; // kg
  pm: number; // kg / sac (auto)
  agent: string;
  // Finances amont
  pu: number; // FCFA / kg
  cap: number; // auto = poids * pu
  charge: number; // chargement
  pesage: number;
  dechargement: number;
  transport: number;
  fraisAnnexes: number;
  prime: number;
  chargeTotale: number; // auto
  status: LotStatus;
};

export type Sechage = {
  id: string;
  date: string;
  lotId: string;
  thInitial: number;
  sacs: number;
  poidsAvant: number;
  jours: number;
  thApres: number;
  poidsApres: number;
  variation: number; // auto
  agent: string;
  puSechage: number; // FCFA / sac
  montant: number; // auto
};

export type Sortie = {
  id: string;
  date: string;
  lotId: string;
  th: number;
  sacs: number;
  poids: number;
  pm: number;
  destination: string; // "Usinage" | libellé tiers
  agent: string;
  charge: number;
  pesage: number;
  deplacement: number;
  chargeTotale: number;
};

type State = {
  appros: Appro[];
  sechages: Sechage[];
  sorties: Sortie[];
};

const listeners = new Set<() => void>();

function nextLotId(existing: Appro[]): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PAD-${yy}${mm}-`;
  const nums = existing
    .map((a) => a.id)
    .filter((s) => s.startsWith(prefix))
    .map((s) => parseInt(s.slice(prefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 230) + 1;
  return prefix + String(next).padStart(4, "0");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Seed
const seedAppros: Appro[] = [
  mkAppro({
    dateAppro: "2026-07-12", dateEntree: "2026-07-12", zone: "Podor",
    entity: "Partenaire", entityName: "Partenaire NORD", variete: "JT 11",
    th: 22, ti: 3, sacs: 240, poids: 12000, agent: "M. Ba",
    pu: 300, charge: 24000, pesage: 12000, dechargement: 24000,
    transport: 180000, fraisAnnexes: 15000, prime: 20000,
  }, "PAD-2607-0231", "Stocké"),
  mkAppro({
    dateAppro: "2026-07-12", dateEntree: "2026-07-12", zone: "Rosso",
    entity: "CAPI", entityName: "CAPI", variete: "Bouaké",
    th: 20, ti: 2, sacs: 180, poids: 9000, agent: "F. Diop",
    pu: 305, charge: 18000, pesage: 9000, dechargement: 18000,
    transport: 150000, fraisAnnexes: 10000, prime: 15000,
  }, "PAD-2607-0232", "En séchage"),
  mkAppro({
    dateAppro: "2026-07-11", dateEntree: "2026-07-12", zone: "Fanaye",
    entity: "Partenaire", entityName: "Partenaire SUD", variete: "CY-2",
    th: 24, ti: 4, sacs: 320, poids: 16000, agent: "M. Ba",
    pu: 295, charge: 32000, pesage: 16000, dechargement: 32000,
    transport: 220000, fraisAnnexes: 18000, prime: 25000,
  }, "PAD-2607-0230", "Envoyé usinage"),
];

function mkAppro(
  base: Omit<Appro, "id" | "pm" | "cap" | "chargeTotale" | "status">,
  id: string,
  status: LotStatus,
): Appro {
  const pm = base.sacs ? +(base.poids / base.sacs).toFixed(2) : 0;
  const cap = base.poids * base.pu;
  const chargeTotale =
    cap + base.charge + base.pesage + base.dechargement +
    base.transport + base.fraisAnnexes + base.prime;
  return { ...base, id, pm, cap, chargeTotale, status };
}

const state: State = {
  appros: seedAppros,
  sechages: [
    {
      id: "SEC-001", date: "2026-07-13", lotId: "PAD-2607-0232",
      thInitial: 20, sacs: 180, poidsAvant: 9000, jours: 3,
      thApres: 13, poidsApres: 8780, variation: -220, agent: "S. Ndiaye",
      puSechage: 50, montant: 9000,
    },
  ],
  sorties: [
    {
      id: "SOR-001", date: "2026-07-14", lotId: "PAD-2607-0230",
      th: 13, sacs: 320, poids: 15600, pm: 48.75,
      destination: "Usinage", agent: "S. Ndiaye",
      charge: 32000, pesage: 15600, deplacement: 40000, chargeTotale: 87600,
    },
  ],
};

function emit() { listeners.forEach((l) => l()); }
function subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return state; }

export function usePaddy() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const paddyActions = {
  todayISO,
  nextLotId: () => nextLotId(state.appros),

  addAppro(input: Omit<Appro, "id" | "pm" | "cap" | "chargeTotale" | "status">) {
    const id = nextLotId(state.appros);
    state.appros = [mkAppro(input, id, "Collecte"), ...state.appros];
    emit();
    return id;
  },

  addSechage(input: Omit<Sechage, "id" | "variation" | "montant">) {
    const variation = +(input.poidsApres - input.poidsAvant).toFixed(1);
    const montant = input.sacs * input.puSechage;
    const s: Sechage = {
      ...input,
      id: `SEC-${String(state.sechages.length + 1).padStart(3, "0")}`,
      variation, montant,
    };
    state.sechages = [s, ...state.sechages];
    // Update lot status + poids
    state.appros = state.appros.map((a) =>
      a.id === input.lotId
        ? { ...a, status: "Stocké" as LotStatus, poids: input.poidsApres, th: input.thApres }
        : a
    );
    emit();
  },

  addSortie(input: Omit<Sortie, "id" | "pm" | "chargeTotale">) {
    const pm = input.sacs ? +(input.poids / input.sacs).toFixed(2) : 0;
    const chargeTotale = input.charge + input.pesage + input.deplacement;
    const s: Sortie = {
      ...input, pm, chargeTotale,
      id: `SOR-${String(state.sorties.length + 1).padStart(3, "0")}`,
    };
    state.sorties = [s, ...state.sorties];
    state.appros = state.appros.map((a) =>
      a.id === input.lotId
        ? { ...a, status: (input.destination === "Usinage" ? "Envoyé usinage" : "Sortie tiers") as LotStatus }
        : a
    );
    emit();
  },
};
