import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_usinage",
  title: "Lister les opérations d'usinage",
  description: "Liste les décorticages avec rendements, taux de casse et coûts d'usinage.",
  inputSchema: {
    lot_id: z.string().optional().describe("Filtrer sur un lot précis."),
    limit: z.number().int().optional().describe("Nombre maximum d'opérations (défaut 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lot_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("decorticages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (lot_id) query = query.eq("lot_id", lot_id);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { decorticages: data ?? [] },
    };
  },
});
