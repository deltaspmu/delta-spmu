export function learnCoursePath(courseId: string): string {
  return `/learn/${encodeURIComponent(courseId)}`;
}

export function learnLessonPath(courseId: string, lessonId: string): string {
  return `${learnCoursePath(courseId)}/${encodeURIComponent(lessonId)}`;
}
