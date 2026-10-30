// Home. A server component: it has no "use client", so nothing here needs the
// browser. The page title comes from the default in layout.tsx ("BentoBudget").
//
// MonthSummary (T1.18) shows this month's income, expenses and net. The
// practice-mode note comes after it.
//
// The round "+" button (T1.14, moved by T1.19) is the last thing on the page.
// It floats at the bottom right of the screen and offers "Add income" and
// "Add expense".

import AddButton from "@/components/AddButton";
import MonthSummary from "@/components/MonthSummary";

export default function HomePage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Home</h1>
      <MonthSummary />
      <p className="mt-6 text-base text-zinc-700 dark:text-zinc-300">
        Practice mode: entries disappear when you refresh or close the app.
      </p>
      <AddButton />
    </>
  );
}
