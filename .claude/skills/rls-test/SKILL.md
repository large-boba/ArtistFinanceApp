---
name: rls-test
description: The two-account and helper-permission test procedure for BentoBudget's Row Level Security and storage policies (guide §5, Stage 3, §19). Use when writing or reviewing database tests, RLS policies, storage policies, or any route handler that reads or writes account data.
---

# RLS and permission tests

Row Level Security is the app's main privacy lock (§5). A policy that's slightly wrong leaks one artist's finances to another, so every table, storage bucket and route handler gets these tests. Write them as pgTAP tests in `supabase/tests/` (run with `supabase test db`). For route handlers, add Vitest or Playwright tests that call the route as each user.

## Test cast

Create these in the test setup:

| Actor | Membership |
|---|---|
| **Alice** | Owner of account A |
| **Bob** | Owner of account B |
| **Helper H** | Active member of account A with `permissions = '{transactions.add}'` only |
| **Removed R** | Member of account A with `status = 'removed'` |
| **Anon** | Not signed in |

Switch identity in pgTAP with `set local role authenticated;` and `set local request.jwt.claims = '{"sub":"<user-uuid>","role":"authenticated"}';`. Use `set local role anon;` for Anon.

## For every business table, prove each of these

1. **Cross-account read:** Bob selects from A's rows and gets 0 rows (not an error, just nothing).
2. **Cross-account write:** Bob's insert with `account_id = A` fails, and so do his update and delete of A's rows.
3. **Spoofed creator:** Alice's insert with `created_by = Bob` fails.
4. **Helper can add:** H can insert into `income`/`expenses` for A with `created_by = H`.
5. **Helper can't see or change more:** H can't select A's transactions, reports or settings, and can't update or delete other people's entries.
6. **No self-promotion:** H can't update their own `account_members` row (role, permissions or status), and neither can Alice through direct table access. Member changes go only through the server route that checks `members.manage`.
7. **Last owner:** removing or downgrading A's only owner fails.
8. **Removal is immediate:** R can read nothing from A.
9. **Anon** reads and writes nothing.
10. **`fx_rates`:** any signed-in user can read it, and no browser role can insert, update or delete.
11. **RLS is on:** a catalog check that every table in `public` has `relrowsecurity = true`, so a newly added table can't slip through.

## Storage (Stage 7 onward)

- Bob can't read, list, upload to or delete under `receipts/<A's account_id>/...`, even with the exact path.
- Uploads with overwrite on are refused, and an existing object can't be replaced.
- Originals are only reachable through short-lived signed URLs.

## Route handlers

- Every handler works out `account_id` and `created_by` on the server. Send a request with a forged `account_id` or `created_by` in the body. It must be ignored or rejected, never stored.

## Writing the tests well

- Each test asserts one claim, named after the claim (`bob_cannot_read_alice_expenses`).
- Assert the **exact** outcome: 0 rows, or a specific error code (`42501` for an RLS violation on write). "Something went wrong" isn't a pass.
- Write the tests before the policies (they must fail first), and confirm they fail for the right reason.
- Never weaken or delete a test to make it pass. If you believe a test is wrong, report it to the lead.
