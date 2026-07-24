import { Bell, Search, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth, authActions } from "@/lib/authStore";
import { MobileSidebarTrigger } from "@/components/AppSidebar";

const roleLabels: Record<string, string> = {
  admin: "Admin CAPI",
  paddy: "Service Paddy",
  usinage: "Service Usinage",
  gestion: "Service Gestion",
  commercial: "Service Commercial",
  comptable: "Service Comptable",
  partenaire: "Partenaire",
};

export function AppTopbar({
  eyebrow,
  title,
  actions,
}: {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
}) {
  const { profile } = useAuth();
  const initials = profile?.fullName
    ? profile.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()
    : "—";

  return (
    <header className="h-16 border-b border-border bg-card/60 backdrop-blur px-6 flex items-center gap-4 shrink-0">
      <MobileSidebarTrigger />
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </div>
        <h1 className="font-display text-lg leading-tight truncate">{title}</h1>
      </div>
      <div className="flex-1 max-w-md ml-auto relative hidden md:block">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Rechercher un lot, partenaire, facture…"
          className="w-full h-9 pl-9 pr-3 rounded-md bg-muted/60 border border-transparent focus:border-ring focus:bg-card outline-none text-sm"
        />
      </div>
      {actions}
      <button className="relative size-9 rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center shrink-0">
        <Bell className="size-4" />
        <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-gold" />
      </button>
      <div className="flex items-center gap-3 pl-3 border-l border-border shrink-0">
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium leading-tight">{profile?.fullName ?? "—"}</div>
          <div className="text-[11px] text-muted-foreground">
            {profile ? roleLabels[profile.role] ?? profile.role : ""}
          </div>
        </div>
        <div className="size-9 rounded-full gradient-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
          {initials}
        </div>
        <button
          onClick={() => authActions.signOut()}
          className="size-9 rounded-md hover:bg-muted flex items-center justify-center shrink-0 lg:hidden"
          title="Déconnexion"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </header>
  );
}
