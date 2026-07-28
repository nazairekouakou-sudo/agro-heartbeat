// Store Grille Tarifaire — prix officiels du riz + tarifs de prestations.
// Ligne unique, éditable par l'Admin, lue par tous les rôles connectés.
// Double tarification Usinage : coût de charge (interne CAPI) vs
// coût de facturation (facturé au partenaire/prestataire propriétaire du lot).
import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type Tarifs = {
  prixRizBlanc: number;
  prix2xCasse: number;
  prixFineBrisure: number;
  puDecorticageCharge: number;   // coût interne CAPI (FCFA/kg riz blanc)
  puDecorticageFactureA: number; // tranche A facturée au tiers (FCFA/kg riz blanc)
  puDecorticageFactureB: number; // tranche B facturée au tiers (FCFA/kg paddy)
  puDecorticageFactureEcos: number; // tranche Ecos facturée au tiers (FCFA/kg long grain)
  puCalibrageCharge: number;     // coût interne CAPI (FCFA/kg riz blanc)
  puTriageCharge: number;        // coût interne CAPI (FCFA/kg riz blanc non trié)
  puTriageFacture: number;       // facturé au tiers (FCFA/kg riz blanc non trié)
  puSechage: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

const DEFAULT_TARIFS: Tarifs = {
  prixRizBlanc: 550, prix2xCasse: 450, prixFineBrisure: 350,
  puDecorticageCharge: 5, puDecorticageFactureA: 40, puDecorticageFactureB: 50, puDecorticageFactureEcos: 30,
  puCalibrageCharge: 3,
  puTriageCharge: 3, puTriageFacture: 15,
  puSechage: 50,
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
    puDecorticageCharge: Number(r.pu_decorticage_charge), puDecorticageFactureA: Number(r.pu_decorticage_facture_a),
    puDecorticageFactureB: Number(r.pu_decorticage_facture_b), puDecorticageFactureEcos: Number(r.pu_decorticage_facture_ecos),
    puCalibrageCharge: Number(r.pu_calibrage_charge),
    puTriageCharge: Number(r.pu_triage_charge), puTriageFacture: Number(r.pu_triage_facture),
    puSechage: Number(r.pu_sechage),
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
  if (categorie === "Long grain") return t.prixRizBlanc;
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
        ...(patch.puDecorticageCharge !== undefined && { pu_decorticage_charge: patch.puDecorticageCharge }),
        ...(patch.puDecorticageFactureA !== undefined && { pu_decorticage_facture_a: patch.puDecorticageFactureA }),
        ...(patch.puDecorticageFactureB !== undefined && { pu_decorticage_facture_b: patch.puDecorticageFactureB }),
        ...(patch.puDecorticageFactureEcos !== undefined && { pu_decorticage_facture_ecos: patch.puDecorticageFactureEcos }),
        ...(patch.puCalibrageCharge !== undefined && { pu_calibrage_charge: patch.puCalibrageCharge }),
        ...(patch.puTriageCharge !== undefined && { pu_triage_charge: patch.puTriageCharge }),
        ...(patch.puTriageFacture !== undefined && { pu_triage_facture: patch.puTriageFacture }),
        ...(patch.puSechage !== undefined && { pu_sechage: patch.puSechage }),
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      })
      .eq("id", 1);
    if (error) throw error;
    await refetch();
  },
};
