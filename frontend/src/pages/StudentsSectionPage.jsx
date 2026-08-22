import { useOutletContext } from "react-router-dom";
import Students from "@/pages/Students";
import ArabicStudents from "@/pages/ArabicStudents";

export default function StudentsSectionPage() {
  const { schoolSection } = useOutletContext();
  return schoolSection === "arabic" ? <ArabicStudents /> : <Students />;
}
