import { Component, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Isole les erreurs d'affichage d'une page : le reste de l'application (menu,
 * navigation) reste utilisable et le message d'erreur exact est visible pour
 * pouvoir corriger, au lieu d'un écran blanc générique.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
    reportLovableError(error, { boundary: "page_error_boundary" });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-lg w-full card-elevated p-6 text-center">
          <h2 className="font-display text-lg">Cette section n'a pas pu s'afficher</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tes données sont bien enregistrées. Réessaie ; si le message revient, envoie-le nous.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground whitespace-pre-wrap">
            {error.message}
          </pre>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => this.setState({ error: null })}>Réessayer</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recharger la page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
