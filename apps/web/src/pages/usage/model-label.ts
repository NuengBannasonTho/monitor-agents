/** claude-opus-5-5 → "Opus 5.5", claude-sonnet-5 → "Sonnet 5"; anything else as it is. */
export function modelLabel(model: string): string {
  const match = /^claude-(opus|sonnet|haiku|fable|mythos)-(\d{1,2})(?:-(\d{1,2}))?(?!\d)/.exec(
    model,
  );
  const family = match?.[1];
  const major = match?.[2];
  if (family === undefined || major === undefined) return model;
  const minor = match?.[3];
  return `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}${minor === undefined ? '' : `.${minor}`}`;
}
