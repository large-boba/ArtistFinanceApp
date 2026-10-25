import type { Metadata } from "next";
import QuickSale from "@/components/QuickSale";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Quick sale" };

// The page stays a server component; the pad is a client component because it
// holds what the artist has typed and adds sales to the entries kept in the
// browser.
export default function QuickSalePage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Quick sale</h1>
      <QuickSale />
    </>
  );
}
