import type { Metadata } from "next";
import ComingLater from "@/components/ComingLater";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <ComingLater title="Settings" stage={2}>
      Your currency, country and tax settings will live here.
    </ComingLater>
  );
}
