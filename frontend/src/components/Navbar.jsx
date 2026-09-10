import { Link, useLocation, useNavigate } from "react-router-dom";
import { Car, Gauge, Settings, Store, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

const CONSUMER_LINKS = [
  { to: "/", label: "Shop", icon: Car, testid: "nav-shop" },
  { to: "/garage", label: "My Garage", icon: Warehouse, testid: "nav-garage" },
];

const DEALER_LINKS = [
  { to: "/dealer", label: "Deals", icon: Gauge, testid: "nav-dealer-deals" },
  { to: "/dealer/settings", label: "Settings", icon: Settings, testid: "nav-dealer-settings" },
];

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDealer = pathname.startsWith("/dealer");
  const links = isDealer ? DEALER_LINKS : CONSUMER_LINKS;

  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[#233044] bg-[#0B0F17]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link to={isDealer ? "/dealer" : "/"} className="flex items-center gap-2" data-testid="brand-logo">
          <span className="grid size-8 place-items-center rounded-lg bg-[#FF5722] text-white">
            <Car className="size-4" />
          </span>
          <span className="font-heading text-lg font-semibold tracking-tight">DealDrive</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              data-testid={l.testid}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                pathname === l.to ? "bg-[#1E293B] text-white" : "text-slate-400 hover:text-white",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center rounded-xl border border-[#233044] bg-[#111827] p-1">
          <button
            type="button"
            data-testid="role-switcher-consumer"
            onClick={() => navigate("/")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              !isDealer ? "bg-[#FF5722] text-white" : "text-slate-400 hover:text-white",
            )}
          >
            <Car className="size-3.5" /> Consumer
          </button>
          <button
            type="button"
            data-testid="role-switcher-dealer"
            onClick={() => navigate("/dealer")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              isDealer ? "bg-[#FF5722] text-white" : "text-slate-400 hover:text-white",
            )}
          >
            <Store className="size-3.5" /> Dealer
          </button>
        </div>
      </div>
    </header>
  );
}

export function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
