import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarCheck, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Shell } from "@/components/Navbar";
import DealSummary from "@/components/DealSummary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost } from "@/lib/api";
import { money, STATUS_LABELS, statusTone } from "@/lib/format";

const TIMES = ["9:00 AM", "11:30 AM", "1:00 PM", "3:30 PM", "5:00 PM"];

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Negotiate() {
  const { dealId } = useParams();
  const qc = useQueryClient();
  const [counter, setCounter] = useState("");
  const [date, setDate] = useState(tomorrowIso());
  const [time, setTime] = useState(TIMES[1]);

  const { data: deal, isError } = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => apiGet(`/deals/${dealId}`),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["deal", dealId] });
    qc.invalidateQueries({ queryKey: ["deals"] });
    qc.invalidateQueries({ queryKey: ["garage"] });
  };

  const act = useMutation({
    mutationFn: ({ path, body }) => apiPost(`/deals/${dealId}/${path}`, body),
    onSuccess: invalidate,
    onError: (e) => toast.error(e?.body?.detail ?? "That action failed. Try again."),
  });

  const book = useMutation({
    mutationFn: () => apiPost(`/deals/${dealId}/appointment`, { date, time, type: "Test Drive & Delivery" }),
    onSuccess: () => {
      invalidate();
      toast.success("Appointment confirmed — vehicle added to My Garage.");
    },
    onError: () => toast.error("Could not book that appointment."),
  });

  const status = deal?.status;
  const isOpen = deal && !["accepted", "declined", "closed"].includes(status);

  return (
    <Shell>
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white" data-testid="negotiate-back">
        <ArrowLeft className="size-4" /> Back to shopping
      </Link>

      {isError && <p className="text-sm text-slate-500" data-testid="negotiate-error">This negotiation is unavailable right now.</p>}

      {deal && (
        <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl font-semibold" data-testid="negotiate-title">
                Negotiating {deal.vehicle.year} {deal.vehicle.make} {deal.vehicle.model}
              </h1>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone(status)}`} data-testid="deal-status-badge">
                {STATUS_LABELS[status] ?? status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">Advertised {money(deal.vehicle.price)} · VIN {deal.vehicle.vin}</p>

            <div className="mt-6 space-y-3 rounded-2xl border border-[#233044] bg-[#0F172A] p-5" data-testid="negotiation-thread">
              {deal.messages.length === 0 && <p className="text-sm text-slate-500">No messages yet.</p>}
              {deal.messages.map((m, i) => (
                <div
                  key={m.id}
                  data-testid={`message-${i}`}
                  className={`dd-rise max-w-[85%] rounded-xl border px-4 py-3 text-sm ${
                    m.sender === "customer"
                      ? "ml-auto border-[#FF5722]/40 bg-[#2A1810] text-orange-100"
                      : m.sender === "dealer"
                        ? "border-[#233044] bg-[#161F30] text-slate-100"
                        : "mx-auto border-[#233044] bg-transparent text-center text-xs text-slate-500"
                  }`}
                >
                  <p className="mb-0.5 text-[11px] uppercase tracking-wider opacity-60">
                    {m.sender === "customer" ? "You" : m.sender === "dealer" ? `${deal.vehicle.dealer_name} · AI Desk` : "System"}
                  </p>
                  {m.text}
                </div>
              ))}
            </div>

            {status === "declined" && (
              <p className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300" data-testid="deal-declined-notice">
                This deal was declined. You can start a new deal on any vehicle.
              </p>
            )}

            {isOpen && (
              <div className="mt-6 rounded-2xl border border-[#233044] bg-[#111827] p-5" data-testid="negotiation-actions">
                {deal.latest_counter != null && (
                  <p className="mb-4 text-sm text-slate-300">
                    Dealer counteroffer:{" "}
                    <span className="dd-num font-semibold text-white" data-testid="latest-counter-amount">
                      {money(deal.latest_counter)}
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-3">
                  <Button
                    data-testid="accept-counter-btn"
                    disabled={deal.latest_counter == null || act.isPending}
                    onClick={() => act.mutate({ path: "accept-counter", body: {} })}
                  >
                    Accept {deal.latest_counter != null ? money(deal.latest_counter) : "Offer"}
                  </Button>
                  <div>
                    <Label className="mb-1.5 block text-xs">Counter amount</Label>
                    <div className="flex gap-2">
                      <Input
                        data-testid="counter-amount-input"
                        className="w-36"
                        value={counter}
                        onChange={(e) => setCounter(e.target.value)}
                        placeholder="65000"
                      />
                      <Button
                        variant="outline"
                        data-testid="counter-offer-btn"
                        disabled={!counter || act.isPending}
                        onClick={() => {
                          act.mutate({ path: "offer", body: { amount: Number(counter), down_payment: deal.down_payment } });
                          setCounter("");
                        }}
                      >
                        Counter
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    data-testid="decline-deal-btn"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ path: "decline", body: {} })}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {status === "accepted" && (
              <div className="mt-6 dd-rise rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6" data-testid="deal-accepted-panel">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="size-5" />
                  <h2 className="font-heading text-xl font-semibold">Deal Accepted</h2>
                </div>
                <p className="dd-num mt-2 text-sm text-emerald-200" data-testid="agreed-price">
                  Agreed selling price {money(deal.agreed_price ?? deal.selling_price)} · Amount due {money(deal.breakdown.amount_due)}
                </p>

                <h3 className="mt-6 font-heading text-base font-semibold text-white">Schedule your appointment</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="mb-1.5 block text-xs">Date</Label>
                    <Input type="date" data-testid="appointment-date-input" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs">Time</Label>
                    <div className="flex flex-wrap gap-2">
                      {TIMES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          data-testid={`appointment-time-${t.replace(/[:\s]/g, "")}`}
                          onClick={() => setTime(t)}
                          className={`rounded-lg border px-3 py-1.5 text-xs transition-colors duration-150 ${
                            time === t ? "border-[#FF5722] bg-[#FF5722] text-white" : "border-[#233044] bg-[#0D1524] text-slate-300"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                  <MapPin className="size-3" /> {deal.vehicle.dealer_name} · {deal.vehicle.dealer_address}
                </p>
                <Button className="mt-5" data-testid="book-appointment-btn" disabled={book.isPending} onClick={() => book.mutate()}>
                  <CalendarCheck className="size-4" /> Confirm Appointment
                </Button>
              </div>
            )}

            {status === "closed" && (
              <div className="mt-6 dd-rise rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-6" data-testid="appointment-confirmed-panel">
                <h2 className="font-heading text-xl font-semibold text-emerald-300">You&apos;re all set</h2>
                <p className="mt-2 text-sm text-emerald-200" data-testid="appointment-details">
                  {deal.appointment?.type} on {deal.appointment?.date} at {deal.appointment?.time} — {deal.appointment?.location}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  Your specialist at {deal.vehicle.dealer_name} will take it from here.
                </p>
                <Link to="/garage" className="mt-4 inline-block" data-testid="go-to-garage-link">
                  <Button variant="outline">View in My Garage</Button>
                </Link>
              </div>
            )}
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <DealSummary breakdown={deal.breakdown} />
          </aside>
        </div>
      )}
    </Shell>
  );
}
