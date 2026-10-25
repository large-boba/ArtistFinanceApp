import type { Metadata } from "next";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Transactions" };

// A placeholder: a later task (the entries list) replaces this.
export default function TransactionsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Transactions</h1>
      <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300">
        Nothing here yet. Sales and expenses you add will be listed here.
      </p>
    </>
  );
}
