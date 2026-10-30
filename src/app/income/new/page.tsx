import type { Metadata } from "next";
import { Suspense } from "react";
import IncomeForm from "@/components/IncomeForm";
import { LOADING_FORM, LoadingMessage } from "@/components/form-parts";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Add income" };

// The page stays a server component; the form is a client component because
// it holds what the artist types and adds to the entries kept in the browser.
// The form reads the page address (?stream=, ?event=, ?back=) with
// useSearchParams, which needs a Suspense boundary or `next build` fails.
export default function NewIncomePage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Add income</h1>
      <Suspense fallback={<LoadingMessage text={LOADING_FORM} />}>
        <IncomeForm />
      </Suspense>
    </>
  );
}
