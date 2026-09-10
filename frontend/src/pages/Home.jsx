import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, MapPin, Gauge, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost } from "@/lib/api";
import { money, num } from "@/lib/format";

const PROMPTS = ["GMC Denali 1500", "Ford F-150 hybrid under 50k", "Ram 1500 crew cab", "Toyota Tundra 1794"];

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [term, setTerm] = useState(q);
  const navigate = useNavigate();

  const { data, isError } = useQuery({
    queryKey: ["vehicles", q],
    queryFn: () => apiGet(`/vehicles/search?q=${encodeURIComponent(q)}`),
  });

  const buildDeal = useMutation({
    mutationFn: (vehicleId) => apiPost("/deals", { vehicle_id: vehicleId }),
    onSuccess: (deal) => navigate(`/deal/${deal.id}`),
    onError: () => toast.error("Could not start that deal. Try again."),
  });

  const results = data?.results ?? [];
  const equity = params.get("equity");

  return (
    <Shell>
      <section className="relative overflow-hidden rounded-2xl border border-[#233044] bg-[#111827]">
        <img
          src="https://images.unsplash.com/photo-1601252300554-4ad551483bd2?crop=entropy&cs=srgb&fm=jpg&w=1600&q=70"
          alt=""
          className="absolute inset-0 size-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0F17]/80 to-[#0B0F17]/95" />
        <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.15fr_0.85fr] lg:p-14">
          <div>
            <Badge className="mb-4 border-[#FF5722]/40 bg-[#2A1810] text-[#FF8A65]" variant="outline">
              Prototype · sample inventory
            </Badge>
            <h1 className="font-heading text-4xl font-semibold leading-tight sm:text-5xl">
              Tell us what vehicle
              <br />
              you&apos;re looking for.
            </h1>
            <p className="mt-4 max-w-lg text-slate-400">
              Search across every brand in plain language. Build the full deal, add your trade, and
              negotiate digitally — before you ever walk into a store.
            </p>

            <form
              className="mt-7 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                setParams(term ? { q: term } : {});
              }}
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  data-testid="nl-search-input"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Tell us what vehicle you're looking for."
                  className="h-12 border-[#233044] bg-[#0D1524] pl-9 text-base"
                />
              </div>
              <Button type="submit" size="lg" data-testid="nl-search-submit" className="h-12 px-7">
                Search
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {PROMPTS.map((p, i) => (
                <button
                  key={p}
                  type="button"
                  data-testid={`prompt-chip-${i}`}
                  onClick={() => {
                    setTerm(p);
                    setParams({ q: p });
                  }}
                  className="rounded-full border border-[#233044] bg-[#0D1524] px-3 py-1.5 text-xs text-slate-300 transition-colors duration-150 hover:border-[#FF5722]/50 hover:text-white"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="self-end rounded-xl border border-[#233044] bg-[#0D1524]/80 p-5">
            <p className="text-xs uppercase tracking-widest text-slate-500">How it works</p>
            <ol className="mt-3 space-y-2 text-sm text-slate-300">
              <li>1 · Search in plain language across brands</li>
              <li>2 · Build the full out-the-door deal</li>
              <li>3 · Add your trade and see real equity</li>
              <li>4 · Negotiate digitally, then meet the dealer</li>
            </ol>
          </div>
        </div>
      </section>

      {equity && (
        <div
          className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300"
          data-testid="shopping-with-equity-banner"
        >
          Shopping with {money(equity)} of trade equity from your garage vehicle.
        </div>
      )}

      {data?.interpretation_note && (
        <div
          className="mt-6 flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-200"
          data-testid="search-interpretation"
        >
          <Sparkles className="size-4 shrink-0" />
          <span>
            {data.interpretation_note} Showing {results.length} matches near you.
          </span>
        </div>
      )}

      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="font-heading text-2xl font-semibold">Matching vehicles</h2>
        <span className="text-sm text-slate-500" data-testid="results-count">
          {results.length} results
        </span>
      </div>

      {isError && (
        <p className="mt-4 text-sm text-slate-500" data-testid="results-error">
          Inventory is unavailable right now. Please try again shortly.
        </p>
      )}

      <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {results.map((v, i) => (
          <article
            key={v.id}
            data-testid={`vehicle-card-${i}`}
            className="dd-rise group flex flex-col overflow-hidden rounded-xl border border-[#233044] bg-[#111827] transition-transform duration-200 ease-out hover:-translate-y-1 hover:border-[#FF5722]/50"
          >
            <Link to={`/vehicle/${v.id}`} className="relative block" data-testid={`vehicle-link-${i}`}>
              <img src={v.image} alt={`${v.make} ${v.model}`} className="h-40 w-full object-cover" />
              <span
                className="absolute left-3 top-3 rounded-full border border-emerald-500/40 bg-[#064E3B] px-2.5 py-1 text-xs font-semibold text-emerald-300"
                data-testid={`match-pct-${i}`}
              >
                {v.match_pct}% Match
              </span>
            </Link>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-heading text-base font-semibold leading-snug" data-testid={`vehicle-title-${i}`}>
                {v.year} {v.make} {v.model}
              </h3>
              <p className="text-sm text-slate-400">{v.trim}</p>
              <p className="dd-num mt-3 text-2xl font-semibold text-white" data-testid={`vehicle-price-${i}`}>
                {money(v.price)}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span className="flex items-center gap-1" data-testid={`vehicle-mileage-${i}`}>
                  <Gauge className="size-3" /> {num(v.mileage)} mi
                </span>
                <span className="flex items-center gap-1" data-testid={`vehicle-distance-${i}`}>
                  <MapPin className="size-3" /> {v.distance_mi} mi away
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {v.features.slice(0, 3).map((f) => (
                  <span key={f} className="rounded-md border border-[#233044] bg-[#0D1524] px-2 py-0.5 text-[11px] text-slate-300">
                    {f}
                  </span>
                ))}
              </div>
              <Button
                className="mt-4 w-full"
                data-testid={`build-deal-btn-${i}`}
                disabled={buildDeal.isPending}
                onClick={() => buildDeal.mutate(v.id)}
              >
                Build Deal
              </Button>
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}
