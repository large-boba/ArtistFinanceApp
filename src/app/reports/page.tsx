import type { Metadata } from "next";
import ComingLater from "@/components/ComingLater";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <ComingLater title="Reports" stage={5}>
      Profit, sales and spending summaries will appear here.
    </ComingLater>
  );
}
