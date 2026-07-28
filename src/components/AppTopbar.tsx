import { Bell, Search, LogOut, User, Settings, CheckCircle2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth, authActions } from "@/lib/authStore";
import { MobileSidebarTrigger } from "@/components/AppSidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link } from "@tanstack/react-router";

const roleLabels: Record<string, string> = {
  admin: "Admin CAPI",
  paddy: "Service Paddy",
  usinage: "Service Usinage",
  gestion: "Service Gestion",
  commercial: "Service Commercial",
  comptable: "Service Comptable",
  partenaire: "Partenaire",
};

type Notif = { id: string; title: string; body: string; time: string; read: boolean };

const INITIAL_NOTIFS: Notif[] = [
  {
    id: "n1",
    title: "Nouveau lot paddy réceptionné",
    body: "PAD-2607-0042 — 12,4 t enregistrées par Silué Abou.",
    time: "Il y a 5 min",
    read: false,
  },
  {
    id: "n2",
    title: "Décorticage terminé",
    body: "Lot PAD-2607-0039 — rendement 63,8%, qualité Blanc.",
    time: "Il y a 42 min",
    read: false,
  },
  {
    id: "n3",
    title: "Grille tarifaire mise à jour",
    body: "Koné Sarah a modifié les PU d'usinage.",
    time: "Hier",
    read: true,
  },
];

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
  const [notifs, setNotifs] = useState<Notif[]>(INITIAL_NOTIFS);
  const unread = notifs.filter((n) => !n.read).length;

  const initials = profile?.fullName
    ? profile.fullName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()
    : "—";

  function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }
  function markOneRead(id: string) {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

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

      <Popover>
        <PopoverTrigger asChild>
          <button
            className="relative size-9 rounded-md bg-muted/60 hover:bg-muted flex items-center justify-center shrink-0"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-gold text-[10px] font-semibold text-primary-foreground flex items-center justify-center">
                {unread}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="text-sm font-medium">Notifications</div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <CheckCircle2 className="size-3" /> Tout marquer lu
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifs.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Aucune notification.
              </div>
            )}
            {notifs.map((n) => (
              <button
                key={n.id}
                onClick={() => markOneRead(n.id)}
                className="w-full text-left px-4 py-3 border-b border-border/60 last:border-0 hover:bg-muted/50 transition-colors flex gap-3"
              >
                <span
                  className={`mt-1.5 size-2 rounded-full shrink-0 ${
                    n.read ? "bg-transparent" : "bg-gold"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${n.read ? "text-muted-foreground" : "font-medium"}`}>
                    {n.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{n.time}</div>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 pl-3 border-l border-border shrink-0 hover:opacity-80 transition-opacity outline-none">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium leading-tight">{profile?.fullName ?? "—"}</div>
              <div className="text-[11px] text-muted-foreground">
                {profile ? roleLabels[profile.role] ?? profile.role : ""}
              </div>
            </div>
            <div className="size-9 rounded-full gradient-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              {initials}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="font-medium">{profile?.fullName ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground font-normal">
              {profile ? roleLabels[profile.role] ?? profile.role : ""}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <User className="size-4 mr-2" /> Mon profil
          </DropdownMenuItem>
          {profile?.role === "admin" && (
            <DropdownMenuItem asChild>
              <Link to="/admin-parametres">
                <Settings className="size-4 mr-2" /> Paramètres
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => authActions.signOut()} className="text-destructive focus:text-destructive">
            <LogOut className="size-4 mr-2" /> Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
