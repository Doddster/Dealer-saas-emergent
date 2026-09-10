import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shell } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import { money } from "@/lib/format";

const FIELDS = [
  ["ai_discount_authority", "AI Automatic Discount Authority ($)", "Max discount the AI can approve without a human."],
  ["manager_threshold", "Manager Approval Threshold ($)", "Discounts above this route to manager review."],
  ["hard_floor", "Hard Floor ($)", "Absolute minimum selling price."],
  ["max_deviation_pct", "Max Customer Offer Deviation (%)", "Offers further below advertised are auto-countered."],
];

export default function DealerSettings() {
  const qc = useQueryClient();
  const { data: rules, isError } = useQuery({ queryKey: ["dealer-rules"], queryFn: () => apiGet("/dealer/rules") });
  const { data: overrides } = useQuery({ queryKey: ["overrides"], queryFn: () => apiGet("/dealer/overrides") });
  const { data: inventory } = useQuery({ queryKey: ["vehicles", ""], queryFn: () => apiGet("/vehicles/search?q=") });

  const [form, setForm] = useState(null);
  useEffect(() => {
    if (rules && !form) {
      setForm({
        ai_discount_authority: String(rules.ai_discount_authority),
        manager_threshold: String(rules.manager_threshold),
        hard_floor: String(rules.hard_floor ?? ""),
        max_deviation_pct: String(rules.max_deviation_pct),
      });
    }
  }, [rules, form]);

  const [ovVin, setOvVin] = useState("");
  const [ovForm, setOvForm] = useState({ ai_discount_authority: "", manager_threshold: "", hard_floor: "", max_deviation_pct: "" });

  const saveRules = useMutation({
    mutationFn: () =>
      apiPut("/dealer/rules", {
        ai_discount_authority: Number(form.ai_discount_authority),
        manager_threshold: Number(form.manager_threshold),
        hard_floor: form.hard_floor === "" ? null : Number(form.hard_floor),
        max_deviation_pct: Number(form.max_deviation_pct),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dealer-rules"] });
      toast.success("Dealership negotiation rules saved.");
    },
    onError: () => toast.error("Could not save rules."),
  });

  const saveOverride = useMutation({
    mutationFn: () => {
      const v = (inventory?.results ?? []).find((x) => x.vin === ovVin);
      return apiPut(`/dealer/overrides/${ovVin}`, {
        vin: ovVin,
        label: v ? `${v.year} ${v.make} ${v.model} ${v.trim}` : ovVin,
        ai_discount_authority: ovForm.ai_discount_authority === "" ? null : Number(ovForm.ai_discount_authority),
        manager_threshold: ovForm.manager_threshold === "" ? null : Number(ovForm.manager_threshold),
        hard_floor: ovForm.hard_floor === "" ? null : Number(ovForm.hard_floor),
        max_deviation_pct: ovForm.max_deviation_pct === "" ? null : Number(ovForm.max_deviation_pct),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overrides"] });
      toast.success("VIN override saved.");
    },
    onError: () => toast.error("Pick a vehicle and enter at least one value."),
  });

  const removeOverride = useMutation({
    mutationFn: (vin) => apiDelete(`/dealer/overrides/${vin}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overrides"] });
      toast.success("Override removed.");
    },
    onError: () => toast.error("Could not remove override."),
  });

  const vehicles = inventory?.results ?? [];
  const vinLabel = (vin) => {
    const v = vehicles.find((x) => x.vin === vin);
    return v ? `${v.year} ${v.make} ${v.model} ${v.trim}` : vin;
  };

  return (
    <Shell>
      <h1 className="font-heading text-3xl font-semibold">Dealer Settings</h1>
      <p className="mt-1 text-slate-400">Default negotiation rules the AI desk follows. Customers never see these.</p>

      {isError && <p className="mt-6 text-sm text-slate-500" data-testid="settings-error">Settings are unavailable right now.</p>}

      <section className="mt-8 rounded-2xl border border-[#233044] bg-[#111827] p-6" data-testid="dealership-rules-form">
        <h2 className="font-heading text-lg font-semibold">Dealership defaults</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {FIELDS.map(([key, label, hint]) => (
            <div key={key}>
              <Label className="mb-1.5 block text-sm">{label}</Label>
              <Input
                data-testid={`rule-${key.replace(/_/g, "-")}-input`}
                value={form?.[key] ?? ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500">{hint}</p>
            </div>
          ))}
        </div>
        <Button className="mt-6" data-testid="save-rules-btn" disabled={!form || saveRules.isPending} onClick={() => saveRules.mutate()}>
          Save Dealership Rules
        </Button>
      </section>

      <section className="mt-8 rounded-2xl border border-[#233044] bg-[#111827] p-6">
        <h2 className="font-heading text-lg font-semibold">Vehicle / VIN overrides</h2>
        <p className="text-sm text-slate-400">Tighten or loosen rules on a specific unit. Overrides win over dealership defaults.</p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label className="mb-1.5 block text-xs">Vehicle</Label>
            <Select value={ovVin} onValueChange={setOvVin}>
              <SelectTrigger data-testid="override-vin-select" className="w-full">
                <SelectValue>{(v) => (v ? vinLabel(v) : "Select a vehicle")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.vin} value={v.vin} data-testid={`override-vin-option-${v.vin}`}>
                    {v.year} {v.make} {v.model} {v.trim}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">AI Authority ($)</Label>
            <Input data-testid="override-ai-authority-input" value={ovForm.ai_discount_authority} onChange={(e) => setOvForm({ ...ovForm, ai_discount_authority: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Hard Floor ($)</Label>
            <Input data-testid="override-hard-floor-input" value={ovForm.hard_floor} onChange={(e) => setOvForm({ ...ovForm, hard_floor: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs">Max Deviation (%)</Label>
            <Input data-testid="override-max-deviation-input" value={ovForm.max_deviation_pct} onChange={(e) => setOvForm({ ...ovForm, max_deviation_pct: e.target.value })} />
          </div>
        </div>
        <Button className="mt-5" variant="outline" data-testid="save-override-btn" disabled={!ovVin || saveOverride.isPending} onClick={() => saveOverride.mutate()}>
          Save VIN Override
        </Button>

        <div className="mt-6 space-y-3" data-testid="override-list">
          {(overrides ?? []).length === 0 && <p className="text-sm text-slate-500" data-testid="override-empty">No VIN overrides yet.</p>}
          {(overrides ?? []).map((o, i) => (
            <div key={o.vin} className="flex flex-wrap items-center gap-4 rounded-xl border border-[#233044] bg-[#0D1524] p-4" data-testid={`override-row-${i}`}>
              <div className="min-w-[220px] flex-1">
                <p className="text-sm font-medium">{o.label || vinLabel(o.vin)}</p>
                <p className="dd-num text-xs text-slate-500">{o.vin}</p>
              </div>
              <p className="dd-num text-xs text-slate-400">
                AI {o.ai_discount_authority != null ? money(o.ai_discount_authority) : "—"} · Floor{" "}
                {o.hard_floor != null ? money(o.hard_floor) : "—"} · Dev{" "}
                {o.max_deviation_pct != null ? `${o.max_deviation_pct}%` : "—"}
              </p>
              <Button size="sm" variant="ghost" data-testid={`remove-override-btn-${i}`} onClick={() => removeOverride.mutate(o.vin)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
