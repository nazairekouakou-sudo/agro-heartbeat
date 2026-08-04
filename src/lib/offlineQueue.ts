// Système hors-ligne : détecte la connexion, met en file d'attente les
// écritures faites sans réseau (stockées sur l'appareil), et les
// synchronise automatiquement dès que la connexion revient.
import { useEffect, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { supabase } from "./supabaseClient";

const QUEUE_KEY = "capi-offline-queue";

export type QueuedOp = {
  id: string;
  table: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type QueueState = { queue: QueuedOp[]; syncing: boolean; online: boolean };

const listeners = new Set<() => void>();
let state: QueueState = { queue: [], syncing: false, online: typeof navigator !== "undefined" ? navigator.onLine : true };

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

function loadQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveQueue(queue: QueuedOp[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("[offlineQueue] saveQueue:", e);
  }
}

let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;
  state = { ...state, queue: loadQueue() };

  window.addEventListener("online", () => {
    state = { ...state, online: true };
    emit();
    flushQueue();
  });
  window.addEventListener("offline", () => {
    state = { ...state, online: false };
    emit();
  });

  // Filet de sécurité : retente périodiquement au cas où l'événement 'online'
  // ne se déclencherait pas (certains navigateurs mobiles)
  setInterval(() => {
    if (navigator.onLine && state.queue.length > 0 && !state.syncing) flushQueue();
  }, 15000);

  if (navigator.onLine && state.queue.length > 0) flushQueue();
}

export function useOfflineQueue() {
  useEffect(() => {
    ensureInit();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

function enqueue(table: string, payload: Record<string, unknown>) {
  const op: QueuedOp = { id: `Q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, table, payload, createdAt: new Date().toISOString() };
  const queue = [...state.queue, op];
  state = { ...state, queue };
  saveQueue(queue);
  emit();
}

export async function flushQueue() {
  if (state.syncing || state.queue.length === 0) return;
  state = { ...state, syncing: true };
  emit();

  const remaining: QueuedOp[] = [];
  for (const op of state.queue) {
    const { error } = await supabase.from(op.table).insert(op.payload);
    if (error) {
      // Erreur définitive (ex: violation de contrainte) : on abandonne cette
      // opération plutôt que de bloquer toute la file indéfiniment.
      console.error(`[offlineQueue] échec définitif sur ${op.table}:`, error.message);
    } else {
      continue; // succès, on ne la garde pas
    }
    remaining.push(op);
  }

  state = { ...state, queue: remaining, syncing: false };
  saveQueue(remaining);
  emit();
}

/**
 * Tente une écriture directe ; si hors ligne ou en cas d'échec réseau,
 * met en file d'attente au lieu d'échouer. Les autres stores traitent déjà
 * la mise à jour optimiste locale, donc l'utilisateur voit son action
 * immédiatement, qu'elle parte tout de suite ou qu'elle attende le réseau.
 */
export async function queuedInsert(
  table: string,
  payload: Record<string, unknown>,
): Promise<{ error: string | null; queued: boolean }> {
  ensureInit();

  if (!navigator.onLine) {
    enqueue(table, payload);
    return { error: null, queued: true };
  }

  try {
    const { error } = await supabase.from(table).insert(payload);
    if (error) {
      return { error: error.message, queued: false };
    }
    return { error: null, queued: false };
  } catch {
    // Échec réseau (fetch a levé une exception) : file d'attente
    enqueue(table, payload);
    return { error: null, queued: true };
  }
}
