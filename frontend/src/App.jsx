import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Report from "./pages/Report";
import Dashboard from "./pages/Dashboard";
import MapPage from "./pages/MapPage";
import Analytics from "./pages/Analytics";
import CaseDetails from "./pages/CaseDetails";
import ResponderDashboard from "./pages/ResponderDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PUBLIC USER */}
        <Route path="/" element={<Home />} />
        <Route path="/report" element={<Report />} />

        {/* EXISTING RESCUE COMMAND DASHBOARD */}
        <Route
          path="/dashboard"
          element={<Dashboard />}
        />

        {/* EXISTING PAGES */}
        <Route
          path="/map"
          element={<MapPage />}
        />

        <Route
          path="/analytics"
          element={<Analytics />}
        />

        {/* EXISTING CASE DETAILS */}
        <Route
          path="/case/:caseId"
          element={<CaseDetails />}
        />

        {/* NGO / RESPONDER */}
        <Route
          path="/responder-dashboard"
          element={<ResponderDashboard />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;