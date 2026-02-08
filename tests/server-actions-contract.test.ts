import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const source = readFileSync(path.join(process.cwd(), 'src/app/actions/qna.ts'), 'utf8');

test('vote action inserts upvote-only payload', () => {
  assert.match(
    source,
    /from\('votes'\)\.insert\(\{[\s\S]*?target_type:[\s\S]*?target_id:[\s\S]*?value:\s*1,[\s\S]*?\}\)/m,
  );
});

test('report action does not run moderation RPC in app layer', () => {
  assert.equal(source.includes('evaluate_reports_and_maybe_hide'), false);
});

test('recovery RPCs execute with authenticated user client', () => {
  assert.match(source, /await userClient\.rpc\('set_recovery_code'/);
  assert.match(source, /await userClient\.rpc\('claim_recovery_code'/);
});
