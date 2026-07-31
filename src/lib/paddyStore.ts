// Store Service Paddy — persisté sur Supabase, synchronisé en temps réel entre appareils.
import { useEffect, useSyncExternalStore } from "react";
import { toRow } from "./rowMap";
import { supabase } from "./supabaseClient";

type Facturation = { tiers: string; montantFacture: number; typePrestation: "sechage" | "collecte" };

function nextFactureId() {
  return `FACT-${Date.now().toString(36).toUpperCase()}`;
}

async function creerFacturePrestation(f: Facturation, lotId: string, date: string) {
  if (f.montantFacture <= 0) return;
  const { error } = await supabase.from("prestations_factures").insert({
    id: nextFactureId(), date, lot_id: lotId, tiers: f.tiers,
    type_prestation: f.typePrestation, montant_facture: f.montantFacture,
  });
  if (error) console.error("[paddyStore] creerFacturePrestation:", error.message);
}

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
  entityName: string;
  fournisseur: string | null;
  variete: string;
  th: number;
  ti: number;
  sacs: number;
  poids: number | null; // optionnel pour les lots tiers (Partenaire/Prestataire) : comptage au sac
  pm: number;
  agent: string;
  pu: number;
  cap: number;
  charge: number;
  pesage: number;
  dechargement: number;
  transport: number;
  fraisAnnexes: number;
  prime: number;
  chargeTotale: number;
  status: LotStatus;
  tranche: "A" | "B" | "ecos" | null; // tranche de facturation choisie pour les lots tiers
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
  variation: number;
  agent: string;
  puSechage: number;
  montant: number;
};

export type Sortie = {
  id: string;
  date: string;
  lotId: string;
  th: number;
  sacs: number;
  poids: number;
  pm: number;
  destination: string;
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
  loaded: boolean;
};

const listeners = new Set<() => void>();
let state: State = { appros: [], sechages: [], sorties: [], loaded: false };

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

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

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

