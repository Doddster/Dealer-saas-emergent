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
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
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
  const [scopeLevel, setScopeLevel] = useState("condition");
  const [scopeCondition, setScopeCondition] = useState("used");
  const [scopeMake, setScopeMake] = useState("");
  const [scopeModel, setScopeModel] = useState("");
  const [scopeTrim, setScopeTrim] = useState("");
  const [scopeForm, setScopeForm] = useState({
    ai_discount_authority: "",
    manager_threshold: "",
    hard_floor: "",
    max_deviation_pct: "",
  });
  const [simVin, setSimVin] = useState("");
  const [simOffer, setSimOffer] = useState("");
  const [simResult, setSimResult] = useState(null);

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
const saveScopedRule = useMutation({
  mutationFn: () => {
    let ruleId;

    if (scopeLevel === "condition") {
      ruleId = `condition-${scopeCondition}`;
    } else if (scopeLevel === "model") {
      ruleId = `model-${scopeMake}-${scopeModel}`;
    } else {
      ruleId = `trim-${scopeMake}-${scopeModel}-${scopeTrim}`;
    }

    ruleId = ruleId
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return apiPut(`/dealer/scoped-rules/${ruleId}`, {
      id: ruleId,
      level: scopeLevel,
      condition: scopeLevel === "condition" ? scopeCondition : null,
      make: scopeLevel === "model" || scopeLevel === "trim" ? scopeMake : null,
      model: scopeLevel === "model" || scopeLevel === "trim" ? scopeModel : null,
      trim: scopeLevel === "trim" ? scopeTrim : null,
      ai_discount_authority:
        scopeForm.ai_discount_authority === ""
          ? null
          : Number(scopeForm.ai_discount_authority),
      manager_threshold:
        scopeForm.manager_threshold === ""
          ? null
          : Number(scopeForm.manager_threshold),
      hard_floor:
        scopeForm.hard_floor === ""
          ? null
          : Number(scopeForm.hard_floor),
      max_deviation_pct:
        scopeForm.max_deviation_pct === ""
          ? null
          : Number(scopeForm.max_deviation_pct),
    });
  },

  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["scoped-rules"] });
    toast.success("Scoped negotiation rule saved.");
  },

  onError: () => {
    toast.error("Could not save scoped rule.");
  },
});

