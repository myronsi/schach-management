// Run via tests/api/run.sh - uses synthetic data in throwaway containers only.
// Integration tests for the hardened PHP API (local containers only).
const BASE = 'http://localhost:8099/api';
const ORIGIN = 'http://localhost:8099';
let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`);
  if (!cond) failures++;
};

async function call(path, { method = 'GET', body, token, origin = ORIGIN, headers = {} } = {}) {
  const h = { ...headers };
  if (origin) h.Origin = origin;
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined && !(body instanceof FormData)) h['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}/${path}`, { method, headers: h, body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text, headers: res.headers };
}
const login = async (username, password) => (await call('auth.php', { method: 'POST', body: { username, password } })).json;

// ---- auth.php
let r = await call('auth.php?debug=headers', { method: 'POST', body: { password: 'x' } });
check('debug endpoint removed', !r.text.includes('all_headers'), r.text);
const chairTok = (await login('chair', 'chairpass1')).token;
const adminTok = (await login('admin1', 'adminpass1')).token;
const memberTok = (await login('member', 'memberpass')).token;
check('logins work', chairTok && adminTok && memberTok);
r = await login('nosuchuser', 'x');
const r2 = await login('member', 'wrong');
check('generic login error', r.message === r2.message && r.success === false, `${r.message} / ${r2.message}`);
r = await login('blocked', 'blockedpass');
check('blocked user gets no token', !r.token && r.success === false, JSON.stringify(r));
for (let i = 0; i < 9; i++) await login('admin2', 'wrong' + i);
r = await call('auth.php', { method: 'POST', body: { username: 'admin2', password: 'adminpass2' } });
check('login rate limited after failures', r.status === 429, r.status + ' ' + r.text);
r = await call('auth.php', { method: 'POST', body: { action: 'validate' }, token: adminTok });
check('validate works', r.json?.success === true, r.text);

// set_password
const newbie = await login('newbie', 'temppass1');
check('forced change flag', newbie.must_change_password === true);
r = await call('auth.php', { method: 'POST', body: { action: 'set_password', token: newbie.token, new_password: 'brandnewpass' } });
check('forced first password change works without current password', r.json?.success === true, r.text);
const newbieTok = (await login('newbie', 'brandnewpass')).token;
r = await call('auth.php', { method: 'POST', body: { action: 'set_password', new_password: 'anotherpass1' }, token: newbieTok });
check('later change requires current password', r.json?.success === false, r.text);
r = await call('auth.php', { method: 'POST', body: { action: 'set_password', new_password: 'anotherpass1', current_password: 'brandnewpass' }, token: newbieTok });
check('later change with current password works', r.json?.success === true && typeof r.json?.token === 'string', r.text);
const newbieFreshTok = r.json?.token;
r = await call('auth.php', { method: 'POST', body: { action: 'validate' }, token: newbieTok });
check('password change revokes older tokens', r.json?.success === false, r.text);
r = await call('auth.php', { method: 'POST', body: { action: 'validate' }, token: newbieFreshTok });
check('token returned by set_password is valid', r.json?.success === true, r.text);