// ---------- Row <-> App type mapping ----------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function approFromRow(r: any): Appro {
  return {
    id: r.id, dateAppro: r.date_appro, dateEntree: r.date_entree, zone: r.zone,
    entity: r.entity, entityName: r.entity_name, fournisseur: r.fournisseur ?? null, variete: r.variete,
    th: Number(r.th), ti: Number(r.ti), sacs: r.sacs, poids: r.poids === null ? null : Number(r.poids),
    pm: Number(r.pm), agent: r.agent, pu: Number(r.pu), cap: Number(r.cap),
    charge: Number(r.charge), pesage: Number(r.pesage), dechargement: Number(r.dechargement),
    transport: Number(r.transport), fraisAnnexes: Number(r.frais_annexes), prime: Number(r.prime),
    chargeTotale: Number(r.charge_totale), status: r.status, tranche: r.tranche ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sechageFromRow(r: any): Sechage {
  return {
    id: r.id, date: r.date, lotId: r.lot_id, thInitial: Number(r.th_initial),
    sacs: r.sacs, poidsAvant: Number(r.poids_avant), jours: r.jours,
    thApres: Number(r.th_apres), poidsApres: Number(r.poids_apres),
    variation: Number(r.variation), agent: r.agent, puSechage: Number(r.pu_sechage),
    montant: Number(r.montant),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sortieFromRow(r: any): Sortie {
  return {
    id: r.id, date: r.date, lotId: r.lot_id, th: Number(r.th), sacs: r.sacs,
    poids: Number(r.poids), pm: Number(r.pm), destination: r.destination, agent: r.agent,
    charge: Number(r.charge), pesage: Number(r.pesage), deplacement: Number(r.deplacement),
    chargeTotale: Number(r.charge_totale),
  };
}

// ---------- Calcul local optimiste (affichage immédiat avant confirmation serveur) ----------

function mkAppro(
  base: Omit<Appro, "id" | "pm" | "cap" | "chargeTotale" | "status">,
  id: string,
  status: LotStatus,
): Appro {
  const poids = base.poids ?? 0;
  const pm = base.sacs ? +(poids / base.sacs).toFixed(2) : 0;
  const cap = poids * base.pu;
  const capCompte = base.entity === "CAPI" ? cap : 0; // prestation de service pour les tiers, pas un achat CAPI
  const chargeTotale =
    capCompte + base.charge + base.pesage + base.dechargement +
    base.transport + base.fraisAnnexes + base.prime;
  return { ...base, id, pm, cap, chargeTotale, status };
}

// ---------- Chargement + temps réel ----------

let initPromise: Promise<void> | null = null;

async function refetchAll() {
  const [approsRes, sechagesRes, sortiesRes] = await Promise.all([
    supabase.from("appros").select("*").order("created_at", { ascending: false }),
    supabase.from("sechages").select("*").order("created_at", { ascending: false }),
    supabase.from("sorties").select("*").order("created_at", { ascending: false }),
  ]);
  if (approsRes.error) console.error("[paddyStore] appros:", approsRes.error.message);
  if (sechagesRes.error) console.error("[paddyStore] sechages:", sechagesRes.error.message);
  if (sortiesRes.error) console.error("[paddyStore] sorties:", sortiesRes.error.message);
  state = {
    appros: (approsRes.data ?? []).map(approFromRow),
    sechages: (sechagesRes.data ?? []).map(sechageFromRow),
    sorties: (sortiesRes.data ?? []).map(sortieFromRow),
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
    .channel("paddy-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "appros" }, () => refetchAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "sechages" }, () => refetchAll())
    .on("postgres_changes", { event: "*", schema: "public", table: "sorties" }, () => refetchAll())
    .subscribe();
}

export function usePaddy() {
  useEffect(() => {
    ensureLoaded();
    ensureRealtime();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ---------- Reliquat de stock (sacs + poids restants sur un lot) ----------
// Utilisé pour l'affichage (Gestion > Stock paddy) et pour bloquer toute
// opération qui dépasserait le stock réellement disponible sur le lot.
export function reliquat(
  appro: Appro,
  sorties: Sortie[],
  consommations: { lotId: string; sacs: number; poidsPaddy?: number }[] = [],
) {
  const sortiSacs = sorties.filter((s) => s.lotId === appro.id).reduce((s, x) => s + x.sacs, 0);
  const consommeSacs = consommations.filter((c) => c.lotId === appro.id).reduce((s, x) => s + x.sacs, 0);
  const sacsRestants = Math.max(0, appro.sacs - sortiSacs - consommeSacs);

  const sortiPoids = sorties.filter((s) => s.lotId === appro.id).reduce((s, x) => s + x.poids, 0);
  const consommePoids = consommations.filter((c) => c.lotId === appro.id).reduce((s, x) => s + (x.poidsPaddy ?? 0), 0);
  const poidsRestant = appro.poids === null ? null : Math.max(0, appro.poids - sortiPoids - consommePoids);

  return { sacs: sacsRestants, poids: poidsRestant };
}

export const paddyActions = {
  todayISO,
  nextLotId: () => nextLotId(state.appros),

  addAppro(input: Omit<Appro, "id" | "pm" | "cap" | "chargeTotale" | "status">) {
    const id = nextLotId(state.appros);
    const optimistic = mkAppro(input, id, "Collecte");
    state = { ...state, appros: [optimistic, ...state.appros] };
    emit();

    supabase
      .from("appros")
      .insert({
        id, date_appro: input.dateAppro, date_entree: input.dateEntree, zone: input.zone,
        entity: input.entity, entity_name: input.entityName, fournisseur: input.fournisseur, variete: input.variete,
        th: input.th, ti: input.ti, sacs: input.sacs, poids: input.poids, agent: input.agent,
        pu: input.pu, charge: input.charge, pesage: input.pesage,
        dechargement: input.dechargement, transport: input.transport,
        frais_annexes: input.fraisAnnexes, prime: input.prime, status: "Collecte", tranche: input.tranche,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[paddyStore] addAppro:", error.message);
          state = { ...state, appros: state.appros.filter((a) => a.id !== id) };
          emit();
        } else {
          refetchAll();
          // Prestation de service pour les tiers : les charges annexes de
          // réception (déchargement, transport, pesage) sont facturées au
          // partenaire/prestataire, pas absorbées comme coût CAPI.
          if (input.entity !== "CAPI") {
            const montantAnnexes = input.charge + input.pesage + input.dechargement + input.transport;
            creerFacturePrestation(
              { tiers: input.entityName, montantFacture: montantAnnexes, typePrestation: "collecte" },
              id, input.dateEntree,
            );
          }
        }
      });

    return id;
  },

  addSechage(input: Omit<Sechage, "id" | "variation" | "montant">) {
    const variation = +(input.poidsApres - input.poidsAvant).toFixed(1);
    const montant = input.sacs * input.puSechage;
    const id = `SEC-${String(state.sechages.length + 1).padStart(3, "0")}`;
    const s: Sechage = { ...input, id, variation, montant };

    state = {
      ...state,
      sechages: [s, ...state.sechages],
      appros: state.appros.map((a) =>
        a.id === input.lotId
          ? { ...a, status: "Stocké" as LotStatus, poids: input.poidsApres, th: input.thApres }
          : a,
      ),
    };
    emit();

    (async () => {
      const { error: sechageErr } = await supabase.from("sechages").insert({
        id, date: input.date, lot_id: input.lotId, th_initial: input.thInitial,
        sacs: input.sacs, poids_avant: input.poidsAvant, jours: input.jours,
        th_apres: input.thApres, poids_apres: input.poidsApres, agent: input.agent,
        pu_sechage: input.puSechage,
      });
      if (sechageErr) console.error("[paddyStore] addSechage:", sechageErr.message);

      const { error: approErr } = await supabase
        .from("appros")
        .update({ status: "Stocké", poids: input.poidsApres, th: input.thApres })
        .eq("id", input.lotId);
      if (approErr) console.error("[paddyStore] update appro after séchage:", approErr.message);

      const lot = state.appros.find((a) => a.id === input.lotId);
      if (lot && lot.entity !== "CAPI") {
        await creerFacturePrestation({ tiers: lot.entityName, montantFacture: montant, typePrestation: "sechage" }, input.lotId, input.date);
      }

      refetchAll();
    })();
  },

  addSortie(input: Omit<Sortie, "id" | "pm" | "chargeTotale">) {
    const pm = input.sacs ? +(input.poids / input.sacs).toFixed(2) : 0;
    const chargeTotale = input.charge + input.pesage + input.deplacement;
    const id = `SOR-${String(state.sorties.length + 1).padStart(3, "0")}`;
    const s: Sortie = { ...input, pm, chargeTotale, id };
    const newStatus: LotStatus = input.destination === "Usinage" ? "Envoyé usinage" : "Sortie tiers";

    state = {
      ...state,
      sorties: [s, ...state.sorties],
      appros: state.appros.map((a) => (a.id === input.lotId ? { ...a, status: newStatus } : a)),
    };
    emit();

    (async () => {
      const { error: sortieErr } = await supabase.from("sorties").insert({
        id, date: input.date, lot_id: input.lotId, th: input.th, sacs: input.sacs,
        poids: input.poids, destination: input.destination, agent: input.agent,
        charge: input.charge, pesage: input.pesage, deplacement: input.deplacement,
      });
      if (sortieErr) console.error("[paddyStore] addSortie:", sortieErr.message);

      const { error: approErr } = await supabase
        .from("appros")
        .update({ status: newStatus })
        .eq("id", input.lotId);
      if (approErr) console.error("[paddyStore] update appro after sortie:", approErr.message);

      refetchAll();
    })();
  },
};

// ---------- Modification / suppression ----------

const APPRO_COLS: Partial<Record<keyof Appro, string>> = {
  dateAppro: "date_appro", dateEntree: "date_entree", zone: "zone", entity: "entity",
  entityName: "entity_name", fournisseur: "fournisseur", variete: "variete", th: "th", ti: "ti",
  sacs: "sacs", poids: "poids", agent: "agent", pu: "pu", charge: "charge", pesage: "pesage",
  dechargement: "dechargement", transport: "transport", fraisAnnexes: "frais_annexes",
  prime: "prime", status: "status", tranche: "tranche",
};

const SECHAGE_COLS: Partial<Record<keyof Sechage, string>> = {
  date: "date", lotId: "lot_id", thInitial: "th_initial", sacs: "sacs",
  poidsAvant: "poids_avant", jours: "jours", thApres: "th_apres", poidsApres: "poids_apres",
  agent: "agent", puSechage: "pu_sechage",
};

const SORTIE_COLS: Partial<Record<keyof Sortie, string>> = {
  date: "date", lotId: "lot_id", th: "th", sacs: "sacs", poids: "poids",
  destination: "destination", agent: "agent", charge: "charge", pesage: "pesage",
  deplacement: "deplacement",
};

async function paddyMutate(table: string, id: string, row: Record<string, unknown>) {
  const { error } = await supabase.from(table).update(row).eq("id", id);
  if (error) throw error;
  await refetchAll();
}

async function paddyRemove(table: string, id: string) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  await refetchAll();
}

export const paddyCrud = {
  updateAppro: (id: string, patch: Partial<Appro>) => paddyMutate("appros", id, toRow(patch, APPRO_COLS)),
  removeAppro: (id: string) => paddyRemove("appros", id),
  updateSechage: (id: string, patch: Partial<Sechage>) => paddyMutate("sechages", id, toRow(patch, SECHAGE_COLS)),
  removeSechage: (id: string) => paddyRemove("sechages", id),
  updateSortie: (id: string, patch: Partial<Sortie>) => paddyMutate("sorties", id, toRow(patch, SORTIE_COLS)),
  removeSortie: (id: string) => paddyRemove("sorties", id),
};
