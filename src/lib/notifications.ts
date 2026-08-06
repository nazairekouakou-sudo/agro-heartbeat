// Notifications dérivées des données réelles (paddy, usinage, commercial).
// Les opérations les plus récentes remontent automatiquement dans la cloche.
import { useEffect, useMemo, useState } from "react";
import { usePaddy } from "./paddyStore";
import { useUsinage } from "./usinageStore";
import { useCommercial } from "./commercialStore";

export type Notif = {
  id: string;
  title: string;
  body: string;
  time: string;
  date: string;
  read: boolean;
};

const READ_KEY = "capi.notifs.read";

function loadRead(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRead(ids: string[]) {
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(-300)));
  } catch {
    /* stockage indisponible : on ignore */
  }
}

function relative(dateISO: string): string {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j === 1) return "Hier";
  if (j < 31) return `Il y a ${j} jours`;
  return d.toLocaleDateString("fr-FR");
}

const nf = (n: number, d = 0) =>
  Number.isFinite(n) ? n.toLocaleString("fr-FR", { maximumFractionDigits: d }) : "—";

export function useNotifications(limit = 15) {
  const { appros, sechages, sorties } = usePaddy();
  const { decorticages, tries } = useUsinage();
  const { ventes } = useCommercial();
  const [readIds, setReadIds] = useState<string[]>([]);

  useEffect(() => {
    setReadIds(loadRead());
  }, []);

  const items = useMemo(() => {
    const raw: Omit<Notif, "read" | "time">[] = [];

    for (const a of appros) {
      raw.push({
        id: `appro:${a.id}`,
        date: a.dateEntree || a.dateAppro,
        title: "Nouveau lot paddy réceptionné",
        body: `${a.id} — ${nf((a.poids ?? 0) / 1000, 2)} t · ${a.entityName || a.entity} · ${a.zone}`,
      });
    }
    for (const s of sechages) {
      raw.push({
        id: `sechage:${s.id}`,
        date: s.date,
        title: "Séchage enregistré",
        body: `${s.lotId} — TH ${nf(s.thInitial, 1)}% → ${nf(s.thApres, 1)}% en ${s.jours} j`,
      });
    }
    for (const s of sorties) {
      raw.push({
        id: `sortie:${s.id}`,
        date: s.date,
        title: "Sortie de paddy",
        body: `${s.lotId} — ${nf(s.sacs)} sacs vers ${s.destination}`,
      });
    }
    for (const d of decorticages) {
      raw.push({
        id: `dec:${d.id}`,
        date: d.date,
        title: "Décorticage terminé",
        body: `${d.lotId} — rendement ${nf(d.rendement, 1)}%, qualité ${d.qualite}`,
      });
    }
    for (const t of tries ?? []) {
      raw.push({
        id: `trie:${t.id}`,
        date: t.date,
        title: "Trie optique réalisée",
        body: `${t.lotId ?? t.id} — récupération ${nf(t.tauxRecuperation ?? 0, 1)}%`,
      });
    }
    for (const v of ventes) {
      raw.push({
        id: `vente:${v.id}`,
        date: v.date,
        title: "Vente boutique enregistrée",
        body: `${v.boutique} — ${nf(v.sortie)} sacs · ${nf(v.montant)} FCFA`,
      });
    }

    return raw
      .filter((n) => n.date)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, limit)
      .map<Notif>((n) => ({ ...n, time: relative(n.date), read: readIds.includes(n.id) }));
  }, [appros, sechages, sorties, decorticages, tries, ventes, readIds, limit]);

  const unread = items.filter((n) => !n.read).length;

  function markOneRead(id: string) {
    setReadIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      saveRead(next);
      return next;
    });
  }
  function markAllRead() {
    setReadIds((prev) => {
      const next = Array.from(new Set([...prev, ...items.map((n) => n.id)]));
      saveRead(next);
      return next;
    });
  }

  return { notifs: items, unread, markOneRead, markAllRead };
}
