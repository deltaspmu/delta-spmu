import assert from 'node:assert/strict';

import { lessonQuizLinkValue } from '../src/utils/lessonQuizLink.ts';

assert.equal(lessonQuizLinkValue('chapter-1-quiz'), 'chapter-1-quiz');
assert.equal(lessonQuizLinkValue(''), null);
assert.equal(lessonQuizLinkValue(undefined), null);
assert.equal(lessonQuizLinkValue(null), null);

console.log('ok');
