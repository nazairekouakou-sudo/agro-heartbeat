import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_lot_paddy",
  title: "Détail d'un lot de paddy",
  description:
    "Retourne le parcours complet d'un lot : approvisionnement, séchages, sorties, décorticages, calibrages et tries.",
  inputSchema: {
    lot_id: z.string().trim().describe("Identifiant du lot, ex. PAD-2607-0221."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lot_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const [appro, sechages, sorties, decorticages, calibrages, tries] = await Promise.all([
      supabase.from("appros").select("*").eq("id", lot_id).maybeSingle(),
      supabase.from("sechages").select("*").eq("lot_id", lot_id),
      supabase.from("sorties").select("*").eq("lot_id", lot_id),
      supabase.from("decorticages").select("*").eq("lot_id", lot_id),
      supabase.from("calibrages").select("*").eq("lot_id", lot_id),
      supabase.from("tries").select("*").eq("lot_id", lot_id),
    ]);
    const failure = [appro, sechages, sorties, decorticages, calibrages, tries].find((r) => r.error);
    if (failure?.error) return { content: [{ type: "text", text: failure.error.message }], isError: true };
    if (!appro.data) return { content: [{ type: "text", text: `Lot ${lot_id} introuvable.` }], isError: true };
    const lot = {
      appro: appro.data,
      sechages: sechages.data ?? [],
      sorties: sorties.data ?? [],
      decorticages: decorticages.data ?? [],
      calibrages: calibrages.data ?? [],
      tries: tries.data ?? [],
    };
    return { content: [{ type: "text", text: JSON.stringify(lot) }], structuredContent: { lot } };
  },
});
