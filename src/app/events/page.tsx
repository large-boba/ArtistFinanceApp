import type { Metadata } from "next";
import ComingLater from "@/components/ComingLater";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <ComingLater title="Events" stage={4}>
      Your markets, fairs and shows will be listed here, with the profit from each.
    </ComingLater>
  );
}
