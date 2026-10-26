// Home. A server component: it has no "use client", so nothing here needs the
// browser. The page title comes from the default in layout.tsx ("BentoBudget").
//
// "+ Add" (T1.14) sits directly under the heading so it is always on screen,
// above the bottom navigation. It offers "Add income" and "Add expense".

import AddButton from "@/components/AddButton";
import TodayTotals from "@/components/TodayTotals";

export default function HomePage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Home</h1>
      <AddButton />
      <TodayTotals />
      <p className="mt-6 text-base text-zinc-700 dark:text-zinc-300">
        Practice mode: entries disappear when you refresh or close the app.
      </p>
    </>
  );
}
