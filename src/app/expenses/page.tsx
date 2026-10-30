import type { Metadata } from "next";
import AddButton from "@/components/AddButton";
import ExpensesOverview from "@/components/ExpensesOverview";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Expenses" };

// The heading, the totals and the list of expenses, then the round "+" button.
export default function ExpensesPage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Expenses</h1>
      <ExpensesOverview />
      <AddButton />
    </>
  );
}
