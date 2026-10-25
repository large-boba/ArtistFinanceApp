// Home. A server component: it has no "use client", so nothing here needs the
// browser. The page title comes from the default in layout.tsx ("BentoBudget").
//
// "+ Expense" opens the expense form. "+ Sale" is still a placeholder until
// the number pad is built (T1.8). Both sit near the top so they are always on
// screen, above the bottom navigation.

import Link from "next/link";
import TodayTotals from "@/components/TodayTotals";

const bigButton =
  "flex min-h-24 w-full items-center justify-center rounded-2xl text-3xl font-bold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300";

export default function HomePage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Home</h1>
      <div className="mt-6 flex flex-col gap-4">
        <button
          type="button"
          className={`${bigButton} bg-emerald-800 text-white active:bg-emerald-900`}
        >
          + Sale
        </button>
        <Link
          href="/expenses/new"
          className={`${bigButton} bg-indigo-800 text-white active:bg-indigo-900`}
        >
          + Expense
        </Link>
      </div>
      <TodayTotals />
      <p className="mt-6 text-base text-zinc-700 dark:text-zinc-300">
        Practice mode: entries disappear when you refresh or close the app.
      </p>
    </>
  );
}
