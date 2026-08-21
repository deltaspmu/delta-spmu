import assert from 'node:assert/strict';

import { hasAdminAccess } from '../src/utils/adminAccess.ts';

assert.equal(hasAdminAccess({ name: 'Administrator', roles: [] }), true);
assert.equal(
  hasAdminAccess({ name: 'manager@example.com', roles: ['System Manager'] }),
  true,
);
assert.equal(
  hasAdminAccess({ name: 'administrator@deltaspmu.com', roles: [] }),
  false,
);
assert.equal(hasAdminAccess({ name: 'student@example.com', roles: ['LMS Student'] }), false);

console.log('ok');
