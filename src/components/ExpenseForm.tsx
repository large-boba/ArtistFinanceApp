"use client";

// The "Add expense" form (T1.7). The artist types; this file checks it and
// shows what it understood. Nothing is saved until Save is pressed, and even
// then it only goes into the pretend in-memory store (EntriesProvider).
//
// Rules this form follows:
//   - The date comes from the phone's own date picker and starts as today on
//     the device. "Today" is taken once, when the form opens.
//   - The amount is typed as text. parseAmountToCents (T1.4) turns it into
//     whole cents, and "Reads as $12.50" shows the result so a typo is obvious.
//   - Mistakes are explained only after Save is pressed. Save is never
//     disabled: pressing it is how you find out what is wrong.
//   - Only event & venue categories can have an event (guide §7).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { isIsoDate } from "@/lib/dates";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { DRAFT_CATEGORIES, pretendEvents } from "@/lib/pretend-data";
import type { ExpenseGroup } from "@/lib/entries";
import { useDevice } from "./useDevice";
import { useEntries } from "./EntriesProvider";

const GROUP_LABELS: { group: ExpenseGroup; label: string }[] = [
  { group: "production", label: "Production" },
  { group: "event_venue", label: "Event & venue" },
  { group: "operating", label: "Operating" },
];

const ERROR_AMOUNT_EMPTY = "Enter an amount.";
const ERROR_AMOUNT_INVALID =
  "Enter an amount like 12.50 or $1,234.50, with no minus sign and at most 2 decimal places.";
const ERROR_CATEGORY = "Choose a category.";
const ERROR_DATE = "Choose a date.";

// 48px tall (at least the 44px minimum), 16px text so iPhones don't zoom in,
// and a clear focus ring. min-w-0 lets a field shrink inside a narrow screen.
const fieldClass =
  "block min-h-12 w-full min-w-0 rounded-lg border-2 bg-white px-3 py-2 text-base text-zinc-900 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:outline-indigo-300 ";
const okBorder = "border-zinc-500 dark:border-zinc-400";
const badBorder = "border-red-700 dark:border-red-400";
const labelClass = "block text-base font-semibold break-words";
const errorClass = "mt-1 text-base font-semibold break-words text-red-800 dark:text-red-300";

type Errors = { date?: string; amount?: string; category?: string };

export default function ExpenseForm() {
  const device = useDevice();

  // Loading state: the device's language and today's date aren't known until
  // the page has woken up in the browser (see useDevice). The form only
  // mounts after that, so its starting date is read at the moment it opens.
  if (device === null) {
    return (
      <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300" role="status">
        Loading the form…
      </p>
    );
  }
  return <FormFields locale={device.locale} today={device.today} />;
}

