import type { Metadata } from "next";
import AddButton from "@/components/AddButton";
import EventsList from "@/components/EventsList";

// The layout adds " · BentoBudget" after this title.
export const metadata: Metadata = { title: "Events" };

// The heading, the list of events, then the round "+" button last. The list
// is a client component because the dates depend on the device's date.
export default function EventsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold break-words">Events</h1>
      <EventsList />
      <AddButton />
    </>
  );
}
