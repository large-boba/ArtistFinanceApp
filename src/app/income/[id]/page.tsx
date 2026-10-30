import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AddButton from "@/components/AddButton";
import StreamDetail from "@/components/StreamDetail";
import { INCOME_STREAMS } from "@/lib/pretend-data";

// Only the seven income streams have a page. `generateStaticParams` lists them
// and `dynamicParams = false` turns every other address into a real 404 (no
// redirect). The fixed route /income/new (the form) is a separate folder, and
// Next.js always prefers a fixed route over a [id] one, so "new" is never
// treated as a stream id. (In Next.js 16 `params` is a Promise.)
export const dynamicParams = false;

export function generateStaticParams() {
  return INCOME_STREAMS.map((s) => ({ id: s.id }));
}

function nameOf(id: string): string | undefined {
  return INCOME_STREAMS.find((s) => s.id === id)?.name;
}

// The layout adds " · BentoBudget" after this title.
export async function generateMetadata({ params }: PageProps<"/income/[id]">): Promise<Metadata> {
  const { id } = await params;
  const name = nameOf(id);
  return name === undefined ? {} : { title: name };
}

export default async function IncomeStreamPage({ params }: PageProps<"/income/[id]">) {
  const { id } = await params;
  const name = nameOf(id);
  if (name === undefined) notFound();
  return (
    <>
      <h1 className="text-2xl font-bold break-words">{name}</h1>
      <StreamDetail streamId={id} />
      {/* Pre-filled with this stream; Save brings you back here. */}
      <AddButton stream={id} />
    </>
  );
}
