import { useOutletContext } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import ArabicDashboard from "@/pages/ArabicDashboard";
export default function DashboardSectionPage() { const { schoolSection } = useOutletContext(); return schoolSection === "arabic" ? <ArabicDashboard /> : <Dashboard />; }
