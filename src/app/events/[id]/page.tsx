import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AddButton from "@/components/AddButton";
import EventDetail from "@/components/EventDetail";
import { pretendEvents } from "@/lib/pretend-data";

// Only the three pretend events have a page. `generateStaticParams` lists them
// and `dynamicParams = false` turns every other address into a real 404 (no
// redirect), on both builds. (In Next.js 16 `params` is a Promise, hence the
// awaits.) Stage 4 replaces this with events from the database.
export const dynamicParams = false;

// The ids and names never change with the date (only the dates do), so any
// valid date will do to list them on the server. Using pretendEvents itself
// keeps the ids in one place.
const ANY_DATE = "2000-01-01";

export function generateStaticParams() {
  return pretendEvents(ANY_DATE).map((e) => ({ id: e.id }));
}

function nameOf(id: string): string | undefined {
  return pretendEvents(ANY_DATE).find((e) => e.id === id)?.name;
}

// The layout adds " · BentoBudget" after this title.
export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  const name = nameOf(id);
  return name === undefined ? {} : { title: name };
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const name = nameOf(id);
  if (name === undefined) notFound();
  return (
    <>
      <h1 className="text-2xl font-bold break-words">{name}</h1>
      <EventDetail eventId={id} />
      {/* Pre-filled with this event; Save brings you back here. */}
      <AddButton event={id} />
    </>
  );
}
