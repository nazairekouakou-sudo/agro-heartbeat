import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listLotsPaddy from "./tools/list-lots-paddy";
import getLotPaddy from "./tools/get-lot-paddy";
import listUsinage from "./tools/list-usinage";
import listVentes from "./tools/list-ventes";
import resumeActivite from "./tools/resume-activite";

// L'issuer OAuth doit être l'hôte Supabase direct (jamais un proxy).
const projectRef =
  import.meta.env["VITE_SUPABASE_PROJECT_ID"] ??
  (import.meta.env["VITE_SUPABASE_URL"] as string | undefined)?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ??
  "project-ref-unset";

export default defineMcp({
  name: "capi-harmony",
  title: "CAPI Harmony",
  version: "0.1.0",
  instructions:
    "Outils de suivi de la chaîne de valeur du riz du CAPI (paddy, usinage, gestion, commercial). Utilise `resume_activite` pour une vue d'ensemble, `list_lots_paddy` et `get_lot_paddy` pour la traçabilité d'un lot, `list_usinage` pour les rendements et `list_ventes` pour les ventes boutique. Les données visibles dépendent du rôle de l'utilisateur connecté.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [resumeActivite, listLotsPaddy, getLotPaddy, listUsinage, listVentes],
});
