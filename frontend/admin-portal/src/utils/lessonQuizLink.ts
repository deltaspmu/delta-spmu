/**
 * Frappe only clears Link fields when the update explicitly contains null.
 * Omitting quiz_id means "leave the current value unchanged".
 */
export function lessonQuizLinkValue(quizId: string | null | undefined): string | null {
  return quizId || null;
}
