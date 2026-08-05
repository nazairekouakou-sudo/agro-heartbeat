import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  accessToken: z.string().min(10),
  fullName: z.string().min(1),
  role: z.enum(["admin", "paddy", "usinage", "gestion", "commercial", "comptable", "partenaire"]),
  pin: z.string().regex(/^\d{6}$/).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  entityName: z.string().optional(),
});

export const createAccount = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");

    const url = "https://bjvvanbmqxqesljmgfsp.supabase.co";
    const serviceKey = process.env["CAPI_SERVICE_ROLE_KEY"];
    if (!serviceKey) {
      throw new Error(
        "Clé de service manquante côté serveur (CAPI_SERVICE_ROLE_KEY). Ajoute-la dans les secrets du projet.",
      );
    }


    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Vérifier que l'appelant est bien un admin CAPI
    const { data: userData, error: userErr } = await admin.auth.getUser(data.accessToken);
    if (userErr || !userData.user) throw new Error("Session invalide, reconnecte-toi.");

    const { data: caller } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (caller?.role !== "admin") throw new Error("Accès réservé aux administrateurs.");

    // 2. Créer le compte auth
    const isPartenaire = data.role === "partenaire";
    const email = isPartenaire ? data.email : `p${data.pin}@capi.internal`;
    const password = isPartenaire ? data.password : data.pin;
    if (!email || !password) {
      throw new Error(
        isPartenaire ? "Email et mot de passe requis." : "PIN à 6 chiffres requis.",
      );
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Création du compte impossible.");
    }

    // 3. Créer le profil
    const { error: profileErr } = await admin.from("profiles").insert({
      id: created.user.id,
      full_name: data.fullName,
      role: data.role,
      entity_name: isPartenaire ? (data.entityName ?? null) : null,
      pin: isPartenaire ? null : (data.pin ?? null),
    });
    if (profileErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new Error(profileErr.message);
    }

    return { ok: true as const, id: created.user.id };
  });
