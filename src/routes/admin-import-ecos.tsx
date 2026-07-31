import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { AppTopbar } from "@/components/AppTopbar";
import { RequireRole } from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabaseClient";

export const Route = createFileRoute("/admin-import-ecos")({
  head: () => ({ meta: [{ title: "Import ECOS — CAPI ERP" }] }),
  component: () => (
    <RequireRole roles={["admin"]}>
      <ImportEcosPage />
    </RequireRole>
  ),
});

const ECOS_URL = "https://sukfelhltclucdsfrlot.supabase.co";
const ECOS_KEY = "sb_publishable_f6Dc4h4QGIFMxfKI-UGXgg_kFYHVAz1";

const BOUTIQUES_CAPI = [
  { id: "CAPI", label: "Boutique CAPI" },
  { id: "COMMERCE", label: "Boutique Commerce" },
  { id: "TAZIBOUO", label: "Boutique Tazibouo" },
  { id: "GBOKORA", label: "Boutique Gbokora" },
];

type EcosShop = { id: string; name: string; seller_name: string | null };
type LogLine = { text: string; kind: "info" | "ok" | "error" };

function ImportEcosPage() {
  const [shops, setShops] = useState<EcosShop[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [loadingShops, setLoadingShops] = useState(true);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [done, setDone] = useState(false);

  function log(text: string, kind: LogLine["kind"] = "info") {
    setLogs((l) => [...l, { text, kind }]);
  }

  useEffect(() => {
    const ecos = createClient(ECOS_URL, ECOS_KEY);
    (async () => {
      try {
        const { data, error } = await ecos.from("shops").select("id, name, seller_name");
        if (error) {
          log(`Erreur de connexion à ECOS : ${error.message}`, "error");
        } else if (data) {
          setShops(data);
          const initial: Record<string, string> = {};
          data.forEach((s, i) => {
            if (BOUTIQUES_CAPI[i]) initial[s.id] = BOUTIQUES_CAPI[i].id;
          });
          setMapping(initial);
          log(`${data.length} boutique(s) trouvée(s) côté ECOS.`, "ok");
        }
      } catch (e) {
        log(`Échec réseau vers ECOS : ${String(e)}`, "error");
      } finally {
        setLoadingShops(false);
      }
    })();
  }, []);

  async function runImport() {
    setRunning(true);
    setLogs([]);
    setDone(false);
    const ecos = createClient(ECOS_URL, ECOS_KEY);

    try {
      // ---------- Boutiques : mettre à jour le nom / vendeuse réels ----------
      for (const shop of shops) {
        const boutiqueId = mapping[shop.id];
        if (!boutiqueId) continue;
        await supabase.from("boutiques").update({ name: shop.name, seller_name: shop.seller_name }).eq("id", boutiqueId);
      }
      log("Boutiques mises à jour avec les vrais noms.", "ok");

      // ---------- Produits ----------
      const { data: products, error: prodErr } = await ecos.from("products").select("*");
      if (prodErr) throw new Error(`Produits ECOS : ${prodErr.message}`);
      log(`${products?.length ?? 0} produits trouvés côté ECOS.`);

      const productIdMap = new Map<string, string>();
      for (const p of products ?? []) {
        const boutiqueId = mapping[p.shop_id];
        if (!boutiqueId) continue;
        const { data: inserted, error } = await supabase
          .from("produits_boutique")
          .insert({
            boutique_id: boutiqueId, name: p.name, unit: p.unit, price: p.price,
            is_active: p.is_active, stock_initial: p.stock_initial,
          })
          .select("id")
          .single();
        if (error) { log(`Produit ${p.name} : ${error.message}`, "error"); continue; }
        productIdMap.set(p.id, inserted.id);
      }
      log(`${productIdMap.size} produits importés.`, "ok");

      // ---------- Ventes ----------
      const { data: sales, error: salesErr } = await ecos.from("sales").select("*").is("deleted_at", null);
      if (salesErr) throw new Error(`Ventes ECOS : ${salesErr.message}`);
      const salesRows = (sales ?? [])
        .filter((s) => mapping[s.shop_id] && productIdMap.has(s.product_id))
        .map((s) => ({
          boutique_id: mapping[s.shop_id], produit_id: productIdMap.get(s.product_id),
          quantity: s.quantity, unit_price: s.unit_price, payment_mode: s.payment_mode, sale_date: s.sale_date,
        }));
      for (let i = 0; i < salesRows.length; i += 500) {
        const chunk = salesRows.slice(i, i + 500);
        const { error } = await supabase.from("ventes_boutique_v2").insert(chunk);
        if (error) { log(`Ventes (lot ${i}) : ${error.message}`, "error"); }
      }
      log(`${salesRows.length} ventes importées.`, "ok");

      // ---------- Mouvements de caisse ----------
      const { data: cash, error: cashErr } = await ecos.from("cash_movements").select("*");
      if (cashErr) throw new Error(`Caisse ECOS : ${cashErr.message}`);
      const cashRows = (cash ?? [])
        .filter((c) => mapping[c.shop_id])
        .map((c) => ({
          boutique_id: mapping[c.shop_id], movement_type: c.movement_type, amount: c.amount,
          mode: c.mode, description: c.description, movement_date: c.movement_date,
        }));
      for (let i = 0; i < cashRows.length; i += 500) {
        const { error } = await supabase.from("mouvements_caisse").insert(cashRows.slice(i, i + 500));
        if (error) log(`Caisse (lot ${i}) : ${error.message}`, "error");
      }
      log(`${cashRows.length} mouvements de caisse importés.`, "ok");

      // ---------- Mouvements de stock ----------
      const { data: stock, error: stockErr } = await ecos.from("stock_movements").select("*");
      if (stockErr) throw new Error(`Stock ECOS : ${stockErr.message}`);
      const stockRows = (stock ?? [])
        .filter((m) => mapping[m.shop_id] && productIdMap.has(m.product_id))
        .map((m) => ({
          boutique_id: mapping[m.shop_id], produit_id: productIdMap.get(m.product_id),
          movement_type: m.movement_type, quantity: m.quantity, reason: m.reason, movement_date: m.movement_date,
        }));
      for (let i = 0; i < stockRows.length; i += 500) {
        const { error } = await supabase.from("mouvements_stock").insert(stockRows.slice(i, i + 500));
        if (error) log(`Stock (lot ${i}) : ${error.message}`, "error");
      }
      log(`${stockRows.length} mouvements de stock importés.`, "ok");

      // ---------- Inventaires physiques ----------
      const { data: inv, error: invErr } = await ecos.from("inventory_checks").select("*");
      if (invErr) throw new Error(`Inventaire ECOS : ${invErr.message}`);
      const invRows = (inv ?? [])
        .filter((c) => mapping[c.shop_id] && productIdMap.has(c.product_id))
        .map((c) => ({
          boutique_id: mapping[c.shop_id], produit_id: productIdMap.get(c.product_id),
          theoretical_qty: c.theoretical_qty, physical_qty: c.physical_qty,
          corrected: c.corrected, check_date: c.check_date, notes: c.notes,
        }));
      for (let i = 0; i < invRows.length; i += 500) {
        const { error } = await supabase.from("inventaires_physiques").insert(invRows.slice(i, i + 500));
        if (error) log(`Inventaire (lot ${i}) : ${error.message}`, "error");
      }
      log(`${invRows.length} contrôles d'inventaire importés.`, "ok");

      log("Import terminé.", "ok");
      setDone(true);
    } catch (e) {
      log(String(e), "error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <AppTopbar eyebrow="Configuration initiale" title="Import ECOS → CAPI ERP" />
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="card-elevated p-5 space-y-3">
          <p className="text-sm text-muted-foreground">
            Cette page copie une seule fois les données d'ECOS (boutiques, produits, ventes, caisse, stock,
            inventaire) vers le module Commercial du CAPI ERP. Vérifie l'association des boutiques ci-dessous
            avant de lancer l'import.
          </p>
        </div>

        <div className="card-elevated p-5 space-y-3">
          <h3 className="font-display text-lg">Association des boutiques</h3>
          {loadingShops ? (
            <p className="text-sm text-muted-foreground">Connexion à ECOS…</p>
          ) : shops.length === 0 ? (
            <p className="text-sm text-destructive">Aucune boutique trouvée côté ECOS — vérifie la connexion.</p>
          ) : (
            shops.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 py-1.5">
                <div>
                  <div className="text-sm font-medium">{s.name}</div>
                  {s.seller_name && <div className="text-xs text-muted-foreground">{s.seller_name}</div>}
                </div>
                <Select value={mapping[s.id] ?? ""} onValueChange={(v) => setMapping({ ...mapping, [s.id]: v })}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Choisir une boutique CAPI" /></SelectTrigger>
                  <SelectContent>
                    {BOUTIQUES_CAPI.map((b) => <SelectItem key={b.id} value={b.id}>{b.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </div>

        <Button onClick={runImport} disabled={running || loadingShops || shops.length === 0}>
          {running ? "Import en cours…" : done ? "Relancer l'import" : "Lancer l'import"}
        </Button>

        {logs.length > 0 && (
          <div className="card-elevated p-4 space-y-1 font-mono text-xs max-h-96 overflow-y-auto">
            {logs.map((l, i) => (
              <div key={i} className={l.kind === "error" ? "text-destructive" : l.kind === "ok" ? "text-success" : "text-muted-foreground"}>
                {l.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
