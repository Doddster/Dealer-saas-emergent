import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BellRing } from "lucide-react";
import { Shell } from "@/components/Navbar";
import { apiGet } from "@/lib/api";
import { useDealerAlerts, needsHuman } from "@/lib/useDealerAlerts";
import { money, STATUS_LABELS, statusTone } from "@/lib/format";

export default function DealerDashboard() {
  // notify=true: this screen owns the toasts for newly escalated deals
  const { data, isError, deals, alerts } = useDealerAlerts({ notify: true });
  const { data: rules } = useQuery({ queryKey: ["dealer-rules"], queryFn: () => apiGet("/dealer/rules") });

  const open = deals.filter((d) => !["closed", "declined"].includes(d.status));
  const gross = deals.reduce((s, d) => s + (d.agreed_price ? d.agreed_price - d.vehicle.price * 0.9 : 0), 0);

  return (
    <Shell>
      <h1 className="font-heading text-3xl font-semibold" data-testid="dealer-dashboard-title">
        Dealer Desk
      </h1>
      <p className="mt-1 text-slate-400">{rules?.dealer_name ?? "Summit Motors Group"} · incoming digital deals</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Incoming Deals", deals.length, "stat-total-deals"],
          ["Open / Action Needed", open.length, "stat-open-deals"],
          ["Needs a Human", alerts.length, "stat-needs-human"],
          ["Est. Front Gross", money(gross), "stat-gross"],
        ].map(([label, value, testid]) => (
          <div key={label} className="rounded-xl border border-[#233044] bg-[#111827] p-5">
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="dd-num mt-2 font-heading text-2xl font-semibold" data-testid={testid}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <section
          className="dd-rise mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5"
          data-testid="needs-human-alert"
        >
          <h2 className="flex items-center gap-2 font-heading text-base font-semibold text-amber-200">
            <BellRing className="size-4 shrink-0 animate-pulse" />
            {alerts.length} deal{alerts.length > 1 ? "s" : ""} waiting on a human
          </h2>
          <div className="mt-3 space-y-2">
            {alerts.map((d, i) => (
              <Link
                key={d.id}
                to={`/dealer/deals/${d.id}`}
                data-testid={`needs-human-row-${i}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/20 bg-[#0D1524] px-3 py-2 text-sm transition-colors duration-150 hover:border-amber-500/50"
              >
                <span className="font-medium text-slate-100">
                  {d.vehicle.year} {d.vehicle.make} {d.vehicle.model}
                </span>
                <span className="text-xs text-slate-400">{d.customer_name}</span>
                <span className="dd-num ml-auto text-slate-200">
                  {d.latest_offer ? money(d.latest_offer) : "—"}
                </span>
                <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-300">
                  {d.taken_over ? "Human desking" : "Manager review"}
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-xs text-amber-200/70">Live — this list refreshes on its own every few seconds.</p>
        </section>
      )}

      <h2 className="mt-10 font-heading text-xl font-semibold">Incoming deals</h2>
      {isError && <p className="mt-4 text-sm text-slate-500" data-testid="dealer-deals-error">Deal queue unavailable right now.</p>}
      {!isError && deals.length === 0 && (
        <p className="mt-4 text-sm text-slate-500" data-testid="dealer-deals-empty">
          No customer deals yet. Build one from the consumer side to see it here.
        </p>
      )}

      <div className="mt-4 space-y-3" data-testid="dealer-deals-list">
        {deals.map((d, i) => (
          <Link
            key={d.id}
            to={`/dealer/deals/${d.id}`}
            data-testid={`dealer-deal-row-${i}`}
            className={`flex flex-wrap items-center gap-4 rounded-xl border bg-[#111827] p-4 transition-colors duration-150 hover:border-[#FF5722]/50 ${
              needsHuman(d) ? "border-amber-500/40" : "border-[#233044]"
            }`}
          >
            <img src={d.vehicle.image} alt="" className="h-14 w-20 rounded-lg object-cover" />
            <div className="min-w-[220px] flex-1">
              <p className="font-medium" data-testid={`dealer-deal-vehicle-${i}`}>
                {d.vehicle.year} {d.vehicle.make} {d.vehicle.model} {d.vehicle.trim}
              </p>
              <p className="text-xs text-slate-500">
                {d.customer_name} · VIN {d.vehicle.vin}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Customer Offer</p>
              <p className="dd-num font-semibold" data-testid={`dealer-deal-offer-${i}`}>
                {d.latest_offer ? money(d.latest_offer) : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">Advertised</p>
              <p className="dd-num font-semibold">{money(d.vehicle.price)}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(d.status)}`} data-testid={`dealer-deal-status-${i}`}>
              {STATUS_LABELS[d.status] ?? d.status}
            </span>
          </Link>
        ))}
      </div>
    </Shell>
  );
}
