import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabaseClient";

export type AppRole = "admin" | "paddy" | "usinage" | "gestion" | "commercial" | "comptable" | "partenaire";

export type Profile = {
  id: string;
  fullName: string;
  role: AppRole;
  entityName: string | null;
  pin: string | null;
};

// Route(s) accessible par rôle. "admin" voit tout.
export const ROLE_HOME: Record<AppRole, string> = {
  admin: "/",
  paddy: "/paddy",
  usinage: "/usinage",
  gestion: "/gestion",
  commercial: "/commercial",
  comptable: "/comptable",
  partenaire: "/partenaires",
};

export const ROLE_ALLOWED_PATHS: Record<AppRole, string[]> = {
  admin: ["/", "/paddy", "/usinage", "/gestion", "/commercial", "/comptable", "/partenaires"],
  paddy: ["/paddy"],
  usinage: ["/usinage"],
  gestion: ["/gestion"],
  commercial: ["/commercial"],
  comptable: ["/comptable"],
  partenaire: ["/partenaires"],
};

type State = {
  status: "loading" | "signed-out" | "signed-in";
  userId: string | null;
  profile: Profile | null;
};

const listeners = new Set<() => void>();
let state: State = { status: "loading", userId: null, profile: null };

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
function profileFromRow(r: any): Profile {
  return { id: r.id, fullName: r.full_name, role: r.role, entityName: r.entity_name, pin: r.pin };
}

async function loadProfile(userId: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("[authStore] loadProfile:", error.message);
    state = { status: "signed-in", userId, profile: null };
    emit();
    return;
  }
  state = { status: "signed-in", userId, profile: data ? profileFromRow(data) : null };
  emit();
}

let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user) {
      loadProfile(data.session.user.id);
    } else {
      state = { status: "signed-out", userId: null, profile: null };
      emit();
    }
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      loadProfile(session.user.id);
    } else {
      state = { status: "signed-out", userId: null, profile: null };
      emit();
    }
  });
}

export function useAuth() {
  useEffect(() => {
    ensureInit();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, () => ({ status: "loading" as const, userId: null, profile: null }));
}

const PIN_DOMAIN = "capi.internal";

export const authActions = {
  async signInWithPin(pin: string) {
    const email = `p${pin}@${PIN_DOMAIN}`;
    return supabase.auth.signInWithPassword({ email, password: pin });
  },
  async signInWithEmail(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  },
  async signOut() {
    await supabase.auth.signOut();
  },
};
