import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import VehicleDetail from "@/pages/VehicleDetail";
import BuildDeal from "@/pages/BuildDeal";
import Negotiate from "@/pages/Negotiate";
import Garage from "@/pages/Garage";
import Compare from "@/pages/Compare";
import DealerDashboard from "@/pages/DealerDashboard";
import DealerDeal from "@/pages/DealerDeal";
import DealerSettings from "@/pages/DealerSettings";
import MyDeals from "@/pages/MyDeals";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.jsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/vehicle/:vehicleId" element={<VehicleDetail />} />
        <Route path="/deal/:dealId" element={<BuildDeal />} />
        <Route path="/negotiate/:dealId" element={<Negotiate />} />
        <Route path="/garage" element={<Garage />} />
        <Route path="/deals" element={<MyDeals />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/dealer" element={<DealerDashboard />} />
        <Route path="/dealer/deals/:dealId" element={<DealerDeal />} />
        <Route path="/dealer/settings" element={<DealerSettings />} />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </>
  );
}
