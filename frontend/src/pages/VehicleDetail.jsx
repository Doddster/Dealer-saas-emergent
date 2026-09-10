import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Gauge, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { apiGet, apiPost } from "@/lib/api";
import { money, num } from "@/lib/format";

export default function VehicleDetail() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { data: v, isError } = useQuery({
    queryKey: ["vehicle", vehicleId],
    queryFn: () => apiGet(`/vehicles/${vehicleId}`),
  });

  const buildDeal = useMutation({
    mutationFn: () => apiPost("/deals", { vehicle_id: vehicleId }),
    onSuccess: (deal) => navigate(`/deal/${deal.id}`),
    onError: () => toast.error("Could not start that deal."),
  });

  return (
    <Shell>
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white" data-testid="back-to-results">
        <ArrowLeft className="size-4" /> Back to results
      </Link>

      {isError && <p className="text-sm text-slate-500" data-testid="vehicle-error">This vehicle is unavailable right now.</p>}

      {v && (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <img
              src={v.image}
              alt={`${v.make} ${v.model}`}
              className="h-72 w-full rounded-2xl border border-[#233044] object-cover sm:h-96"
              data-testid="vehicle-detail-image"
            />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["VIN", v.vin],
                ["Exterior", v.exterior],
                ["Drivetrain", v.drivetrain],
                ["Engine", v.engine],
                ["Mileage", `${num(v.mileage)} mi`],
                ["Distance", `${v.distance_mi} mi away`],
              ].map(([k, val]) => (
                <div key={k} className="rounded-xl border border-[#233044] bg-[#111827] p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-500">{k}</p>
                  <p className="dd-num mt-1 text-sm text-slate-100">{val}</p>
                </div>
              ))}
            </div>
            <h3 className="mt-8 font-heading text-lg font-semibold">Key features</h3>
            <div className="mt-3 flex flex-wrap gap-2" data-testid="vehicle-detail-features">
              {v.features.map((f) => (
                <span key={f} className="rounded-lg border border-[#233044] bg-[#0D1524] px-3 py-1.5 text-sm text-slate-300">
                  {f}
                </span>
              ))}
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-[#233044] bg-[#111827] p-6 lg:sticky lg:top-24">
            <h1 className="font-heading text-2xl font-semibold" data-testid="vehicle-detail-title">
              {v.year} {v.make} {v.model}
            </h1>
            <p className="text-slate-400">{v.trim}</p>
            <p className="dd-num mt-5 text-4xl font-semibold text-white" data-testid="vehicle-detail-price">
              {money(v.price)}
            </p>
            <p className="dd-num mt-1 text-sm text-slate-500">MSRP {money(v.msrp)}</p>
            <p className="mt-1 text-sm text-emerald-400" data-testid="vehicle-detail-incentives">
              {money(v.incentives)} in available incentives
            </p>
            <div className="mt-4 flex gap-4 text-xs text-slate-400">
              <span className="flex items-center gap-1"><Gauge className="size-3" /> {num(v.mileage)} mi</span>
              <span className="flex items-center gap-1"><MapPin className="size-3" /> {v.distance_mi} mi</span>
            </div>
            <Button
              size="lg"
              className="mt-6 w-full"
              data-testid="vehicle-detail-build-deal"
              disabled={buildDeal.isPending}
              onClick={() => buildDeal.mutate()}
            >
              Build Deal
            </Button>
            <p className="mt-4 text-xs text-slate-500">
              {v.dealer_name} · {v.dealer_address}
            </p>
          </aside>
        </div>
      )}
    </Shell>
  );
}
