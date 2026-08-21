/**
 * Normalize a pasted Vimeo reference to the `"id"` / `"id/hash"` form the
 * lesson `youtube` field stores.
 *
 * Accepts a bare id, `id/hash`, a share link (`vimeo.com/<id>/<hash>`), or a
 * player URL (`player.vimeo.com/video/<id>?h=<hash>`). Returns null when no
 * video id is present.
 */
export function parseVimeoRef(input: string | null | undefined): string | null {
  const text = (input || '').trim();
  const id = text.match(/(\d{6,})/)?.[1];
  if (!id) return null;
  const hash =
    text.match(/[?&]h=([0-9a-zA-Z]+)/)?.[1] ||
    text.match(new RegExp(`${id}/([0-9a-zA-Z]+)`))?.[1];
  return hash ? `${id}/${hash}` : id;
}

/** Convert Vimeo seconds to the whole minutes stored by Course Lesson. */
export function vimeoDurationMinutes(seconds: number | null | undefined): number | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds / 60);
}
