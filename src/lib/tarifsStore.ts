// Store Grille Tarifaire — prix officiels du riz + tarifs de prestations.
// Ligne unique, éditable par l'Admin, lue par tous les rôles connectés.
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type Tarifs = {
  prixRizBlanc: number;
  prix2xCasse: number;
  prixFineBrisure: number;
  puDecorticage: number;
  puTriage: number;
  puSechage: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

const DEFAULT_TARIFS: Tarifs = {
  prixRizBlanc: 550, prix2xCasse: 450, prixFineBrisure: 350,
  puDecorticage: 25, puTriage: 10, puSechage: 50,
  updatedAt: null, updatedBy: null,
};

type State = { tarifs: Tarifs; loaded: boolean };

const listeners = new Set<() => void>();
let state: State = { tarifs: DEFAULT_TARIFS, loaded: false };

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
function tarifsFromRow(r: any): Tarifs {
  return {
    prixRizBlanc: Number(r.prix_riz_blanc), prix2xCasse: Number(r.prix_2x_casse), prixFineBrisure: Number(r.prix_fine_brisure),
    puDecorticage: Number(r.pu_decorticage), puTriage: Number(r.pu_triage), puSechage: Number(r.pu_sechage),
    updatedAt: r.updated_at, updatedBy: r.updated_by,
  };
}

let initPromise: Promise<void> | null = null;

async function refetch() {
  const { data, error } = await supabase.from("tarifs").select("*").eq("id", 1).maybeSingle();
  if (error) {
    console.error("[tarifsStore] refetch:", error.message);
  } else if (data) {
    state = { tarifs: tarifsFromRow(data), loaded: true };
    emit();
  }
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
    .channel("tarifs-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "tarifs" }, () => refetch())
    .subscribe();
}

export function useTarifs() {
  useEffect(() => {
    ensureLoaded();
    ensureRealtime();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot).tarifs;
}

export function prixParCategorie(t: Tarifs, categorie: string): number {
  if (categorie === "Riz blanc") return t.prixRizBlanc;
  if (categorie === "2X Cassé") return t.prix2xCasse;
  if (categorie === "Fine Brisure") return t.prixFineBrisure;
  return t.prixRizBlanc;
}

export const tarifsActions = {
  async update(patch: Partial<Omit<Tarifs, "updatedAt" | "updatedBy">>, updatedBy: string) {
    const { error } = await supabase
      .from("tarifs")
      .update({
        ...(patch.prixRizBlanc !== undefined && { prix_riz_blanc: patch.prixRizBlanc }),
        ...(patch.prix2xCasse !== undefined && { prix_2x_casse: patch.prix2xCasse }),
        ...(patch.prixFineBrisure !== undefined && { prix_fine_brisure: patch.prixFineBrisure }),
        ...(patch.puDecorticage !== undefined && { pu_decorticage: patch.puDecorticage }),
        ...(patch.puTriage !== undefined && { pu_triage: patch.puTriage }),
        ...(patch.puSechage !== undefined && { pu_sechage: patch.puSechage }),
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      })
      .eq("id", 1);
    if (error) throw error;
    await refetch();
  },
};
