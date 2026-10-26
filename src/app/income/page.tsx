import type { Metadata } from "next";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Income" };

// A simple page for now: one heading and a note. A later card (T1.16) fills
// it with your income by stream.
export default function IncomePage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Income</h1>
      <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300">
        Your income by stream is coming next.
      </p>
    </>
  );
}
