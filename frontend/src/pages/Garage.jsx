import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RefreshCw, Gauge, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { money, num } from "@/lib/format";

function MileageDialog({ vehicle, onSave, index }) {
  const [open, setOpen] = useState(false);
  const [mileage, setMileage] = useState(String(vehicle.mileage));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" data-testid={`update-mileage-btn-${index}`} />}
      >
        <Gauge className="size-4" /> Update Mileage
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update mileage</DialogTitle>
        </DialogHeader>
        <Label className="mb-1.5 block text-xs">Current odometer</Label>
        <Input data-testid="mileage-dialog-input" value={mileage} onChange={(e) => setMileage(e.target.value)} />
        <DialogFooter>
          <Button
            data-testid="mileage-dialog-save"
            onClick={() => {
              onSave(Number(mileage));
              setOpen(false);
            }}
          >
            Save &amp; Revalue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Garage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isError } = useQuery({ queryKey: ["garage"], queryFn: () => apiGet("/garage") });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["garage"] });

  const setMileage = useMutation({
    mutationFn: ({ id, mileage }) => apiPatch(`/garage/${id}/mileage`, { mileage }),
    onSuccess: () => {
      invalidate();
      toast.success("Mileage updated and value revalued.");
    },
    onError: () => toast.error("Could not update mileage."),
  });

  const refresh = useMutation({
    mutationFn: (id) => apiPost(`/garage/${id}/refresh`),
    onSuccess: () => {
      invalidate();
      toast.success("Estimated value refreshed.");
    },
    onError: () => toast.error("Could not refresh value."),
  });

  const vehicles = data ?? [];

  return (
    <Shell>
      <h1 className="font-heading text-3xl font-semibold">My Garage</h1>
      <p className="mt-1 text-slate-400">Track value, payoff, and equity on every vehicle you own.</p>

      {isError && <p className="mt-6 text-sm text-slate-500" data-testid="garage-error">Your garage is unavailable right now.</p>}
      {!isError && vehicles.length === 0 && (
        <p className="mt-6 text-sm text-slate-500" data-testid="garage-empty">
          No vehicles yet — complete a deal and it will land here.
        </p>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {vehicles.map((v, i) => (
          <article
            key={v.id}
            data-testid={`garage-vehicle-${i}`}
            className="dd-rise overflow-hidden rounded-2xl border border-[#233044] bg-[#111827]"
          >
            <div className="flex gap-4 p-5">
              {v.image && <img src={v.image} alt="" className="h-24 w-36 shrink-0 rounded-lg object-cover" />}
              <div>
                <h2 className="font-heading text-lg font-semibold" data-testid={`garage-title-${i}`}>
                  {v.year} {v.make} {v.model}
                </h2>
                <p className="text-sm text-slate-400">{v.trim}</p>
                <p className="dd-num mt-1 text-xs text-slate-500" data-testid={`garage-mileage-${i}`}>
                  {num(v.mileage)} mi · VIN {v.vin}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px border-y border-[#233044] bg-[#233044]">
              <div className="bg-[#0D1524] p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Est. Value</p>
                <p className="dd-num mt-1 font-semibold text-white" data-testid={`garage-value-${i}`}>
                  {money(v.estimated_value)}
                </p>
              </div>
              <div className="bg-[#0D1524] p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Est. Payoff</p>
                <p className="dd-num mt-1 font-semibold text-white" data-testid={`garage-payoff-${i}`}>
                  {money(v.payoff)}
                </p>
              </div>
              <div className="bg-[#0D1524] p-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Est. Equity</p>
                <p
                  className={`dd-num mt-1 font-semibold ${v.equity >= 0 ? "text-emerald-400" : "text-red-400"}`}
                  data-testid={`garage-equity-${i}`}
                >
                  {money(v.equity)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 p-5">
              <MileageDialog
                vehicle={v}
                index={i}
                onSave={(mileage) => setMileage.mutate({ id: v.id, mileage })}
              />
              <Button variant="outline" size="sm" data-testid={`refresh-value-btn-${i}`} onClick={() => refresh.mutate(v.id)}>
                <RefreshCw className="size-4" /> Refresh Value
              </Button>
              <Button
                size="sm"
                data-testid={`shop-with-vehicle-btn-${i}`}
                onClick={() => navigate(`/?equity=${Math.round(v.equity)}`)}
              >
                <ShoppingBag className="size-4" /> Shop With This Vehicle
              </Button>
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}
