import { Lightbulb, Loader2 } from "lucide-react";
import { money } from "@/lib/format";

const TONE = {
  strong: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  possible: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  unlikely: "border-red-500/40 bg-red-500/10 text-red-200",
};

const LABEL = {
  strong: "Likely to be accepted",
  possible: "Might work — expect a counter",
  unlikely: "Aggressive — expect a firm counter",
};

export default function OfferCoach({ coach, isPending }) {
  if (isPending) {
    return (
      <div
        className="mt-4 flex items-center gap-2 rounded-xl border border-[#233044] bg-[#0D1524] px-4 py-3 text-sm text-slate-400"
        data-testid="offer-coach-loading"
      >
        <Loader2 className="size-4 animate-spin" /> Checking your offer…
      </div>
    );
  }
  if (!coach) return null;

  return (
    <div className={`dd-rise mt-4 rounded-xl border px-4 py-3 ${TONE[coach.band]}`} data-testid="offer-coach">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Lightbulb className="size-4 shrink-0" />
        <span data-testid="offer-coach-band">{LABEL[coach.band]}</span>
        <span className="dd-num ml-auto text-xs opacity-70" data-testid="offer-coach-amount">
          {money(coach.amount)}
        </span>
      </p>
      <p className="mt-1.5 text-sm opacity-90" data-testid="offer-coach-hint">
        {coach.hint}
      </p>
      <p className="mt-2 text-[11px] opacity-60">Private to you — the dealership never sees this.</p>
    </div>
  );
}
