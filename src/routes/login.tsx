import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wheat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authActions, useAuth, ROLE_HOME } from "@/lib/authStore";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connexion — CAPI ERP" }] }),
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const { status, profile } = useAuth();
  const [mode, setMode] = useState<"pin" | "email">("pin");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "signed-in" && profile) {
      router.navigate({ to: ROLE_HOME[profile.role] as "/" });
    }
  }, [status, profile, router]);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pin.length !== 6) {
      setError("Le PIN doit comporter 6 chiffres.");
      return;
    }
    setLoading(true);
    const { error: err } = await authActions.signInWithPin(pin);
    setLoading(false);
    if (err) setError("PIN incorrect. Vérifie et réessaie.");
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await authActions.signInWithEmail(email, password);
    setLoading(false);
    if (err) setError("Identifiants incorrects.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="size-14 rounded-xl gradient-gold flex items-center justify-center shadow-lg mb-3">
            <Wheat className="size-7 text-primary" />
          </div>
          <div className="font-display text-2xl">CAPI ERP</div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Riz · Chaîne de valeur</div>
        </div>

        <div className="card-elevated p-6">
          <div className="flex gap-1 mb-5 border-b border-border">
            <button
              onClick={() => setMode("pin")}
              className={`flex-1 px-3 py-2.5 text-sm border-b-2 -mb-px ${mode === "pin" ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}
            >
              Employé (PIN)
            </button>
            <button
              onClick={() => setMode("email")}
              className={`flex-1 px-3 py-2.5 text-sm border-b-2 -mb-px ${mode === "email" ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}
            >
              Partenaire (email)
            </button>
          </div>

          {mode === "pin" ? (
            <form onSubmit={submitPin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Code PIN à 6 chiffres</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="text-center text-2xl tracking-[0.5em] h-14"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitEmail} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Mot de passe</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
