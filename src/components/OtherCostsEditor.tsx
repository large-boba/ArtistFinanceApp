"use client";

// The "Other costs" part of an event's page (T1.15): an optional figure with
// Add, Change and Clear, and a small inline form to type it.
//
// It follows the same rules as the other forms:
//   - the amount is typed as text; parseAmountToCents reads it and "Reads as
//     $600.00" shows what it understood, so a typo is obvious;
//   - mistakes are explained only after Save is pressed, then follow what is
//     typed; Save is never disabled; focus goes back to Amount;
//   - nothing reaches the store until a valid Save. Cancel saves nothing.
// The figure itself and "Result after other costs" come from eventSummary (via
// props); this file does no money maths. $0 is a real figure, not "none".

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { OtherCosts } from "@/lib/entries";
import { formatCents, parseAmountToCents } from "@/lib/money";
import { useEntries } from "./EntriesProvider";
import {
  badBorder,
  cancelClass,
  describe,
  ERROR_AMOUNT_EMPTY,
  ERROR_AMOUNT_INVALID,
  errorClass,
  Field,
  fieldClass,
  okBorder,
  readsAsClass,
  readsAsText,
  saveClass,
} from "./form-parts";

const secondaryButton =
  "flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-indigo-800 bg-white px-4 text-lg font-semibold text-indigo-900 active:bg-indigo-100 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-indigo-300 dark:bg-zinc-900 dark:text-indigo-100 dark:active:bg-zinc-800 dark:focus-visible:outline-indigo-300";

export default function OtherCostsEditor({
  eventId,
  locale,
  figure,
  resultAfterCents,
}: {
  eventId: string;
  locale: string;
  figure: Readonly<OtherCosts> | null;
  resultAfterCents: number | null;
}) {
  const { dispatch } = useEntries();
  const [editing, setEditing] = useState(false);
  const money = (cents: number) => formatCents(cents, "AUD", locale);

  // After the form closes, focus goes back to the button that opened it (or the
  // one that replaced it), so keyboard and screen-reader users don't get lost.
  const openerRef = useRef<HTMLButtonElement>(null);
  const refocusRef = useRef(false);
  useEffect(() => {
    if (!editing && refocusRef.current) {
      refocusRef.current = false;
      openerRef.current?.focus();
    }
  }, [editing, figure]);

  if (editing) {
    return (
      <OtherCostsForm
        // Starts afresh each time it opens, holding the current figure.
        // Typed-style text ("600.00") that parseAmountToCents reads back; the
        // fixed "en-AU" keeps the full stop whatever the device's language.
        initialAmount={figure === null ? "" : formatCents(figure.amountCents, "AUD", "en-AU").replace(/^\$/, "")}
        initialNotes={figure?.notes ?? ""}
        locale={locale}
        onCancel={() => {
          refocusRef.current = true;
          setEditing(false);
        }}
        onSave={(amountCents, notes) => {
          dispatch({ type: "set-event-other-costs", eventId, amountCents, notes });
          refocusRef.current = true;
          setEditing(false);
        }}
      />
    );
  }

  if (figure === null) {
    return (
      <button ref={openerRef} type="button" onClick={() => setEditing(true)} className={`${secondaryButton} mt-3 w-full`}>
        Add other costs
      </button>
    );
  }

  return (
    <div className="mt-3">
      <p className="text-lg break-words">
        Other costs <span className="font-bold">{money(figure.amountCents)}</span>
      </p>
      {figure.notes !== "" && <p className="mt-1 text-base break-words">{figure.notes}</p>}
      {resultAfterCents !== null && (
        <p className="mt-3 text-2xl break-words">
          Result after other costs <span className="font-bold">{money(resultAfterCents)}</span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button ref={openerRef} type="button" onClick={() => setEditing(true)} className={secondaryButton}>
          Change
        </button>
        {/* Clear needs no confirmation: it only removes an optional estimate. */}
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "clear-event-other-costs", eventId });
            // The Change button is about to disappear; "Add other costs" takes its place.
            refocusRef.current = true;
            setEditing(false);
          }}
          className={secondaryButton}
        >
          Clear
        </button>
      </div>
    </div>
  );
}

function OtherCostsForm({
  initialAmount,
  initialNotes,
  locale,
  onCancel,
  onSave,
}: {
  initialAmount: string;
  initialNotes: string;
  locale: string;
  onCancel: () => void;
  onSave: (amountCents: number, notes: string) => void;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const [notes, setNotes] = useState(initialNotes);
  // Set by the first Save with a mistake; from then on messages follow the typing.
  const [tried, setTried] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  // The form opens with the cursor in Amount.
  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const cents = amount.trim() === "" ? null : parseAmountToCents(amount);
  const error = amount.trim() === "" ? ERROR_AMOUNT_EMPTY : cents === null ? ERROR_AMOUNT_INVALID : undefined;
  const shown = tried ? error : undefined;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cents === null) {
      setTried(true);
      amountRef.current?.focus();
      return;
    }
    onSave(cents, notes.trim());
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-4 flex flex-col gap-4">
      <Field id="other-costs-amount" label="Amount">
        <input
          ref={amountRef}
          id="other-costs-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={shown ? true : undefined}
          aria-describedby={describe(cents !== null && "other-costs-reads", shown && "other-costs-error")}
          className={fieldClass + (shown ? badBorder : okBorder)}
        />
        {/* Not a live region on purpose: read when the field is focused. */}
        <p id="other-costs-reads" className={readsAsClass}>
          {readsAsText(cents, locale)}
        </p>
        {shown && (
          <p id="other-costs-error" className={errorClass}>
            {shown}
          </p>
        )}
      </Field>
      <Field id="other-costs-notes" label="Notes (optional)">
        <textarea
          id="other-costs-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={fieldClass + okBorder + " min-h-20"}
        />
      </Field>
      <div className="flex flex-col gap-3">
        <button type="submit" className={saveClass}>
          Save
        </button>
        <button type="button" onClick={onCancel} className={cancelClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}
