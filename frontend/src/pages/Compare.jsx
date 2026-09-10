import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Crown } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import { monthlyPayment } from "@/lib/finance";
import { money, num } from "@/lib/format";

const ROWS = [
  ["Selling Price", (b) => money(b.selling_price)],
  ["Manufacturer Incentives", (b) => `-${money(b.incentives)}`],
  ["Dealer Doc Fee", (b) => money(b.doc_fee)],
  ["Title & Registration", (b) => money(b.title_fee)],
  ["Estimated Tax", (b) => money(b.estimated_tax)],
];

export default function Compare() {
  const [params] = useSearchParams();
  const ids = params.get("ids") ?? "";
  const equity = Number(params.get("equity") ?? 0);
  const navigate = useNavigate();

  const { data, isError } = useQuery({
    queryKey: ["quotes", ids, equity],
    queryFn: () => apiGet(`/vehicles/quote?ids=${encodeURIComponent(ids)}&trade_equity=${equity}`),
    enabled: !!ids,
  });

  const buildDeal = useMutation({
    mutationFn: (vehicleId) => apiPost("/deals", { vehicle_id: vehicleId }),
    onSuccess: (deal) => navigate(`/deal/${deal.id}`),
    onError: () => toast.error("Could not start that deal."),
  });

  const quotes = data ?? [];
  const cheapest = quotes.length
    ? quotes.reduce((best, q) => (q.breakdown.amount_due < best.breakdown.amount_due ? q : best), quotes[0])
    : null;

  return (
    <Shell>
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white" data-testid="compare-back">
        <ArrowLeft className="size-4" /> Back to shopping
      </Link>

      <h1 className="font-heading text-3xl font-semibold">Compare Deals</h1>
      <p className="mt-1 text-slate-400">
        Real out-the-door cost side by side{equity ? ` — including ${money(equity)} of trade equity` : ""}.
      </p>

      {isError && <p className="mt-6 text-sm text-slate-500" data-testid="compare-error">Those quotes are unavailable right now.</p>}
      {!isError && !ids && (
        <p className="mt-6 text-sm text-slate-500" data-testid="compare-empty">
          Pick two trucks on the shopping page to compare them here.
        </p>
      )}

      {quotes.length > 0 && (
        <div className="mt-8 grid gap-6 md:grid-cols-2" data-testid="compare-grid">
          {quotes.map((q, i) => {
            const b = q.breakdown;
            const isBest = cheapest && q.vehicle.id === cheapest.vehicle.id && quotes.length > 1;
            return (
              <article
                key={q.vehicle.id}
                data-testid={`compare-column-${i}`}
                className={`dd-rise overflow-hidden rounded-2xl border bg-[#111827] ${
                  isBest ? "border-emerald-500/50" : "border-[#233044]"
                }`}
              >
                <div className="relative">
                  <img src={q.vehicle.image} alt="" className="h-40 w-full object-cover" />
                  {isBest && (
                    <span
                      className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-emerald-500/40 bg-[#064E3B] px-2.5 py-1 text-xs font-semibold text-emerald-300"
                      data-testid={`compare-best-badge-${i}`}
                    >
                      <Crown className="size-3" /> Lowest cost
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="font-heading text-lg font-semibold" data-testid={`compare-title-${i}`}>
                    {q.vehicle.year} {q.vehicle.make} {q.vehicle.model}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {q.vehicle.trim} · {num(q.vehicle.mileage)} mi · {q.vehicle.distance_mi} mi away
                  </p>

                  <div className="mt-4 divide-y divide-[#1b2536]">
                    {ROWS.map(([label, fn]) => (
                      <div key={label} className="flex items-center justify-between py-2 text-sm">
                        <span className="text-slate-400">{label}</span>
                        <span className="dd-num text-slate-100">{fn(b)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-3">
                      <span className="font-heading text-sm font-semibold text-white">Estimated OTD</span>
                      <span className="dd-num font-heading text-xl font-semibold text-[#FF8A65]" data-testid={`compare-otd-${i}`}>
                        {money(b.estimated_otd)}
                      </span>
                    </div>
                    {equity !== 0 && (
                      <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-slate-400">Trade Equity</span>
                        <span className="dd-num text-emerald-400">{money(b.trade_equity)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-3">
                      <span className="font-heading text-sm font-semibold text-white">Amount Due</span>
                      <span className="dd-num font-heading text-lg font-semibold text-white" data-testid={`compare-amount-due-${i}`}>
                        {money(b.amount_due)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-400">Est. Payment (72 mo @ 6.9%)</span>
                      <span className="dd-num text-slate-100" data-testid={`compare-payment-${i}`}>
                        {money(monthlyPayment(b.amount_due, 6.9, 72))}/mo
                      </span>
                    </div>
                  </div>

                  <Button
                    className="mt-5 w-full"
                    data-testid={`compare-build-deal-${i}`}
                    disabled={buildDeal.isPending}
                    onClick={() => buildDeal.mutate(q.vehicle.id)}
                  >
                    Build This Deal
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
