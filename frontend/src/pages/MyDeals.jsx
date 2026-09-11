import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowRight, Car, MessageSquare } from "lucide-react";

import { Shell } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { money, STATUS_LABELS, statusTone } from "@/lib/format";

export default function MyDeals() {
  const {
    data: deals,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["deals"],
    queryFn: () => apiGet("/deals"),
    refetchInterval: 5000,
  });

  const savedDeals = deals ?? [];

  const destinationFor = (deal) => {
    if (deal.status === "building") {
      return `/deal/${deal.id}`;
    }

    return `/negotiate/${deal.id}`;
  };

  const actionLabelFor = (deal) => {
    if (deal.status === "building") {
      return "Continue Building";
    }

    if (deal.status === "customer_countered") {
      return "Review Counter";
    }

    if (deal.status === "manager_review") {
      return "View Deal";
    }

    if (deal.status === "accepted") {
      return "Finish Deal";
    }

    if (deal.status === "closed") {
      return "View Deal";
    }

    return "Resume Deal";
  };

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold">My Deals</h1>
          <p className="mt-1 text-slate-400">
            Your saved deals, offers, dealer counters, and completed negotiations.
          </p>
        </div>

        <Link to="/">
          <Button variant="outline">Shop Vehicles</Button>
        </Link>
      </div>

      {isLoading && (
        <p className="mt-8 text-sm text-slate-500">Loading your deals...</p>
      )}

      {isError && (
        <p className="mt-8 text-sm text-red-300">
          Your saved deals are unavailable right now.
        </p>
      )}

      {!isLoading && !isError && savedDeals.length === 0 && (
        <div className="mt-8 rounded-2xl border border-[#233044] bg-[#111827] p-8 text-center">
          <Car className="mx-auto size-8 text-slate-500" />
          <h2 className="mt-4 font-heading text-xl font-semibold">
            No saved deals yet
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Start shopping and build a deal. It will automatically appear here.
          </p>

          <Link to="/" className="mt-5 inline-block">
            <Button>Start Shopping</Button>
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-5">
        {savedDeals.map((deal) => (
          <div
            key={deal.id}
            className="rounded-2xl border border-[#233044] bg-[#111827] p-5"
            data-testid={`saved-deal-${deal.id}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex min-w-0 gap-4">
                {deal.vehicle.image ? (
                  <img
                    src={deal.vehicle.image}
                    alt=""
                    className="h-24 w-32 rounded-xl object-cover"
                  />
                ) : (
                  <div className="grid h-24 w-32 place-items-center rounded-xl bg-[#0D1524]">
                    <Car className="size-6 text-slate-500" />
                  </div>
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg font-semibold">
                      {deal.vehicle.year} {deal.vehicle.make}{" "}
                      {deal.vehicle.model} {deal.vehicle.trim}
                    </h2>

                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(
                        deal.status,
                      )}`}
                    >
                      {STATUS_LABELS[deal.status] ?? deal.status}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-400">
                    {deal.vehicle.dealer_name}
                  </p>

                  <p className="dd-num mt-1 text-xs text-slate-500">
                    VIN {deal.vehicle.vin}
                  </p>
                </div>
              </div>

              <Link to={destinationFor(deal)}>
                <Button>
                  {actionLabelFor(deal)}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-5 grid gap-4 border-t border-[#233044] pt-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Advertised price</p>
                <p className="dd-num mt-1 font-medium">
                  {money(deal.vehicle.price)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Your latest offer</p>
                <p className="dd-num mt-1 font-medium">
                  {deal.latest_offer != null
                    ? money(deal.latest_offer)
                    : "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">Dealer counter</p>
                <p className="dd-num mt-1 font-medium">
                  {deal.latest_counter != null
                    ? money(deal.latest_counter)
                    : "—"}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  {deal.agreed_price != null ? "Agreed price" : "Deal price"}
                </p>
                <p className="dd-num mt-1 font-medium">
                  {money(deal.agreed_price ?? deal.selling_price)}
                </p>
              </div>
            </div>

            {deal.messages?.length > 0 && (
              <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                <MessageSquare className="size-3.5" />
                {deal.messages.length} negotiation{" "}
                {deal.messages.length === 1 ? "message" : "messages"}
              </div>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}
