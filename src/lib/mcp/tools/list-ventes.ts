import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_ventes",
  title: "Lister les ventes boutique",
  description: "Liste les ventes enregistrées en boutique (stocks, quantités vendues, montants).",
  inputSchema: {
    boutique: z.string().optional().describe("Nom de la boutique."),
    depuis: z.string().optional().describe("Date de début au format AAAA-MM-JJ."),
    limit: z.number().int().optional().describe("Nombre maximum de lignes (défaut 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ boutique, depuis, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("ventes_boutique")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 50);
    if (boutique) query = query.eq("boutique", boutique);
    if (depuis) query = query.gte("date", depuis);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const total = (data ?? []).reduce((s, v: Record<string, unknown>) => s + (Number(v.montant) || 0), 0);
    return {
      content: [{ type: "text", text: JSON.stringify({ ventes: data ?? [], totalMontant: total }) }],
      structuredContent: { ventes: data ?? [], totalMontant: total },
    };
  },
});
