import type { Metadata } from "next";
import AddButton from "@/components/AddButton";
import ExpensesOverview from "@/components/ExpensesOverview";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Expenses" };

// The heading, the "+ Add" button, then the totals and the list of expenses.
export default function ExpensesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Expenses</h1>
      <AddButton />
      <ExpensesOverview />
    </>
  );
}