const removeScopedRule = useMutation({
  mutationFn: (ruleId) => apiDelete(`/dealer/scoped-rules/${ruleId}`),

  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["scoped-rules"] });
    toast.success("Scoped rule removed.");
  },

  onError: () => {
    toast.error("Could not remove scoped rule.");
  },
});


  const removeOverride = useMutation({
    mutationFn: (vin) => apiDelete(`/dealer/overrides/${vin}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["overrides"] });
      toast.success("Override removed.");
    },
    onError: () => toast.error("Could not remove override."),
  });
  
  const { data: scopedRules } = useQuery({
  queryKey: ["scoped-rules"],
  queryFn: () => apiGet("/dealer/scoped-rules"),
});

  const vehicles = inventory?.results ?? [];
  const vinLabel = (vin) => {
    const v = vehicles.find((x) => x.vin === vin);
    return v ? `${v.year} ${v.make} ${v.model} ${v.trim}` : vin;
  };

  const runSimulation = useMutation({
    mutationFn: () =>
      apiPost("/dealer/simulate", {
        vin: simVin,
        offer: Number(simOffer),
      }),
    onSuccess: (data) => {
      setSimResult(data);
    },
    onError: () => {
      setSimResult(null);
      toast.error("Could not run simulation.");
    },
  });

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
  <h2 className="font-heading text-lg font-semibold">Scoped negotiation rules</h2>
  <p className="mt-1 text-sm text-slate-400">
    Override dealership defaults by inventory type, model, or trim.
  </p>

  <div className="mt-5 grid gap-4 md:grid-cols-4">
    <div>
      <Label className="mb-1.5 block text-xs">Rule level</Label>
      <Select
        value={scopeLevel}
        onValueChange={(value) => {
          setScopeLevel(value);
          setScopeMake("");
          setScopeModel("");
          setScopeTrim("");
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="condition">New / Used</SelectItem>
          <SelectItem value="model">Model</SelectItem>
          <SelectItem value="trim">Trim</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {scopeLevel === "condition" && (
      <div>
        <Label className="mb-1.5 block text-xs">Inventory type</Label>
        <Select value={scopeCondition} onValueChange={setScopeCondition}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="used">Used</SelectItem>
          </SelectContent>
        </Select>
      </div>
    )}

    {(scopeLevel === "model" || scopeLevel === "trim") && (
      <>
        <div>
          <Label className="mb-1.5 block text-xs">Make</Label>
          <Select
            value={scopeMake}
            onValueChange={(value) => {
              setScopeMake(value);
              setScopeModel("");
              setScopeTrim("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select make" />
            </SelectTrigger>
            <SelectContent>
              {[...new Set(vehicles.map((v) => v.make))].map((make) => (
                <SelectItem key={make} value={make}>
                  {make}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block text-xs">Model</Label>
          <Select
            value={scopeModel}
            onValueChange={(value) => {
              setScopeModel(value);
              setScopeTrim("");
            }}
            disabled={!scopeMake}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              {[
                ...new Set(
                  vehicles
                    .filter((v) => v.make === scopeMake)
                    .map((v) => v.model),
                ),
              ].map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </>
    )}

    {scopeLevel === "trim" && (
      <div>
        <Label className="mb-1.5 block text-xs">Trim</Label>
        <Select
          value={scopeTrim}
          onValueChange={setScopeTrim}
          disabled={!scopeModel}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select trim" />
          </SelectTrigger>
          <SelectContent>
            {[
              ...new Set(
                vehicles
                  .filter(
                    (v) =>
                      v.make === scopeMake &&
                      v.model === scopeModel,
                  )
                  .map((v) => v.trim),
              ),
            ].map((trim) => (
              <SelectItem key={trim} value={trim}>
                {trim}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )}
  </div>

  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {FIELDS.map(([key, label]) => (
      <div key={key}>
        <Label className="mb-1.5 block text-xs">{label}</Label>
        <Input
          value={scopeForm[key]}
          onChange={(e) =>
            setScopeForm({
              ...scopeForm,
              [key]: e.target.value,
            })
          }
          placeholder="Inherit"
        />
      </div>
    ))}
  </div>

  <Button
    className="mt-5"
    variant="outline"
    disabled={
      saveScopedRule.isPending ||
      (scopeLevel === "model" && (!scopeMake || !scopeModel)) ||
      (scopeLevel === "trim" &&
        (!scopeMake || !scopeModel || !scopeTrim))
    }
    onClick={() => saveScopedRule.mutate()}
  >
    Save Scoped Rule
  </Button>

  <div className="mt-6 space-y-3">
    {(scopedRules ?? []).length === 0 && (
      <p className="text-sm text-slate-500">
        No scoped rules configured yet.
      </p>
    )}

    {(scopedRules ?? []).map((rule) => (
      <div
        key={rule.id}
        className="rounded-xl border border-[#233044] bg-[#0D1524] p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {rule.level === "condition"
                ? `${rule.condition === "new" ? "New" : "Used"} inventory`
                : rule.level === "model"
                  ? `${rule.make} ${rule.model}`
                  : `${rule.make} ${rule.model} ${rule.trim}`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {rule.level}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
  <p className="dd-num text-xs text-slate-400">
    AI{" "}
    {rule.ai_discount_authority != null
      ? money(rule.ai_discount_authority)
      : "inherit"}
    {" · "}Manager{" "}
    {rule.manager_threshold != null
      ? money(rule.manager_threshold)
      : "inherit"}
    {" · "}Floor{" "}
    {rule.hard_floor != null
      ? money(rule.hard_floor)
      : "inherit"}
    {" · "}Dev{" "}
    {rule.max_deviation_pct != null
      ? `${rule.max_deviation_pct}%`
      : "inherit"}
  </p>

  <Button
    size="sm"
    variant="ghost"
    disabled={removeScopedRule.isPending}
    onClick={() => removeScopedRule.mutate(rule.id)}
  >
    Remove
  </Button>
</div>
        </div>
      </div>
    ))}
  </div>
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
      <section
        className="mt-8 rounded-2xl border border-[#233044] bg-[#111827] p-6"
        data-testid="simulation-mode"
      >
        <h2 className="font-heading text-lg font-semibold">Simulation Mode</h2>

        <p className="mt-1 text-sm text-slate-400">
          Test exactly how DealDrive would respond to a customer offer without creating or changing a real deal.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label className="mb-1.5 block text-xs">Vehicle</Label>

            <Select
              value={simVin}
              onValueChange={(value) => {
                setSimVin(value);
                setSimResult(null);
              }}
            >
              <SelectTrigger className="w-full" data-testid="simulation-vin-select">
                <SelectValue>{(v) => (v ? vinLabel(v) : "Select a vehicle")}</SelectValue>
              </SelectTrigger>

              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.vin} value={v.vin}>
                    {v.year} {v.make} {v.model} {v.trim} — {money(v.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs">Customer Offer ($)</Label>

            <Input
              value={simOffer}
              onChange={(e) => {
                setSimOffer(e.target.value);
                setSimResult(null);
              }}
              placeholder="55000"
              data-testid="simulation-offer-input"
            />
          </div>
        </div>

        <Button
          className="mt-5"
          variant="outline"
          disabled={!simVin || !simOffer || runSimulation.isPending}
          onClick={() => runSimulation.mutate()}
          data-testid="run-simulation-btn"
        >
          {runSimulation.isPending ? "Running..." : "Run Simulation"}
        </Button>

        {simResult && (
          <div className="mt-6 rounded-xl border border-[#233044] bg-[#0D1524] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Simulated result
                </p>

                <p className="mt-1 font-heading text-xl font-semibold">
                  {simResult.decision === "accepted"
                    ? "Accepted"
                    : simResult.decision === "countered"
                      ? "Countered"
                      : "Manager Review"}
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  {simResult.vehicle_label}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-500">Rule source</p>
                <p className="text-sm font-medium">
                  {{
                    dealership_default: "Dealership default",
                    condition_rule: "New / Used rule",
                    model_rule: "Model rule",
                    trim_rule: "Trim rule",
                    vin_override: "VIN override"
                  }[simResult.rule_source] ?? simResult.rule_source}
                </p>
                {simResult.effective_rules?.applied_sources?.length > 0 && (
  <p className="mt-1 max-w-md text-xs text-slate-500">
    {simResult.effective_rules.applied_sources
      .map((source) => {
        if (source === "dealership_default") {
          return "Dealership default";
        }

        if (source.startsWith("condition-")) {
          const condition = source.replace("condition-", "");
          return `${condition.charAt(0).toUpperCase()}${condition.slice(1)} inventory`;
        }

        if (source.startsWith("model-")) {
          return source
            .replace("model-", "")
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
        }

        if (source.startsWith("trim-")) {
          return source
            .replace("trim-", "")
            .split("-")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
        }

        if (source === "vin_override") {
          return "VIN override";
        }

        return source;
      })
      .join(" → ")}
  </p>
)}
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Advertised</p>
                <p className="dd-num font-medium">
                  {money(simResult.advertised_price)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Customer offer</p>
                <p className="dd-num font-medium">{money(simResult.offer)}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Discount requested</p>
                <p className="dd-num font-medium">{money(simResult.discount)}</p>
              </div>

              <div>
                <p className="text-xs text-slate-500">DealDrive counter</p>
                <p className="dd-num font-medium">
                  {simResult.counter_price != null
                    ? money(simResult.counter_price)
                    : "—"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[#233044] p-4">
              <p className="text-xs text-slate-500">Customer-facing response</p>
              <p className="mt-2 text-sm text-slate-200">{simResult.message}</p>
            </div>

            <div className="mt-5 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-slate-500">AI authority: </span>
                <span>{money(simResult.effective_rules.ai_discount_authority)}</span>
              </div>

              <div>
                <span className="text-slate-500">Manager threshold: </span>
                <span>{money(simResult.effective_rules.manager_threshold)}</span>
              </div>

              <div>
                <span className="text-slate-500">Hard floor: </span>
                <span>{money(simResult.effective_rules.hard_floor)}</span>
              </div>

              <div>
                <span className="text-slate-500">Max deviation: </span>
                <span>{simResult.effective_rules.max_deviation_pct}%</span>
              </div>
            </div>
          </div>
        )}
      </section>
    </Shell>
  );
}
