import type { Metadata } from "next";
import EntriesList from "@/components/EntriesList";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Transactions" };

// The page itself stays a server component; the list is a client component
// because it reads the entries held in the browser (EntriesProvider).
export default function TransactionsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Transactions</h1>
      <EntriesList />
    </>
  );
}
