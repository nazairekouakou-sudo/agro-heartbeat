// Store Boutiques — référentiel partagé (nom de la boutique + vendeuse).
// Géré par l'Admin dans Paramètres : ajout / modification / suppression.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type Boutique = { id: string; name: string; sellerName: string | null };

/** Boutiques de secours si la table est vide ou inaccessible. */
export const BOUTIQUES_DEFAUT = ["Boutique CAPI", "Boutique Commerce", "Boutique Tazibouo", "Boutique Gbokora"];

type State = { boutiques: Boutique[]; loaded: boolean };

const listeners = new Set<() => void>();
let state: State = { boutiques: [], loaded: false };

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
  const { data, error } = await supabase.from("boutiques").select("*").order("name");
  if (error) {
    console.error("[boutiquesStore] refetch:", error.message);
    return;
  }
  state = {
    boutiques: (data ?? []).map((r: { id: string; name: string; seller_name: string | null }) => ({
      id: r.id,
      name: r.name,
      sellerName: r.seller_name ?? null,
    })),
    loaded: true,
  };
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
    .channel("boutiques-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "boutiques" }, () => refetch())
    .subscribe();
}

export function useBoutiques() {
  useEffect(() => {
    ensureLoaded();
    ensureRealtime();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Noms des boutiques, utilisables directement dans un <Select>. */
export function useBoutiqueNoms(): string[] {
  const { boutiques } = useBoutiques();
  return boutiques.length ? boutiques.map((b) => b.name) : BOUTIQUES_DEFAUT;
}

function slugId(nom: string) {
  const base = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return `${base || "BTQ"}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export const boutiquesActions = {
  async add(name: string, sellerName: string) {
    const clean = name.trim();
    if (!clean) throw new Error("Le nom de la boutique est obligatoire.");
    const { error } = await supabase
      .from("boutiques")
      .insert({ id: slugId(clean), name: clean, seller_name: sellerName.trim() || null });
    if (error) throw error;
    await refetch();
  },

  async update(id: string, patch: { name?: string; sellerName?: string | null }) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const clean = patch.name.trim();
      if (!clean) throw new Error("Le nom de la boutique est obligatoire.");
      row.name = clean;
    }
    if (patch.sellerName !== undefined) row.seller_name = patch.sellerName?.trim() || null;
    const { error } = await supabase.from("boutiques").update(row).eq("id", id);
    if (error) throw error;
    await refetch();
  },

  async remove(id: string) {
    const { error } = await supabase.from("boutiques").delete().eq("id", id);
    if (error) throw error;
    await refetch();
  },
};
