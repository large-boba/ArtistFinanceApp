import type { Metadata } from "next";
import { Suspense } from "react";
import ExpenseForm from "@/components/ExpenseForm";
import { LOADING_FORM, LoadingMessage } from "@/components/form-parts";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Add expense" };

// The page stays a server component; the form is a client component because
// it holds what the artist types and adds to the entries kept in the browser.
export default function NewExpensePage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Add expense</h1>
      {/* The form reads the page address, which needs a Suspense boundary. */}
      <Suspense fallback={<LoadingMessage text={LOADING_FORM} />}>
        <ExpenseForm />
      </Suspense>
    </>
  );
}
