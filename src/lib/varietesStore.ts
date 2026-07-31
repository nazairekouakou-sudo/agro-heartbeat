// Store Variétés de riz — référentiel partagé (paddy, réception riz externe…).
// Géré par l'Admin dans Paramètres : ajout / suppression de variétés.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type Variete = { id: string; nom: string };

// Variétés de secours si la table n'est pas encore créée côté base.
export const VARIETES_DEFAUT = ["JT 11", "Bouaké", "CY-2", "Sahel 108"];

type State = { varietes: Variete[]; loaded: boolean };

const listeners = new Set<() => void>();
let state: State = {
  varietes: VARIETES_DEFAUT.map((nom) => ({ id: nom, nom })),
  loaded: false,
};

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

let initPromise: Promise<void> | null = null;

async function refetch() {
  const { data, error } = await supabase.from("varietes_riz").select("*").order("nom");
  if (error) {
    console.error("[varietesStore] refetch:", error.message);
    return;
  }
  const rows = (data ?? []).map((r: { id: string; nom: string }) => ({ id: r.id, nom: r.nom }));
  state = { varietes: rows, loaded: true };
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
    .channel("varietes-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "varietes_riz" }, () => refetch())
    .subscribe();
}

export function useVarietes() {
  useEffect(() => {
    ensureLoaded();
    ensureRealtime();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Liste des noms de variétés, utilisable directement dans un <Select>. */
export function useVarieteNoms(): string[] {
  const { varietes } = useVarietes();
  return varietes.length ? varietes.map((v) => v.nom) : VARIETES_DEFAUT;
}

export const varietesActions = {
  async add(nom: string) {
    const clean = nom.trim();
    if (!clean) throw new Error("Le nom de la variété est obligatoire.");
    const { error } = await supabase.from("varietes_riz").insert({ nom: clean });
    if (error) throw error;
    await refetch();
  },

  async remove(id: string) {
    const { error } = await supabase.from("varietes_riz").delete().eq("id", id);
    if (error) throw error;
    await refetch();
  },
};
