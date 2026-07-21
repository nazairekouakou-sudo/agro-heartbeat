import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sprout,
  Factory,
  ClipboardCheck,
  ShoppingCart,
  Wallet,
  Users,
  CircleDot,
  Wheat,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Pilotage",
    items: [{ to: "/", label: "Tableau de bord", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Chaîne de valeur",
    items: [
      { to: "/paddy", label: "Service Paddy", icon: Sprout },
      { to: "/usinage", label: "Service Usinage", icon: Factory },
      { to: "/gestion", label: "Service Gestion", icon: ClipboardCheck },
      { to: "/commercial", label: "Service Commercial", icon: ShoppingCart },
      { to: "/comptable", label: "Service Comptable", icon: Wallet },
    ],
  },
  {
    label: "Accès dédié",
    items: [{ to: "/partenaires", label: "Portail Partenaires", icon: Users }],
  },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (to: string, exact?: boolean) =>
    exact ? currentPath === to : currentPath === to || currentPath.startsWith(`${to}/`);

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0">
      <div className="px-6 py-6 flex items-center gap-3 border-b border-sidebar-border">
        <div className="size-10 rounded-lg gradient-gold flex items-center justify-center shadow-lg">
          <Wheat className="size-5 text-primary" />
        </div>
        <div>
          <div className="font-display text-lg leading-none tracking-tight">CAPI</div>
          <div className="text-[11px] uppercase tracking-widest text-sidebar-foreground/60 mt-1">
            ERP · Riz
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="px-3 mb-1.5 text-[10px] uppercase tracking-widest text-sidebar-foreground/50">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.to, item.exact);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                    }`}
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <div className="rounded-lg bg-sidebar-accent/50 p-3">
          <div className="flex items-center gap-2 text-xs">
            <CircleDot className="size-3 text-gold" />
            <span className="text-sidebar-foreground/80">Campagne 2024-2025</span>
          </div>
          <div className="mt-2 font-display text-xl text-sidebar-foreground">Actif</div>
          <div className="mt-1 text-[11px] text-sidebar-foreground/60">
            Site pilote · Saint-Louis
          </div>
        </div>
      </div>
    </aside>
  );
}
