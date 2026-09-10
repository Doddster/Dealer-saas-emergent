import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";

// A deal needs a human when the AI desk has escalated it or a specialist took it over.
export const needsHuman = (d) =>
  !["closed", "declined", "accepted"].includes(d.status) && (d.status === "manager_review" || d.taken_over);

/**
 * Live dealer deal queue. Polls every 8s so the desk sees escalations without a refresh,
 * and toasts once per newly-escalated deal.
 */
export function useDealerAlerts({ notify = false } = {}) {
  const query = useQuery({
    queryKey: ["deals"],
    queryFn: () => apiGet("/deals"),
    refetchInterval: 8000,
    refetchIntervalInBackground: true,
  });

  const deals = query.data ?? [];
  const alerts = deals.filter(needsHuman);

  const seen = useRef(null);
  useEffect(() => {
    if (!notify || !query.data) return;
    const ids = new Set(alerts.map((d) => d.id));
    if (seen.current === null) {
      seen.current = ids; // first load: adopt current state without toasting history
      return;
    }
    const fresh = alerts.filter((d) => !seen.current.has(d.id));
    fresh.forEach((d) =>
      toast.warning(`${d.customer_name} needs a human on the ${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`, {
        description: d.latest_offer ? `Customer offer $${Math.round(d.latest_offer).toLocaleString()}` : "Awaiting desk review",
      }),
    );
    seen.current = ids;
  }, [alerts, notify, query.data]);

  return { ...query, deals, alerts };
}
