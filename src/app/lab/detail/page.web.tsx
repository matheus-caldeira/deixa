import { Suspense } from "react";
import { LabDetailScreen } from "@/ui/web-lab/lab-screen";

export default function LabDetailPage() {
  return (
    <Suspense>
      <LabDetailScreen />
    </Suspense>
  );
}
