import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "resume_activite",
  title: "Résumé d'activité",
  description:
    "Résumé chiffré de la chaîne de valeur : nombre de lots paddy, opérations d'usinage, commandes de riz, ventes et versements caisse.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Non authentifié" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const tables = ["appros", "decorticages", "sorties_riz", "ventes_boutique", "versements_caisse"] as const;
    const results = await Promise.all(
      tables.map((t) => supabase.from(t).select("*", { count: "exact", head: true })),
    );
    const failure = results.find((r) => r.error);
    if (failure?.error) return { content: [{ type: "text", text: failure.error.message }], isError: true };
    const resume = Object.fromEntries(tables.map((t, i) => [t, results[i]?.count ?? 0]));
    return { content: [{ type: "text", text: JSON.stringify(resume) }], structuredContent: { resume } };
  },
});
