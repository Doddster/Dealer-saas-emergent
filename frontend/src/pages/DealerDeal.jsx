import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Navbar";
import DealSummary from "@/components/DealSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost } from "@/lib/api";
import { money, num, STATUS_LABELS, statusTone } from "@/lib/format";

export default function DealerDeal() {
  const { dealId } = useParams();
  const qc = useQueryClient();
  const [counter, setCounter] = useState("");

  // Poll so the desk sees a customer counter without a manual refresh.
  const { data: deal, isError } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => apiGet(`/deals/${dealId}`),
    refetchInterval: 5000,
  });

  const { data: rules } = useQuery({
    queryKey: ["effective-rules", deal?.vehicle?.vin],
    queryFn: () => apiGet(`/dealer/effective-rules/${deal.vehicle.vin}`),
    enabled: !!deal?.vehicle?.vin,
  });

  const act = useMutation({
    mutationFn: (body) => apiPost(`/deals/${dealId}/dealer-action`, body),
    onSuccess: (_r, body) => {
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      toast.success(`Deal ${body.action === "takeover" ? "taken over" : `${body.action}ed`}.`);
    },
    onError: (e) => toast.error(e?.body?.detail ?? "That action failed."),
  });

  const t = deal?.trade;

  return (
    <Shell>
      <Link to="/dealer" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white" data-testid="dealer-back">
        <ArrowLeft className="size-4" /> Back to deal queue
      </Link>

      {isError && <p className="text-sm text-slate-500" data-testid="dealer-deal-error">This deal is unavailable right now.</p>}

      {deal && (
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-semibold" data-testid="dealer-deal-title">
                {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model} {deal.vehicle.trim}
              </h1>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(deal.status)}`} data-testid="dealer-deal-status">
                {STATUS_LABELS[deal.status] ?? deal.status}
              </span>
              {deal.taken_over && (
                <span className="rounded-full border border-[#FF5722]/40 bg-[#2A1810] px-3 py-1 text-xs text-[#FF8A65]" data-testid="taken-over-badge">
                  Human desking
                </span>
              )}
            </div>
            <p className="-mt-3 text-sm text-slate-400">
              Customer: {deal.customer_name} · VIN {deal.vehicle.vin} · Advertised {money(deal.vehicle.price)}
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#233044] bg-[#111827] p-5">
                <p className="text-xs uppercase tracking-wider text-slate-500">Customer Offer</p>
                <p className="dd-num mt-1 font-heading text-2xl font-semibold" data-testid="dealer-customer-offer">
                  {deal.latest_offer ? money(deal.latest_offer) : "—"}
                </p>
                <p className="dd-num mt-1 text-xs text-slate-500">
                  Advertised {money(deal.vehicle.price)} · Current counter:{" "}
                  {deal.latest_counter ? money(deal.latest_counter) : "—"}
                </p>
                <p className="dd-num mt-1 text-xs text-slate-500" data-testid="dealer-down-payment">
                  Down payment {money(deal.down_payment)}
                </p>
              </div>
              <div className="rounded-xl border border-[#233044] bg-[#111827] p-5">
                <p className="text-xs uppercase tracking-wider text-slate-500">Trade</p>
                {t ? (
                  <div data-testid="dealer-trade-info">
                    <p className="mt-1 text-sm text-slate-200">
                      {t.year} {t.make} {t.model} · {num(t.mileage)} mi
                    </p>
                    <p className="dd-num mt-1 text-sm text-slate-400">
                      ACV {money(t.estimated_value)} · Payoff {money(t.payoff)}
                    </p>
                    <p
                      className={`dd-num mt-1 text-sm ${deal.breakdown.trade_equity >= 0 ? "text-emerald-400" : "text-red-400"}`}
                      data-testid="dealer-trade-equity"
                    >
                      Equity {money(deal.breakdown.trade_equity)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-slate-500" data-testid="dealer-trade-info">No trade submitted</p>
                )}
              </div>
            </div>

            {rules && (
              <div className="rounded-xl border border-[#233044] bg-[#0D1524] p-5" data-testid="dealer-effective-rules">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Active negotiation rules ({rules.source === "vin_override" ? "VIN override" : "dealership default"})
                </p>
                <div className="dd-num mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><span className="block text-xs text-slate-500">AI Authority</span>{money(rules.ai_discount_authority)}</div>
                  <div><span className="block text-xs text-slate-500">Mgr Threshold</span>{money(rules.manager_threshold)}</div>
                  <div><span className="block text-xs text-slate-500">Hard Floor</span>{money(rules.hard_floor)}</div>
                  <div><span className="block text-xs text-slate-500">Max Deviation</span>{rules.max_deviation_pct}%</div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-[#233044] bg-[#0F172A] p-5" data-testid="dealer-thread">
              <h3 className="mb-3 font-heading text-sm font-semibold">Conversation</h3>
              <div className="space-y-2 text-sm">
                {deal.messages.map((m) => (
                  <p key={m.id} className="text-slate-300">
                    <span className="text-xs uppercase tracking-wider text-slate-500">
                      {m.sender === "customer" ? "Customer" : m.sender === "dealer" ? "Store" : "System"}:{" "}
                    </span>
                    {m.text}
                  </p>
                ))}
                {deal.messages.length === 0 && <p className="text-slate-500">No activity yet.</p>}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#233044] bg-[#111827] p-5" data-testid="dealer-actions">
              <Button data-testid="dealer-accept-btn" disabled={act.isPending} onClick={() => act.mutate({ action: "accept" })}>
                Accept
              </Button>
              <div>
                <Label className="mb-1.5 block text-xs">Counter amount</Label>
                <div className="flex gap-2">
                  <Input
                    data-testid="dealer-counter-input"
                    className="w-36"
                    value={counter}
                    onChange={(e) => setCounter(e.target.value)}
                    placeholder="66000"
                  />
                  <Button
                    variant="outline"
                    data-testid="dealer-counter-btn"
                    disabled={!counter || act.isPending}
                    onClick={() => {
                      act.mutate({ action: "counter", amount: Number(counter) });
                      setCounter("");
                    }}
                  >
                    Counter
                  </Button>
                </div>
              </div>
              <Button variant="destructive" data-testid="dealer-decline-btn" disabled={act.isPending} onClick={() => act.mutate({ action: "decline" })}>
                Decline
              </Button>
              <Button variant="secondary" data-testid="dealer-takeover-btn" disabled={act.isPending} onClick={() => act.mutate({ action: "takeover" })}>
                <UserCog className="size-4" /> Take Over
              </Button>
            </div>
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <DealSummary breakdown={deal.breakdown} />
          </aside>
        </div>
      )}
    </Shell>
  );
}
