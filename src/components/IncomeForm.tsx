"use client";

// The "Add income" form (T1.12). The artist types; this file checks it and
// shows what it understood. Nothing is saved until Save is pressed, and even
// then it only goes into the pretend in-memory store (EntriesProvider).
//
// The form has two shapes, chosen by the Income stream:
//   - "Sales at events": the artist counts the day's takings as CASH and CARD
//     (two amounts, both required, $0 allowed) and sees a live total. Saving
//     adds two income rows, one per payment method (the owner's decision in
//     DECISIONS.md "Event takings").
//   - Every other stream: one Amount and a Payment method. Saving adds one row.
//     "Vendor shelf rental" can also say which event the money came from.
//
// Rules this form follows (mostly the same as the expense form; the pre-fill
// and ?back= are new here):
//   - The date is the phone's own date picker, starting as today on the device.
//   - Amounts are typed as text. parseAmountToCents turns them into whole
//     cents, and "Reads as $12.50" shows the result so a typo is obvious.
//   - Mistakes are explained only after Save is pressed. Save is never
//     disabled: pressing it is how you find out what is wrong.
//   - The page address can pre-fill the stream and event (?stream=, ?event=),
//     and ?back= says where Save and Cancel go (checked by safeBackPath).

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { isIsoDate } from "@/lib/dates";
import { addCents, PAYMENT_METHODS, STREAMS_WITH_EVENTS, type PaymentMethod } from "@/lib/entries";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { safeBackPath } from "@/lib/navigation";
import { INCOME_STREAMS, pretendEvents } from "@/lib/pretend-data";
import { useDevice } from "./useDevice";
import { useEntries } from "./EntriesProvider";
import {
  amountError,
  badBorder,
  cancelClass,
  describe,
  ERROR_AMOUNT_EMPTY,
  ERROR_DATE,
  errorClass,
  Field,
  fieldClass,
  labelClass,
  LoadingMessage,
  okBorder,
  PAYMENT_LABELS,
  readsAsClass,
  readsAsText,
  saveClass,
  LOADING_FORM,
} from "./form-parts";

const SALES_AT_EVENTS = "sales-at-events";

const ERROR_STREAM = "Choose an income stream.";
const ERROR_CASH_EMPTY = "Enter the cash amount, or 0 if there was none.";
const ERROR_CARD_EMPTY = "Enter the card amount, or 0 if there was none.";
const ERROR_PAYMENT = "Choose a payment method.";

type Errors = {
  date?: string;
  stream?: string;
  cash?: string;
  card?: string;
  amount?: string;
  payment?: string;
};

/** What the typed text for one amount means: its cents, or why it is not usable. */
function readAmount(text: string, emptyMessage: string): { cents: number | null; error?: string } {
  const cents = parseAmountToCents(text);
  if (cents === null) return { cents: null, error: amountError(text, emptyMessage) };
  return { cents };
}

/** Which fields the form shows for a stream: none yet, cash and card, or one amount. */
function shapeOf(streamId: string): "none" | "takings" | "one-amount" {
  if (!INCOME_STREAMS.some((s) => s.id === streamId)) return "none";
  return streamId === SALES_AT_EVENTS ? "takings" : "one-amount";
}

/**
 * The starting stream and event from the page address. An id that is not
 * exactly a known one is ignored. A known event brings its usual stream when
 * no (known) stream is given. An event is dropped when the stream can't have one.
 */
function startingChoice(
  streamParam: string | null,
  eventParam: string | null,
  today: string,
): { streamId: string; eventId: string } {
  const events = pretendEvents(today);
  let streamId = INCOME_STREAMS.find((s) => s.id === streamParam)?.id ?? "";
  const event = events.find((e) => e.id === eventParam);
  if (streamId === "" && event !== undefined) streamId = event.usualStreamId;
  if (event === undefined || !STREAMS_WITH_EVENTS.includes(streamId)) return { streamId, eventId: "" };
  return { streamId, eventId: event.id };
}

/**
 * Reads the page address (this needs a Suspense boundary in the page, or
 * `next build` fails), then shows the form once the device is known.
 */
export default function IncomeForm() {
  const device = useDevice();
  const params = useSearchParams();

  // Loading state: the device's language and today's date aren't known until
  // the page has woken up in the browser (see useDevice). The form only
  // mounts after that, so its starting date is read at the moment it opens.
  if (device === null) return <LoadingMessage text={LOADING_FORM} />;

  const streamParam = params.get("stream");
  const eventParam = params.get("event");
  return (
    <FormFields
      // A different page address starts a fresh form. The key is the WHOLE
      // search string, not just stream and event, on purpose: after Save with
      // ?back=/income/new the app replaces the address with plain /income/new,
      // and that change of address remounts the form, so everything (stream,
      // date, notes, messages and the double-tap guard) starts again. Keying on
      // stream and event alone would miss this when neither was in the address.
      key={params.toString()}
      locale={device.locale}
      today={device.today}
      start={startingChoice(streamParam, eventParam, device.today)}
      back={safeBackPath(params.get("back"))}
    />
  );
}

