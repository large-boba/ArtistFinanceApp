import type { Metadata } from "next";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Expenses" };

// A simple page for now: one heading and a note. A later card (T1.17) fills
// it with the list of expenses and their totals.
export default function ExpensesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Expenses</h1>
      <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300">
        Your expenses list and totals are coming next.
      </p>
    </>
  );
}
