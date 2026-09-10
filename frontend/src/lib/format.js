export const money = (n) =>
  (n < 0 ? "-$" : "$") + Math.abs(Math.round(Number(n) || 0)).toLocaleString("en-US");

export const num = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");

export const STATUS_LABELS = {
  building: "Building Deal",
  pending_ai: "AI Negotiating",
  customer_countered: "Dealer Countered",
  manager_review: "Manager Review",
  accepted: "Accepted",
  declined: "Declined",
  closed: "Closed / Scheduled",
};

export const statusTone = (s) =>
  s === "accepted" || s === "closed"
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
    : s === "declined"
      ? "border-red-500/40 bg-red-500/10 text-red-300"
      : s === "manager_review"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
        : "border-sky-500/40 bg-sky-500/10 text-sky-300";
