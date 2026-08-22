import { useOutletContext } from "react-router-dom";
import Reports from "@/pages/Reports";
import ArabicReports from "@/pages/ArabicReports";
export default function ReportsSectionPage() { const { schoolSection } = useOutletContext(); return schoolSection === "arabic" ? <ArabicReports /> : <Reports />; }