// ---- forged / default secret tokens
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const { createHmac } = await import('node:crypto');
const forge = (secret) => {
  const h = b64({ alg: 'HS256', typ: 'JWT' }), p = b64({ username: 'chair', status: 'chairman', exp: 9999999999 });
  return `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
};
r = await call('news.php', { method: 'POST', body: { slug: 'x', title: 'x' }, token: forge('default_secret_change_this') });
check('default-secret token rejected', r.status === 401, r.status + r.text);
r = await call('news.php', { method: 'POST', body: { slug: 'x', title: 'x' }, token: forge('local-test-secret-0123456789abcdef') });
check('legacy token without password fingerprint rejected', r.status === 401, r.status + r.text);

// ---- CORS
r = await call('news.php', { origin: 'https://evil.example' });
check('CORS not reflected for foreign origin', r.headers.get('access-control-allow-origin') === null);
r = await call('news.php');
check('CORS reflected for allowed origin', r.headers.get('access-control-allow-origin') === ORIGIN);

// ---- authm.php role rules
r = await call('authm.php', { method: 'POST', token: adminTok, body: { username: 'chair', password: 'hijacked123', status: 'chairman', is_update: true } });
check('admin cannot reset chairman password', r.status === 403, r.status + r.text);
r = await call('authm.php', { method: 'POST', token: adminTok, body: { username: 'chair', status: 'user', is_update: true } });
check('admin cannot demote chairman', r.status === 403, r.status + r.text);
r = await call('authm.php', { method: 'DELETE', token: adminTok, body: { username: 'chair' } });
check('admin cannot delete chairman', r.status === 403, r.status + r.text);
r = await call('authm.php', { method: 'DELETE', token: adminTok, body: { username: 'admin1' } });
check('cannot delete self', r.status === 403, r.status + r.text);
r = await call('authm.php', { method: 'POST', token: adminTok, body: { username: 'member', status: 'chairman', is_update: true } });
check('admin cannot grant chairman', r.status === 403, r.status + r.text);
r = await call('authm.php', { method: 'POST', token: adminTok, body: { username: 'admin1', status: 'user', is_update: true } });
check('cannot change own status', r.status === 403, r.status + r.text);
r = await call('authm.php', { method: 'POST', token: adminTok, body: { username: 'freshuser', password: 'freshpass1', status: 'user' } });
check('admin can create user', r.json?.success === true, r.text);
r = await call('authm.php', { method: 'POST', token: adminTok, body: { username: 'member', password: 'overwrite1', status: 'user' } });
check('create with existing username is 409, no overwrite', r.status === 409, r.status + r.text);
check('existing user password untouched', !!(await login('member', 'memberpass')).token);
r = await call('authm.php', { method: 'POST', token: adminTok, body: { username: 'admin2', password: 'takeover12', status: 'admin', is_update: true } });
check('admin cannot reset another admin password', r.status === 403, r.status + r.text);
r = await call('authm.php', { method: 'DELETE', token: adminTok, body: { username: 'admin2' } });
check('admin cannot delete another admin', r.status === 403, r.status + r.text);
r = await call('authm.php', { method: 'POST', token: adminTok, body: { username: 'freshuser', status: 'user', password_status: 'changed', is_update: true } });
check('admin can update a user', r.json?.success === true, r.text);
r = await call('authm.php', { method: 'GET', token: memberTok });
check('member cannot list users', r.status === 403, r.status + '');
r = await call('authm.php', { method: 'POST', token: chairTok, body: { username: 'admin2', status: 'user', password_status: 'changed', is_update: true } });
check('chairman can demote admin', r.json?.success === true, r.text);

// demoted user's old token immediately loses access (DB status check)
const admin2TokBefore = adminTok; // admin1 still admin
r = await call('news.php', { method: 'POST', body: { slug: 'x1', title: 'x' }, token: admin2TokBefore });
check('admin still works', r.json?.success === true, r.text);
await call('authm.php', { method: 'POST', token: chairTok, body: { username: 'admin1', status: 'user', password_status: 'changed', is_update: true } });
r = await call('news.php', { method: 'POST', body: { slug: 'x2', title: 'x' }, token: adminTok });
check('demoted admin token rejected immediately', r.status === 401 || r.status === 403, r.status + r.text);
await call('authm.php', { method: 'POST', token: chairTok, body: { username: 'admin1', status: 'admin', password_status: 'changed', is_update: true } });
const admin1Tok = (await login('admin1', 'adminpass1')).token;

// ---- events auth bypass
r = await call('events.php?action=editByTitle', { method: 'POST', body: { title: 'Training', updates: { location: 'pwned' } } });
check('editByTitle requires auth', r.status === 401, r.status + r.text);
r = await call('events.php?action=somethingNew', { method: 'POST', body: {} });
check('unknown event action requires auth', r.status === 401, r.status + r.text);
r = await call('events.php?action=editByTitle', { method: 'POST', token: admin1Tok, body: { title: 'Training', start_date: '2026-01-01', updates: { location: 'Clubheim' } } });
check('editByTitle works for editor', r.json?.success === true && r.json?.affected_ids?.length === 1, r.text);
r = await call('events.php?action=create', { method: 'POST', token: admin1Tok, body: [{ title: 'A', date: '2026-12-10' }, { title: 'B', date: 'kaputt' }] });
check('batch create is all-or-nothing on invalid input', r.status === 400, r.status + r.text);
r = await call('events.php?action=create', { method: 'POST', token: admin1Tok, body: [{ title: 'A', date: '2026-12-10' }, { title: 'B', date: '2026-12-11:2026-12-12' }] });
check('batch create assigns ids', JSON.stringify(r.json?.affected_ids) === '[2,3]', r.text);
r = await call('events.php?action=list');
check('public event list works', r.json?.events?.length === 3, r.text);
r = await call('events.php?action=edit', { method: 'POST', token: admin1Tok, body: { id: 2, updates: { date: 'kaputt' } } });
check('event edit validates date', r.status === 400, r.status + r.text);
r = await call('events.php?action=edit', { method: 'POST', token: admin1Tok, body: { id: 999, updates: { location: 'x' } } });
check('event edit of unknown id is 404', r.status === 404, r.status + r.text);
r = await call('events.php?action=edit', { method: 'POST', token: admin1Tok, body: { id: 2, updates: { date: '2026-12-09' } } });
check('event edit with valid date works', r.json?.success === true, r.text);
r = await call('events.php?action=editByTitle', { method: 'POST', token: admin1Tok, body: { title: 'B', start_date: '2026-12-01', end_date: '2026-12-11', updates: { location: 'Saal' } } });
check('editByTitle range includes multi-day event starting on end date', r.json?.affected_ids?.length === 1, r.text);
r = await call('events.php?action=editByTitle', { method: 'POST', token: admin1Tok, body: { title: 'B', start_date: 'gestern', updates: { location: 'Saal' } } });
check('editByTitle validates dates', r.status === 400, r.status + r.text);

// ---- path traversal
r = await call('documents.php?action=scan&path=../');
check('scan requires auth', r.status === 401, r.status + '');
r = await call('documents.php?action=scan&path=../', { token: admin1Tok });
check('document scan traversal blocked', r.status === 400 && !r.text.includes('outside.txt'), r.status + r.text);
r = await call('media.php?action=scan&title=..%2F..', { token: admin1Tok });
check('media scan traversal blocked', r.status === 400, r.status + r.text);
r = await call('documents.php?action=scan&path=vereinsdokumente', { token: admin1Tok });
check('legit document scan works', r.json?.file_count === 1, r.text);
let fd = new FormData();
fd.append('action', 'upload'); fd.append('category', '../api');
fd.append('file', new Blob(['hello']), 'x.pdf');
r = await call('documents.php', { method: 'POST', body: fd, token: admin1Tok });
check('upload traversal blocked', r.status === 400, r.status + r.text);
fd = new FormData();
fd.append('action', 'upload'); fd.append('title', 'sommerfest');
fd.append('file', new Blob(['<svg onload=alert(1)>']), 'x.svg');
r = await call('media.php', { method: 'POST', body: fd, token: admin1Tok });
check('svg upload rejected', r.json?.uploaded_count === 0 && r.json?.errors?.length === 1, r.text);
fd = new FormData();
fd.append('action', 'upload'); fd.append('title', 'sommerfest');
fd.append('file', new Blob(['jpgdata']), 'bild.jpg');
r = await call('media.php', { method: 'POST', body: fd, token: admin1Tok });
check('jpg upload works', r.json?.uploaded_count === 1, r.text);

// ---- creates: server-assigned ids, no overwrite
r = await call('news.php', { method: 'POST', token: admin1Tok, body: { slug: 'neu', title: 'Neu', content: '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a><a href="https://x.de" target="_blank">ok</a>' } });
const newsId = r.json?.id;
check('news create gets server id', newsId > 2, r.text);
r = await call('news.php?slug=neu');
const content = r.json?.content || '';
check('news content sanitised', !/script|onerror|javascript:/i.test(content) && content.includes('href="https://x.de"') && content.includes('noopener'), content);
r = await call('news.php', { method: 'POST', token: admin1Tok, body: { id: 999, slug: 'ghost', title: 'Ghost' } });
check('update of unknown id is 404 (no silent create)', r.status === 404, r.status + r.text);
r = await call('news.php', { method: 'POST', token: admin1Tok, body: { slug: 'erste', title: 'Dup' } });
check('duplicate slug -> 409 without conflict flag', r.status === 409 && r.json?.code === 'slug_exists' && !r.json?.conflict, r.text);
r = await call('news.php', { method: 'POST', token: admin1Tok, body: { slug: 'link', title: 'L', link: 'javascript:alert(1)', image: 'data:text/html,x' } });
r = await call('news.php?slug=link');
check('unsafe news link/image dropped', r.json?.link === '' && r.json?.image === '', r.text);
for (const [file, body] of [['fastinfo.php', { icon: 'i', label: 'l', targetValue: 3 }], ['tournaments.php', { type: 'pokalsieger', year: '2026', first: 'A' }], ['history.php', { date: '1950', text: 'Gründung' }], ['teams.php', { name: 'T1', league: 'L' }], ['documents.php', { name: 'D', filepath: '/docs/x.pdf' }], ['media.php', { src: 'photos/sommerfest/a.jpg', title: 'M' }]]) {
  r = await call(file, { method: 'POST', token: admin1Tok, body });
  check(`${file} create without id`, r.json?.success === true && r.json?.id, r.text);
}
r = await call('documents.php', { method: 'POST', token: admin1Tok, body: { name: 'D', filepath: 'javascript:alert(1)' } });
check('document javascript: filepath rejected', r.status === 400, r.status + r.text);
r = await call('teams.php', { method: 'POST', token: admin1Tok, body: { id: 0, name: 'Beschreibung', text: '<p>hi</p><iframe src="https://evil"></iframe>' } });
r = await call('teams.php?id=0');
check('team description sanitised', r.json?.text === '<p>hi</p>', r.text);

// ---- edit locks enforced server-side
const chairTok2 = chairTok;
r = await call('edit-lock.php', { method: 'POST', token: chairTok2, body: { action: 'acquire', entity: 'news', entity_id: '1' } });
check('chairman acquires lock', r.json?.success === true, r.text);
const lockToken = r.json?.lock_token;
r = await call('news.php', { method: 'POST', token: admin1Tok, body: { id: 1, slug: 'erste', title: 'Overwrite' } });
check('save blocked by other user lock (423)', r.status === 423 && r.json?.locked_by === 'chair', r.status + r.text);
r = await call('news.php', { method: 'DELETE', token: admin1Tok, body: { id: 1 } });
check('delete blocked by other user lock', r.status === 423, r.status + r.text);
r = await call('news.php', { method: 'POST', token: chairTok2, body: { id: 1, slug: 'erste', title: 'Mine' } });
check('lock holder can save', r.json?.success === true, r.text);
// beacon-style release: token in body, text/plain
const res = await fetch(`${BASE}/edit-lock.php`, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8', Origin: ORIGIN }, body: JSON.stringify({ action: 'release', entity: 'news', entity_id: '1', lock_token: lockToken, token: chairTok2 }) });
check('beacon release accepted', res.status === 200, String(res.status));
r = await call('news.php', { method: 'POST', token: admin1Tok, body: { id: 1, slug: 'erste', title: 'After release' } });
check('save works after release', r.json?.success === true, r.text);
r = await call('edit-lock.php', { method: 'POST', token: admin1Tok, body: { action: 'acquire', entity: 'users', entity_id: '1' } });
check('lock on unknown entity rejected', r.status === 400, r.status + r.text);

// ---- optimistic conflict
r = await call('news.php?slug=erste');
r = await call('news.php', { method: 'POST', token: admin1Tok, body: { id: 1, slug: 'erste', title: 'x', expected_updated_at: '2000-01-01 00:00:00' } });
check('stale expected_updated_at -> 409 conflict', r.status === 409 && r.json?.conflict === true, r.text);

// ---- membership
const sig = 'data:image/png;base64,' + Buffer.from('png').toString('base64');
const app = { first_name: 'A', last_name: 'B', address: 'S 1', postal_city: '1 X', birth_date: '2000-01-01', email: 'a@b.de', nationality: 'Deutsch', gender: 'männlich', membership_type: 'Aktivmitglied', application_place: 'L', application_date: '2026-10-16', signature: sig, signed_at: new Date().toISOString() };
r = await call('membership-applications.php', { method: 'POST', body: { ...app, birth_date: 'gestern' } });
check('membership invalid birth date rejected', r.status === 400, r.text);
r = await call('membership-applications.php', { method: 'POST', body: { ...app, direct_debit: true, bank_name: 'B', bic: 'X', iban: 'DE00123', debit_signature: sig } });
check('membership invalid IBAN rejected', r.status === 400 && /IBAN/.test(r.json?.message), r.text);
const minorBirth = `${new Date().getFullYear() - 10}-01-01`;
r = await call('membership-applications.php', { method: 'POST', body: { ...app, birth_date: minorBirth } });
check('minor without guardian signature rejected', r.status === 400 && /Vertreter/.test(r.json?.message), r.text);
r = await call('membership-applications.php', { method: 'POST', body: { ...app, signed_at: undefined, first_name: ['x'] } });
check('non-scalar application field rejected', r.status === 400, r.text);
r = await call('membership-applications.php', { method: 'POST', body: { ...app, direct_debit: true, bank_name: 'B', bic: 'X', iban: 'DE89 3704 0044 0532 0130 00', debit_signature: sig } });
check('membership valid application accepted', r.json?.success === true, r.text);
let last;
for (let i = 0; i < 5; i++) last = await call('membership-applications.php', { method: 'POST', body: app });
check('membership rate limited', last.status === 429, last.status + last.text);
r = await call('membership-applications.php', { token: admin1Tok });
check('admin cannot read applications', r.status === 403, String(r.status));
r = await call('membership-applications.php', { token: chairTok });
check('chairman reads applications', Array.isArray(r.json) && r.json.length > 0, r.text.slice(0, 100));
const appCount = r.json?.length ?? 0;
check('application list omits bank data and signatures', r.json?.[0] && !('iban' in r.json[0]) && !('signature' in r.json[0]), JSON.stringify(r.json?.[0]));
const appId = r.json?.[0]?.id;
r = await call(`membership-applications.php?id=${appId}`, { token: chairTok });
check('application detail has bank data, server signing time', r.json && 'iban' in r.json && r.json.signature && r.json.signed_at, r.text.slice(0, 200));
r = await call(`membership-applications.php?id=${appId}`, { method: 'DELETE', token: admin1Tok });
check('admin cannot delete applications', r.status === 403, String(r.status));
r = await call('membership-applications.php', { method: 'DELETE', token: chairTok, body: { id: appId } });
check('chairman deletes application', r.json?.success === true, r.text);
r = await call('membership-applications.php', { token: chairTok });
check('deleted application is gone', Array.isArray(r.json) && r.json.length === appCount - 1 && !r.json.some((a) => a.id === appId), r.text.slice(0, 100));

// ---- user profile
r = await call('user_profile.php', { method: 'PUT', token: memberTok, body: { email: 'm@x.de', notify_events: 1 } });
check('profile update works', r.json?.success === true, r.text);
r = await call('user_profile.php', { token: memberTok });
check('profile read works', r.json?.email === 'm@x.de', r.text);

// ---- cron scripts not public
r = await call('send_emails.php');
check('send_emails forbidden without key', r.status === 403, r.status + r.text);
r = await call('queue_tomorrow_events.php?key=wrong');
check('queue forbidden with wrong key', r.status === 403, String(r.status));
r = await call('queue_tomorrow_events.php?key=testcronkey');
check('queue works with key', r.status === 200, r.status + r.text);
r = await call('send_emails.php', { headers: { 'X-Cron-Key': 'testcronkey' } });
check('cron key accepted as header', r.status === 200, r.status + r.text);

// ---- date validation
r = await call('news.php', { method: 'POST', token: admin1Tok, body: { slug: 'datum', title: 'D', date: 'tomorrow' } });
check('news rejects free-form date', r.status === 400, r.status + r.text);
r = await call('news.php', { method: 'POST', token: admin1Tok, body: { slug: 'datum', title: 'D', date: '2026-03-04' } });
check('news accepts YYYY-MM-DD', r.json?.success === true, r.text);
r = await call('history.php', { method: 'POST', token: admin1Tok, body: { date: 'irgendwann', text: 'x' } });
check('history rejects invalid date', r.status === 400, r.status + r.text);
r = await call('history.php', { method: 'POST', token: admin1Tok, body: { date: '1950.03.12-04.01', text: 'x' } });
check('history accepts date range format', r.json?.success === true, r.text);

// ---- errors do not leak internals
r = await call('events.php?action=edit', { method: 'POST', token: admin1Tok, body: { id: 1, updates: { nonsense: 1 } } });
check('no SQL/exception text in responses', !/SQLSTATE|PDO|\/var\/www/.test(r.text), r.text);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
