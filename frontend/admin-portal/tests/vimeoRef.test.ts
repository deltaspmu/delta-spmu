import assert from 'node:assert/strict';

import { parseVimeoRef, vimeoDurationMinutes } from '../src/utils/vimeoRef.ts';

assert.equal(parseVimeoRef('1234567890'), '1234567890');
assert.equal(parseVimeoRef(' 1234567890/abc123def4 '), '1234567890/abc123def4');
assert.equal(
  parseVimeoRef('https://vimeo.com/1234567890/abc123def4'),
  '1234567890/abc123def4',
);
assert.equal(
  parseVimeoRef('https://player.vimeo.com/video/1234567890?h=abc123def4'),
  '1234567890/abc123def4',
);
assert.equal(parseVimeoRef('https://vimeo.com/1234567890'), '1234567890');
assert.equal(parseVimeoRef('not a video'), null);
assert.equal(parseVimeoRef(''), null);
assert.equal(parseVimeoRef(undefined), null);

assert.equal(vimeoDurationMinutes(0), 0);
assert.equal(vimeoDurationMinutes(89), 1);
assert.equal(vimeoDurationMinutes(90), 2);
assert.equal(vimeoDurationMinutes(754), 13);
assert.equal(vimeoDurationMinutes(undefined), null);
assert.equal(vimeoDurationMinutes(Number.NaN), null);

console.log('ok');
