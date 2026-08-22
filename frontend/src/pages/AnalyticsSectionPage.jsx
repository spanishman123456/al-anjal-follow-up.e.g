import { useOutletContext } from "react-router-dom";
import Analytics from "@/pages/Analytics";
import ArabicAnalytics from "@/pages/ArabicAnalytics";
export default function AnalyticsSectionPage() { const { schoolSection } = useOutletContext(); return schoolSection === "arabic" ? <ArabicAnalytics /> : <Analytics />; }
