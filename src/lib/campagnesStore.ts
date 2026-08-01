// Store Campagnes agricoles — référentiel partagé + campagne active.
// Géré par l'Admin dans Paramètres : ajout / suppression / choix de la campagne en cours.
// La campagne active sert de valeur par défaut lors des saisies, mais l'utilisateur
// peut toujours choisir une campagne antérieure sur le formulaire.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type Campagne = {
  id: string;
  nom: string;
  dateDebut: string | null;
  dateFin: string | null;
  active: boolean;
};

/** Campagne de secours si la table n'est pas encore créée côté base. */
export const CAMPAGNE_DEFAUT = "2025-2026";

type State = { campagnes: Campagne[]; loaded: boolean };

const listeners = new Set<() => void>();
let state: State = { campagnes: [], loaded: false };

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromRow(r: any): Campagne {
  return {
    id: r.id,
    nom: r.nom,
    dateDebut: r.date_debut ?? null,
    dateFin: r.date_fin ?? null,
    active: !!r.active,
  };
}

let initPromise: Promise<void> | null = null;

async function refetch() {
  const { data, error } = await supabase.from("campagnes").select("*").order("nom", { ascending: false });
  if (error) {
    console.error("[campagnesStore] refetch:", error.message);
    return;
  }
  state = { campagnes: (data ?? []).map(fromRow), loaded: true };
  emit();
}

function ensureLoaded() {
  if (!initPromise) initPromise = refetch();
  return initPromise;
}

let realtimeStarted = false;
function ensureRealtime() {
  if (realtimeStarted) return;
  realtimeStarted = true;
  supabase
    .channel("campagnes-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "campagnes" }, () => refetch())
    .subscribe();
}

export function useCampagnes() {
  useEffect(() => {
    ensureLoaded();
    ensureRealtime();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Noms des campagnes, de la plus récente à la plus ancienne (utilisable dans un <Select>). */
export function useCampagneNoms(): string[] {
  const { campagnes } = useCampagnes();
  return campagnes.length ? campagnes.map((c) => c.nom) : [CAMPAGNE_DEFAUT];
}

/** Nom de la campagne marquée comme active (valeur par défaut des saisies). */
export function useCampagneActive(): string {
  const { campagnes } = useCampagnes();
  return campagnes.find((c) => c.active)?.nom ?? campagnes[0]?.nom ?? CAMPAGNE_DEFAUT;
}

export const campagnesActions = {
  async add(input: { nom: string; dateDebut?: string; dateFin?: string }) {
    const nom = input.nom.trim();
    if (!nom) throw new Error("Le nom de la campagne est obligatoire.");
    const premiere = state.campagnes.length === 0;
    const { error } = await supabase.from("campagnes").insert({
      nom,
      date_debut: input.dateDebut || null,
      date_fin: input.dateFin || null,
      active: premiere, // la toute première campagne créée devient active
    });
    if (error) throw error;
    await refetch();
  },

  async update(id: string, patch: { nom?: string; dateDebut?: string | null; dateFin?: string | null }) {
    const row: Record<string, unknown> = {};
    if (patch.nom !== undefined) row.nom = patch.nom.trim();
    if (patch.dateDebut !== undefined) row.date_debut = patch.dateDebut || null;
    if (patch.dateFin !== undefined) row.date_fin = patch.dateFin || null;
    const { error } = await supabase.from("campagnes").update(row).eq("id", id);
    if (error) throw error;
    await refetch();
  },

  /** Rend une campagne active (et désactive toutes les autres). */
  async setActive(id: string) {
    const off = await supabase.from("campagnes").update({ active: false }).neq("id", id);
    if (off.error) throw off.error;
    const on = await supabase.from("campagnes").update({ active: true }).eq("id", id);
    if (on.error) throw on.error;
    await refetch();
  },

  async remove(id: string) {
    const { error } = await supabase.from("campagnes").delete().eq("id", id);
    if (error) throw error;
    await refetch();
  },
};
