import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { useAuth, type AppRole } from "@/lib/authStore";

export function RequireRole({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const router = useRouter();
  const { status, profile } = useAuth();

  const authorized = status === "signed-in" && !!profile && roles.includes(profile.role);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "signed-out") {
      router.navigate({ to: "/login" });
      return;
    }
    if (status === "signed-in" && profile && !roles.includes(profile.role)) {
      router.navigate({ to: "/" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, profile]);

  if (!authorized) {
    return (
      <div className="flex-1 flex items-center justify-center p-10 text-sm text-muted-foreground">
        Chargement…
      </div>
    );
  }
  return <>{children}</>;
}
