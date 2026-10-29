import type { Metadata } from "next";
import AddButton from "@/components/AddButton";
import StreamsList from "@/components/StreamsList";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Income" };

// The heading, "+ Add" directly under it, then the seven income streams. The
// list is a client component because the figures come from the entries the
// artist has added on this device.
export default function IncomePage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Income</h1>
      <AddButton />
      <StreamsList />
    </>
  );
}
