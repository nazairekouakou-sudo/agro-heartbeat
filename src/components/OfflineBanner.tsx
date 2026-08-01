import { WifiOff, RefreshCw } from "lucide-react";
import { useOfflineQueue } from "@/lib/offlineQueue";

export function OfflineBanner() {
  const { online, queue, syncing } = useOfflineQueue();

  if (online && queue.length === 0) return null;

  return (
    <div
      className={`w-full text-xs px-4 py-2 flex items-center justify-center gap-2 shrink-0 ${
        !online ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
      }`}
    >
      {!online ? (
        <>
          <WifiOff className="size-3.5" />
          Hors ligne — tes saisies sont enregistrées sur l'appareil et seront envoyées dès le retour du réseau
          {queue.length > 0 && ` (${queue.length} en attente)`}.
        </>
      ) : (
        <>
          <RefreshCw className={`size-3.5 ${syncing ? "animate-spin" : ""}`} />
          Synchronisation de {queue.length} action{queue.length > 1 ? "s" : ""} en attente…
        </>
      )}
    </div>
  );
}
