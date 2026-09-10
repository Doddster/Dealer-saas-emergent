import { useState } from "react";
import { TERMS, monthlyPayment } from "@/lib/finance";
import { money } from "@/lib/format";

export default function PaymentEstimator({ amountDue }) {
  const [term, setTerm] = useState(72);
  const [apr, setApr] = useState(6.9);
  const payment = monthlyPayment(amountDue, apr, term);

  return (
    <div className="rounded-xl border border-[#233044] bg-[#0D1524] p-5" data-testid="payment-estimator">
      <h3 className="mb-1 font-heading text-base font-semibold">Estimated Monthly Payment</h3>
      <p className="mb-4 text-xs text-slate-500">
        Based on {money(amountDue)} financed. Estimate only — no lender is connected.
      </p>

      <p className="dd-num font-heading text-3xl font-semibold text-[#FF8A65]" data-testid="monthly-payment-amount">
        {money(payment)}
        <span className="ml-1 text-sm font-normal text-slate-400">/mo</span>
      </p>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="term-slider" className="text-xs uppercase tracking-wider text-slate-500">
            Term
          </label>
          <span className="dd-num text-sm text-slate-200" data-testid="payment-term-value">
            {term} mo
          </span>
        </div>
        <input
          id="term-slider"
          type="range"
          min={TERMS[0]}
          max={TERMS[TERMS.length - 1]}
          step={12}
          value={term}
          data-testid="payment-term-slider"
          onChange={(e) => setTerm(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#233044] accent-[#FF5722]"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          {TERMS.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="apr-slider" className="text-xs uppercase tracking-wider text-slate-500">
            Estimated APR
          </label>
          <span className="dd-num text-sm text-slate-200" data-testid="payment-apr-value">
            {apr.toFixed(1)}%
          </span>
        </div>
        <input
          id="apr-slider"
          type="range"
          min={0}
          max={15}
          step={0.1}
          value={apr}
          data-testid="payment-apr-slider"
          onChange={(e) => setApr(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#233044] accent-[#FF5722]"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          <span>0%</span>
          <span>15%</span>
        </div>
      </div>
    </div>
  );
}
