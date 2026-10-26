// Small, pure helpers for moving between screens. No browser or React needed.

/**
 * Turns the `?back=` value from a page address into a place the app may send
 * the artist after Save or Cancel. Returns the value itself when it is a SAFE
 * internal path, otherwise "/" (Home).
 *
 * Why this exists: anyone can write a link such as
 *   /income/new?back=//evil.example
 * and "//evil.example" means "another website" to a browser. If the form
 * trusted `back`, saving would send the artist to that site, which could look
 * like BentoBudget and ask for a password. So only plain paths inside this app
 * are allowed.
 *
 * A safe path starts with a single "/" and is made only of ASCII letters,
 * digits, "-" and "/". That rules out, all at once: a second leading slash
 * ("//host"), backslashes (browsers treat "\" like "/"), schemes
 * ("https:", "javascript:"), query strings, fragments, spaces, dots ("../")
 * and percent-encoding ("%2F%2F" decodes to "//" later).
 *
 * Anything longer than 200 characters is refused too. No real screen of this
 * app has an address that long, and it keeps silly or huge addresses out of
 * navigation and links.
 */
export function safeBackPath(value: string | null | undefined): string {
  if (typeof value !== "string") return "/";
  if (value.length > 200) return "/";
  if (!/^\/[A-Za-z0-9/-]*$/.test(value)) return "/";
  if (value.includes("//")) return "/";
  return value;
}
