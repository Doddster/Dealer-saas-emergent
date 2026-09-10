import { money } from "@/lib/format";

function Row({ label, value, testid, tone = "" }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`dd-num font-medium ${tone || "text-slate-100"}`} data-testid={testid}>
        {value}
      </span>
    </div>
  );
}

export default function DealSummary({ breakdown, taxRatePct = 7.5 }) {
  if (!breakdown) return null;
  const b = breakdown;
  const hasTrade = (b.trade_value || 0) > 0;
  return (
    <div
      className="rounded-xl border border-[#233044] bg-[#0D1524] p-5"
      data-testid="deal-breakdown"
    >
      <h3 className="mb-3 font-heading text-base font-semibold">Deal Structure</h3>
      <div className="divide-y divide-[#1b2536]">
        <Row label="Selling Price" value={money(b.selling_price)} testid="breakdown-selling-price" />
        <Row
          label="Manufacturer Incentives"
          value={`-${money(b.incentives)}`}
          testid="breakdown-incentives"
          tone="text-emerald-400"
        />
        <Row label="Dealer Doc Fee" value={money(b.doc_fee)} testid="breakdown-doc-fee" />
        <Row label="Title & Registration" value={money(b.title_fee)} testid="breakdown-title-fee" />
        <Row
          label={`Estimated Tax (${taxRatePct}%)`}
          value={money(b.estimated_tax)}
          testid="breakdown-tax"
        />
        <div className="flex items-center justify-between py-3">
          <span className="font-heading text-sm font-semibold text-white">Estimated OTD</span>
          <span className="dd-num font-heading text-xl font-semibold text-[#FF8A65]" data-testid="breakdown-otd">
            {money(b.estimated_otd)}
          </span>
        </div>
        {hasTrade && (
          <>
            <Row label="Trade Value" value={money(b.trade_value)} testid="breakdown-trade-value" />
            <Row label="Trade Payoff" value={`-${money(b.trade_payoff)}`} testid="breakdown-trade-payoff" />
            <Row
              label={b.trade_equity >= 0 ? "Positive Trade Equity" : "Negative Trade Equity"}
              value={money(b.trade_equity)}
              testid="breakdown-trade-equity"
              tone={b.trade_equity >= 0 ? "text-emerald-400" : "text-red-400"}
            />
          </>
        )}
        {b.down_payment > 0 && (
          <Row label="Down Payment" value={`-${money(b.down_payment)}`} testid="breakdown-down-payment" />
        )}
        <div className="flex items-center justify-between pt-3">
          <span className="font-heading text-sm font-semibold text-white">Amount Due at Delivery</span>
          <span className="dd-num font-heading text-lg font-semibold text-white" data-testid="breakdown-amount-due">
            {money(b.amount_due)}
          </span>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Sample figures only — no lender, DMV, or valuation provider is connected.
      </p>
    </div>
  );
}
