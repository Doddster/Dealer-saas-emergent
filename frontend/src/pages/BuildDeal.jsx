import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Navbar";
import DealSummary from "@/components/DealSummary";
import PaymentEstimator from "@/components/PaymentEstimator";
import OfferCoach from "@/components/OfferCoach";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import { money, num } from "@/lib/format";

const CONDITIONS = { excellent: "Excellent", clean: "Clean", fair: "Fair" };

const SAMPLE_TRADE = {
  vin: "1GCUYDED5MZ118874",
  year: "2021",
  make: "Chevrolet",
  model: "Silverado 1500",
  mileage: "58400",
  payoff: "24800",
  condition: "clean",
};

const EMPTY_TRADE = { vin: "", year: "", make: "", model: "", mileage: "", payoff: "", condition: "clean" };

export default function BuildDeal() {
  const { dealId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showTrade, setShowTrade] = useState(false);
  const [trade, setTrade] = useState(EMPTY_TRADE);
  const [down, setDown] = useState("2000");
  const [offer, setOffer] = useState("");
  const [coach, setCoach] = useState(null);

  const { data: deal, isError } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => apiGet(`/deals/${dealId}`),
  });

  const saveTrade = useMutation({
    mutationFn: () =>
      apiPut(`/deals/${dealId}/trade`, {
        vin: trade.vin,
        year: Number(trade.year),
        make: trade.make,
        model: trade.model,
        mileage: Number(trade.mileage),
        payoff: Number(trade.payoff || 0),
        condition: trade.condition,
        photos: ["front", "rear", "interior"],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      toast.success("Trade added — your deal has been recalculated.");
    },
    onError: () => toast.error("Please complete year, make, model and mileage."),
  });

  const checkOffer = useMutation({
    mutationFn: () => apiPost(`/deals/${dealId}/coach`, { amount: Number(offer) }),
    onSuccess: (data) => setCoach(data),
    onError: () => toast.error("Could not check that offer."),
  });

  const saveTerms = useMutation({
    mutationFn: (amount) => apiPatch(`/deals/${dealId}/terms`, { down_payment: Number(amount || 0) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal", dealId] }),
  });

  const submitOffer = useMutation({
    mutationFn: () => apiPost(`/deals/${dealId}/offer`, { amount: Number(offer), down_payment: Number(down || 0) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      navigate(`/negotiate/${dealId}`);
    },
    onError: () => toast.error("Enter a valid offer amount."),
  });

  const v = deal?.vehicle;
  const t = deal?.trade;

  return (
    <Shell>
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white" data-testid="back-to-shop">
        <ArrowLeft className="size-4" /> Back to shopping
      </Link>

      {isError && <p className="text-sm text-slate-500" data-testid="deal-error">This deal is unavailable right now.</p>}

      {deal && (
        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <div className="flex gap-4 rounded-2xl border border-[#233044] bg-[#111827] p-4">
              <img src={v.image} alt="" className="h-24 w-36 rounded-lg object-cover" />
              <div>
                <h1 className="font-heading text-xl font-semibold" data-testid="build-deal-vehicle-title">
                  {v.year} {v.make} {v.model} {v.trim}
                </h1>
                <p className="text-sm text-slate-400">
                  {num(v.mileage)} mi · {v.distance_mi} mi away · VIN {v.vin}
                </p>
                <p className="dd-num mt-1 text-lg font-semibold">{money(v.price)}</p>
              </div>
            </div>

            {/* Trade module */}
            <section className="rounded-2xl border border-[#233044] bg-[#111827] p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-lg font-semibold">Your Trade-In</h2>
                  <p className="text-sm text-slate-400">Add a trade to apply equity to this deal.</p>
                </div>
                {!showTrade && (
                  <Button variant="outline" data-testid="add-trade-btn" onClick={() => setShowTrade(true)}>
                    Add Trade
                  </Button>
                )}
              </div>

              {t && (
                <div className="mt-4 rounded-xl border border-[#233044] bg-[#0D1524] p-4" data-testid="trade-estimate-panel">
                  <p className="text-sm text-slate-300">
                    {t.year} {t.make} {t.model} · {num(t.mileage)} mi · {CONDITIONS[t.condition] ?? t.condition}
                  </p>
                  <p className="dd-num mt-2 text-xl font-semibold text-emerald-400" data-testid="trade-estimate-range">
                    {money(t.estimated_low)} – {money(t.estimated_high)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Estimated trade range (sample valuation, no KBB/J.D. Power connected)</p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <span className="block text-xs text-slate-500">Estimated Value</span>
                      <span className="dd-num text-slate-100" data-testid="trade-estimated-value">{money(t.estimated_value)}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">Estimated Payoff</span>
                      <span className="dd-num text-slate-100" data-testid="trade-payoff-value">{money(t.payoff)}</span>
                    </div>
                    <div>
                      <span className="block text-xs text-slate-500">Equity</span>
                      <span
                        className={`dd-num ${deal.breakdown.trade_equity >= 0 ? "text-emerald-400" : "text-red-400"}`}
                        data-testid="trade-equity-value"
                      >
                        {money(deal.breakdown.trade_equity)}
                      </span>
                    </div>
                  </div>
                  <p
                    className={`dd-num mt-3 text-sm font-medium ${deal.breakdown.trade_equity >= 0 ? "text-emerald-400" : "text-red-400"}`}
                    data-testid="trade-equity-callout"
                  >
                    {deal.breakdown.trade_equity >= 0 ? "Positive equity" : "Negative equity"}:{" "}
                    {money(deal.breakdown.trade_equity)}
                  </p>
                </div>
              )}

              {showTrade && (
                <div className="mt-5 space-y-4 dd-rise" data-testid="trade-form">
                  <div className="flex items-center gap-2">
                    <Input
                      data-testid="trade-vin-input"
                      placeholder="VIN"
                      value={trade.vin}
                      onChange={(e) => setTrade({ ...trade, vin: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      type="button"
                      data-testid="trade-autofill-btn"
                      onClick={() => setTrade(SAMPLE_TRADE)}
                    >
                      <Wand2 className="size-4" /> Use sample VIN
                    </Button>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <Label className="mb-1.5 block text-xs">Year</Label>
                      <Input data-testid="trade-year-input" value={trade.year} onChange={(e) => setTrade({ ...trade, year: e.target.value })} />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Make</Label>
                      <Input data-testid="trade-make-input" value={trade.make} onChange={(e) => setTrade({ ...trade, make: e.target.value })} />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Model</Label>
                      <Input data-testid="trade-model-input" value={trade.model} onChange={(e) => setTrade({ ...trade, model: e.target.value })} />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Mileage</Label>
                      <Input data-testid="trade-mileage-input" value={trade.mileage} onChange={(e) => setTrade({ ...trade, mileage: e.target.value })} />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Estimated Payoff</Label>
                      <Input data-testid="trade-payoff-input" value={trade.payoff} onChange={(e) => setTrade({ ...trade, payoff: e.target.value })} />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Condition</Label>
                      <Select value={trade.condition} onValueChange={(val) => setTrade({ ...trade, condition: val })}>
                        <SelectTrigger data-testid="trade-condition-select" className="w-full">
                          <SelectValue>{(val) => CONDITIONS[val] ?? "Select"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(CONDITIONS).map(([k, label]) => (
                            <SelectItem key={k} value={k} data-testid={`trade-condition-${k}`}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Photos</Label>
                    <div className="flex gap-3">
                      {["Front", "Rear", "Interior"].map((slot) => (
                        <div
                          key={slot}
                          data-testid={`trade-photo-${slot.toLowerCase()}`}
                          className="grid h-20 flex-1 place-items-center rounded-lg border border-dashed border-[#374151] bg-[#0D1524] text-xs text-slate-500"
                        >
                          <ImagePlus className="size-4" />
                          {slot}
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button
                    data-testid="save-trade-btn"
                    disabled={saveTrade.isPending}
                    onClick={() => saveTrade.mutate()}
                  >
                    Get Trade Estimate
                  </Button>
                </div>
              )}
            </section>

            {/* Offer */}
            <section className="rounded-2xl border border-[#233044] bg-[#111827] p-6">
              <h2 className="font-heading text-lg font-semibold">Make Your Offer</h2>
              <p className="text-sm text-slate-400">Submit a selling price and we&apos;ll negotiate with the dealership for you.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs">Down Payment</Label>
                  <Input
                    data-testid="down-payment-input"
                    value={down}
                    onChange={(e) => setDown(e.target.value)}
                    onBlur={() => saveTerms.mutate(down)}
                  />
                  <p className="mt-1 text-xs text-slate-500">Totals recalculate when you leave this field.</p>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Your Offer (selling price)</Label>
                  <Input
                    data-testid="offer-amount-input"
                    placeholder={String(Math.round(v.price - 3000))}
                    value={offer}
                    onChange={(e) => {
                      setOffer(e.target.value);
                      setCoach(null);
                    }}
                  />
                </div>
              </div>

              <OfferCoach coach={coach} isPending={checkOffer.isPending} />

              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  variant="outline"
                  data-testid="check-offer-btn"
                  disabled={!offer || checkOffer.isPending}
                  onClick={() => checkOffer.mutate()}
                >
                  Check My Offer First
                </Button>
                <Button
                  size="lg"
                  data-testid="submit-offer-btn"
                  disabled={!offer || submitOffer.isPending}
                  onClick={() => submitOffer.mutate()}
                >
                  Submit Offer &amp; Start Negotiation
                </Button>
              </div>
            </section>
          </div>

          <aside className="h-fit space-y-6 lg:sticky lg:top-24">
            <DealSummary breakdown={deal.breakdown} />
            <PaymentEstimator amountDue={deal.breakdown.amount_due} />
          </aside>
        </div>
      )}
    </Shell>
  );
}
