import type { Metadata } from "next";
import ExpenseForm from "@/components/ExpenseForm";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Add expense" };

// The page stays a server component; the form is a client component because
// it holds what the artist types and adds to the entries kept in the browser.
export default function NewExpensePage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Add expense</h1>
      <ExpenseForm />
    </>
  );
}
