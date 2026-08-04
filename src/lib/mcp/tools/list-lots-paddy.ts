import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_lots_paddy",
  title: "Lister les lots de paddy",
  description: "Liste les approvisionnements de paddy (lots) avec leurs charges, filtrables par campagne.",
  inputSchema: {
    campagne: z.string().optional().describe("Nom de la campagne agricole, ex. 2025-2026."),
    limit: z.number().int().optional().describe("Nombre maximum de lots à retourner (défaut 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ campagne, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase.from("appros").select("*").order("created_at", { ascending: false }).limit(limit ?? 25);
    if (campagne) query = query.eq("campagne", campagne);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { lots: data ?? [] },
    };
  },
});
