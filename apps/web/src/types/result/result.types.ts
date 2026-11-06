/** What a call to the server gives back: the value, or why there is none, for a person. */
export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };
