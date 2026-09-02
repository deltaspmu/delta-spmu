import assert from 'node:assert/strict';

import { matchRoutes } from 'react-router-dom';

import {
  learnCoursePath,
  learnLessonPath,
  resolveLessonRouteId,
} from '../src/utils/learnRoutes.ts';

const routes = [{ path: '/learn/:courseId/:lessonId' }];
const courseId = 'professional-certificate-in-lip-blush-lip-neutralization';

assert.equal(
  learnCoursePath(courseId),
  '/learn/professional-certificate-in-lip-blush-lip-neutralization',
);

for (const lessonId of [
  '0074 What Is Lip Blush?',
  'Color #1',
  'Needle / cartridge',
  'Healing 90%',
]) {
  const path = learnLessonPath(courseId, lessonId);
  const url = new URL(path, 'https://learn.deltaspmu.com');
  const matches = matchRoutes(routes, path);

  assert.equal(url.search, '', lessonId);
  assert.equal(url.hash, '', lessonId);
  assert.equal(matches?.[0].params.courseId, courseId, lessonId);
  assert.equal(matches?.[0].params.lessonId, lessonId, lessonId);
}

assert.equal(
  learnLessonPath(courseId, '0074 What Is Lip Blush?'),
  '/learn/professional-certificate-in-lip-blush-lip-neutralization/0074%20What%20Is%20Lip%20Blush%3F',
);

assert.equal(
  resolveLessonRouteId(
    ['0074 What Is Lip Blush?', '0075 Lip Anatomy'],
    '0074 What Is Lip Blush',
  ),
  '0074 What Is Lip Blush?',
);
assert.equal(resolveLessonRouteId(['Color #1'], 'Color '), 'Color #1');
assert.equal(resolveLessonRouteId(['lesson-a'], 'missing'), null);
assert.equal(resolveLessonRouteId(['?leading-delimiter'], ''), null);
assert.equal(
  resolveLessonRouteId(['Question? One', 'Question? Two'], 'Question'),
  null,
);

console.log('ok');