function FormFields({ locale, today }: { locale: string; today: string }) {
  const router = useRouter();
  const { dispatch } = useEntries();

  const [date, setDate] = useState(today);
  const [supplier, setSupplier] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [eventId, setEventId] = useState("");
  const [notes, setNotes] = useState("");
  // Set by the first press of Save with a mistake in the form. From then on
  // the messages follow what is typed (and disappear as soon as it is fixed).
  const [tried, setTried] = useState(false);
  // True once a valid Save has gone through, so a double tap adds only one.
  const savedRef = useRef(false);

  const dateRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);

  const category = DRAFT_CATEGORIES.find((c) => c.id === categoryId);
  const asksForEvent = category?.group === "event_venue";
  const cents = parseAmountToCents(amount);

  // What is wrong right now. Shown only after Save has been pressed.
  const found: Errors = {};
  if (!isIsoDate(date)) found.date = ERROR_DATE;
  if (amount.trim() === "") found.amount = ERROR_AMOUNT_EMPTY;
  else if (cents === null) found.amount = ERROR_AMOUNT_INVALID;
  if (category === undefined) found.category = ERROR_CATEGORY;
  const shown: Errors = tried ? found : {};

  const readsAs = cents === null ? "" : `Reads as ${formatCents(cents, "AUD", locale)}`;
  const events = pretendEvents(today);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savedRef.current) return;

    if (found.date || found.amount || found.category || cents === null || category === undefined) {
      setTried(true);
      // Focus the first field with a mistake, in form order, so a screen
      // reader reads its label, value and message.
      if (found.date) dateRef.current?.focus();
      else if (found.amount) amountRef.current?.focus();
      else categoryRef.current?.focus();
      return;
    }

    savedRef.current = true;
    dispatch({
      type: "add-expense",
      id: crypto.randomUUID(),
      expense: {
        date,
        supplier,
        amountCents: cents,
        categoryId: category.id,
        // The store refuses an event on production and operating costs, so it
        // is only sent for event & venue categories. "" means not assigned.
        ...(asksForEvent && eventId !== "" ? { eventId } : {}),
        notes,
      },
    });
    router.push("/");
  }

  const describe = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-5">
      <Field id="expense-date" label="Date">
        <input
          ref={dateRef}
          id="expense-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={shown.date ? true : undefined}
          aria-describedby={describe(shown.date && "expense-date-error")}
          className={fieldClass + (shown.date ? badBorder : okBorder)}
        />
        {shown.date && <p id="expense-date-error" className={errorClass}>{shown.date}</p>}
      </Field>

      <Field id="expense-supplier" label="Supplier (optional)">
        <input
          id="expense-supplier"
          type="text"
          autoComplete="off"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className={fieldClass + okBorder}
        />
      </Field>

      <Field id="expense-amount" label="Amount">
        <input
          ref={amountRef}
          id="expense-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={shown.amount ? true : undefined}
          aria-describedby={describe(readsAs !== "" && "expense-amount-reads", shown.amount && "expense-amount-error")}
          className={fieldClass + (shown.amount ? badBorder : okBorder)}
        />
        {/* Always on the page, empty unless the amount is valid, so a screen
            reader notices when it fills in. */}
        <p id="expense-amount-reads" aria-live="polite" className="mt-1 text-base font-semibold break-words">
          {readsAs}
        </p>
        {shown.amount && <p id="expense-amount-error" className={errorClass}>{shown.amount}</p>}
      </Field>

      <Field id="expense-category" label="Category">
        <select
          ref={categoryRef}
          id="expense-category"
          value={categoryId}
          onChange={(e) => {
            const next = DRAFT_CATEGORIES.find((c) => c.id === e.target.value);
            setCategoryId(e.target.value);
            // Leaving the event & venue group forgets the chosen event.
            if (next?.group !== "event_venue") setEventId("");
          }}
          aria-invalid={shown.category ? true : undefined}
          aria-describedby={describe(shown.category && "expense-category-error")}
          className={fieldClass + (shown.category ? badBorder : okBorder)}
        >
          <option value="">Choose a category</option>
          {GROUP_LABELS.map(({ group, label }) => (
            <optgroup key={group} label={label}>
              {DRAFT_CATEGORIES.filter((c) => c.group === group).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {shown.category && <p id="expense-category-error" className={errorClass}>{shown.category}</p>}
      </Field>

      {asksForEvent && (
        <Field id="expense-event" label="Event">
          <select
            id="expense-event"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className={fieldClass + okBorder}
          >
            <option value="">Not assigned yet</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field id="expense-notes" label="Notes (optional)">
        <textarea
          id="expense-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={fieldClass + okBorder + " min-h-24"}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          className="flex min-h-14 w-full items-center justify-center rounded-xl bg-indigo-800 px-4 text-xl font-bold text-white active:bg-indigo-900 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-300"
        >
          Save
        </button>
        <Link
          href="/"
          className="flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-lg font-semibold text-indigo-900 underline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-200 dark:focus-visible:outline-indigo-300"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

/** One labelled field: the label is tied to its control by `id`. */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={labelClass + " mb-1"}>
        {label}
      </label>
      {children}
    </div>
  );
}
