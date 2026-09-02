export function learnCoursePath(courseId: string): string {
  return `/learn/${encodeURIComponent(courseId)}`;
}

export function learnLessonPath(courseId: string, lessonId: string): string {
  return `${learnCoursePath(courseId)}/${encodeURIComponent(lessonId)}`;
}

export function resolveLessonRouteId(
  lessonIds: string[],
  routeLessonId: string,
): string | null {
  if (!routeLessonId) return null;
  if (lessonIds.includes(routeLessonId)) return routeLessonId;

  // Older links interpolated raw document names into the path. Browsers treat
  // ? and # as URL delimiters, so everything from that character onward was
  // lost before React Router read :lessonId. Recover only a single unambiguous
  // match; all genuinely invalid or ambiguous links stay unresolved.
  const legacyMatches = lessonIds.filter(
    (lessonId) =>
      lessonId.startsWith(`${routeLessonId}?`) ||
      lessonId.startsWith(`${routeLessonId}#`),
  );
  return legacyMatches.length === 1 ? legacyMatches[0] : null;
}