function FormFields({
  locale,
  today,
  start,
  back,
}: {
  locale: string;
  today: string;
  start: { streamId: string; eventId: string };
  back: string;
}) {
  const router = useRouter();
  const { dispatch } = useEntries();

  const [date, setDate] = useState(today);
  const [streamId, setStreamId] = useState(start.streamId);
  const [eventId, setEventId] = useState(start.eventId);
  // Cash, Card and Amount are kept apart: typed text isn't carried over when
  // the form changes shape.
  const [cash, setCash] = useState("");
  const [card, setCard] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState<PaymentMethod | "">("");
  const [notes, setNotes] = useState("");
  // Set by the first press of Save with a mistake in the form. From then on
  // the messages follow what is typed (and disappear as soon as it is fixed),
  // until the stream changes the form's shape (see the stream's onChange).
  const [tried, setTried] = useState(false);
  // True once a valid Save has gone through, so a double tap adds only once.
  const savedRef = useRef(false);

  const dateRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<HTMLSelectElement>(null);
  const cashRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const firstRadioRef = useRef<HTMLInputElement>(null);

  const stream = INCOME_STREAMS.find((s) => s.id === streamId);
  const isTakings = streamId === SALES_AT_EVENTS;
  const hasStream = stream !== undefined;
  const asksForEvent = STREAMS_WITH_EVENTS.includes(streamId);

  const cashRead = readAmount(cash, ERROR_CASH_EMPTY);
  const cardRead = readAmount(card, ERROR_CARD_EMPTY);
  const amountRead = readAmount(amount, ERROR_AMOUNT_EMPTY);

  // What is wrong right now. Shown only after Save has been pressed.
  const found: Errors = {};
  if (!isIsoDate(date)) found.date = ERROR_DATE;
  if (!hasStream) found.stream = ERROR_STREAM;
  if (hasStream && isTakings) {
    found.cash = cashRead.error;
    found.card = cardRead.error;
  } else if (hasStream) {
    found.amount = amountRead.error;
    if (payment === "") found.payment = ERROR_PAYMENT;
  }
  const shown: Errors = tried ? found : {};

  // The total is exact whole-cent addition, and only shows while both amounts
  // are valid, so it can never be a stale sum.
  let total = "";
  if (cashRead.cents !== null && cardRead.cents !== null) {
    try {
      total = `Total ${formatCents(addCents(cashRead.cents, cardRead.cents), "AUD", locale)}`;
    } catch {
      total = ""; // too large to add exactly: show nothing rather than a wrong sum
    }
  }

  const events = pretendEvents(today);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savedRef.current) return;

    if (Object.values(found).some((message) => message !== undefined)) {
      setTried(true);
      // Focus the first field with a mistake, in form order, so a screen
      // reader reads its label, value and message.
      if (found.date) dateRef.current?.focus();
      else if (found.stream) streamRef.current?.focus();
      else if (found.cash) cashRef.current?.focus();
      else if (found.card) cardRef.current?.focus();
      else if (found.amount) amountRef.current?.focus();
      else firstRadioRef.current?.focus();
      return;
    }

    // The store refuses an event on streams that can't have one, so it is only
    // sent for those. "" means not assigned.
    const eventPart = asksForEvent && eventId !== "" ? { eventId } : {};

    if (isTakings) {
      if (cashRead.cents === null || cardRead.cents === null) return;
      // Make the ids first: if that fails (crypto.randomUUID needs HTTPS or
      // localhost), Save must not be left blocked by the double-tap guard.
      const cashId = crypto.randomUUID();
      const cardId = crypto.randomUUID();
      savedRef.current = true;
      // One action, two rows (cash, then card), so both are always saved.
      dispatch({
        type: "add-event-takings",
        cashId,
        cardId,
        takings: { date, streamId, ...eventPart, cashCents: cashRead.cents, cardCents: cardRead.cents, notes },
      });
    } else {
      if (amountRead.cents === null || payment === "") return;
      const id = crypto.randomUUID();
      savedRef.current = true;
      dispatch({
        type: "add-income",
        id,
        income: { date, streamId, amountCents: amountRead.cents, paymentMethod: payment, ...eventPart, notes },
      });
    }
    // replace, not push: Back afterwards shouldn't reopen an empty form.
    router.replace(back);
  }

  const eventField = asksForEvent && (
    <Field id="income-event" label="Event">
      <select
        id="income-event"
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
  );

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-5">
      <Field id="income-date" label="Date">
        <input
          ref={dateRef}
          id="income-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={shown.date ? true : undefined}
          aria-describedby={describe(shown.date && "income-date-error")}
          className={fieldClass + (shown.date ? badBorder : okBorder)}
        />
        {shown.date && <p id="income-date-error" className={errorClass}>{shown.date}</p>}
      </Field>

      <Field id="income-stream" label="Income stream">
        <select
          ref={streamRef}
          id="income-stream"
          value={streamId}
          onChange={(e) => {
            const next = e.target.value;
            // A new shape means new fields, so ALL messages are hidden until
            // Save is pressed again: nobody is told off before they've typed.
            if (shapeOf(next) !== shapeOf(streamId)) setTried(false);
            setStreamId(next);
            // Moving between the two streams that have events keeps the
            // event; any other stream forgets it.
            if (!STREAMS_WITH_EVENTS.includes(next)) setEventId("");
          }}
          aria-invalid={shown.stream ? true : undefined}
          aria-describedby={describe(shown.stream && "income-stream-error")}
          className={fieldClass + (shown.stream ? badBorder : okBorder)}
        >
          <option value="">Choose a stream</option>
          {INCOME_STREAMS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {shown.stream && <p id="income-stream-error" className={errorClass}>{shown.stream}</p>}
      </Field>

      {eventField}

      {hasStream && isTakings && (
        <>
          <Field id="income-cash" label="Cash">
            <input
              ref={cashRef}
              id="income-cash"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              aria-invalid={shown.cash ? true : undefined}
              aria-describedby={describe(cashRead.cents !== null && "income-cash-reads", shown.cash && "income-cash-error")}
              className={fieldClass + (shown.cash ? badBorder : okBorder)}
            />
            {/* The "Reads as" lines (Cash, Card, Amount) are not live regions
                on purpose: a screen reader reads them when their field is
                focused (aria-describedby above), so announcing every
                keystroke would only be noise. Always on the page, empty
                unless the amount is valid. */}
            <p id="income-cash-reads" className={readsAsClass}>
              {readsAsText(cashRead.cents, locale)}
            </p>
            {shown.cash && <p id="income-cash-error" className={errorClass}>{shown.cash}</p>}
          </Field>

          <Field id="income-card" label="Card">
            <input
              ref={cardRef}
              id="income-card"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={card}
              onChange={(e) => setCard(e.target.value)}
              aria-invalid={shown.card ? true : undefined}
              aria-describedby={describe(cardRead.cents !== null && "income-card-reads", shown.card && "income-card-error")}
              className={fieldClass + (shown.card ? badBorder : okBorder)}
            />
            <p id="income-card-reads" className={readsAsClass}>
              {readsAsText(cardRead.cents, locale)}
            </p>
            {shown.card && <p id="income-card-error" className={errorClass}>{shown.card}</p>}
          </Field>

          {/* Unlike "Reads as", the total STAYS a polite live region: it belongs
              to no single field, so this is the only way a screen reader hears
              the sum. Empty until both amounts are valid. */}
          <p aria-live="polite" className="text-xl font-bold break-words">
            {total}
          </p>
        </>
      )}

      {hasStream && !isTakings && (
        <>
          <Field id="income-amount" label="Amount">
            <input
              ref={amountRef}
              id="income-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={shown.amount ? true : undefined}
              aria-describedby={describe(amountRead.cents !== null && "income-amount-reads", shown.amount && "income-amount-error")}
              className={fieldClass + (shown.amount ? badBorder : okBorder)}
            />
            <p id="income-amount-reads" className={readsAsClass}>
              {readsAsText(amountRead.cents, locale)}
            </p>
            {shown.amount && <p id="income-amount-error" className={errorClass}>{shown.amount}</p>}
          </Field>

          <fieldset
            aria-describedby={describe(shown.payment && "income-payment-error")}
            className="m-0 min-w-0 border-0 p-0"
          >
            <legend className={labelClass + " mb-1 p-0"}>Payment method</legend>
            <div className="flex flex-col gap-2">
              {PAYMENT_METHODS.map((method, i) => (
                // The label wraps its radio, so the whole row is the tap target.
                <label
                  key={method}
                  className={
                    "flex min-h-12 w-full min-w-0 items-center gap-3 rounded-lg border-2 px-3 py-2 text-base break-words has-[:checked]:bg-indigo-50 has-[:checked]:font-semibold has-[:focus-visible]:outline-4 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600 dark:has-[:checked]:bg-indigo-950 dark:has-[:focus-visible]:outline-indigo-300 " +
                    (shown.payment ? badBorder : okBorder)
                  }
                >
                  <input
                    ref={i === 0 ? firstRadioRef : undefined}
                    type="radio"
                    name="income-payment-method"
                    value={method}
                    checked={payment === method}
                    onChange={() => setPayment(method)}
                    aria-describedby={describe(shown.payment && "income-payment-error")}
                    className="h-6 w-6 shrink-0 accent-indigo-800"
                  />
                  <span className="min-w-0">{PAYMENT_LABELS[method]}</span>
                </label>
              ))}
            </div>
            {shown.payment && <p id="income-payment-error" className={errorClass}>{shown.payment}</p>}
          </fieldset>
        </>
      )}

      <Field id="income-notes" label="Notes (optional)">
        <textarea
          id="income-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={fieldClass + okBorder + " min-h-24"}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <button
          type="submit"
          className={saveClass}
        >
          Save
        </button>
        <Link
          href={back}
          className={cancelClass}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
