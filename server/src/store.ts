// Device identity, backups and shared bills, stored in Cloudflare D1.

// The slice of the D1 API used here, so tests can stand in a SQLite-backed fake.
export type Stmt = {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
};
export type DB = { prepare(sql: string): Stmt };

export const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
export const MAX_SHARE_BODY_BYTES = 32 * 1024;
export const MAX_STATUS_IDS = 100;

// ---------- Keys and ids ----------

// Crockford base32: no I, L, O or U, so a code read aloud or retyped survives.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{32}$/;
export const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function base32(bytes: Uint8Array) {
  let out = '';
  let value = 0;
  let bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

// 20 random bytes = 160 bits = exactly 32 base32 characters.
export function newSecret() {
  return base32(randomBytes(20));
}

export function normalizeCode(input: string) {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function isValidCode(code: string) {
  return CODE_PATTERN.test(code);
}

export function newShareId() {
  const bytes = randomBytes(16);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---------- Devices ----------

export async function registerDevice(db: DB) {
  const secret = newSecret();
  const now = Date.now();
  await db
    .prepare('INSERT INTO devices (id, key_hash, created_at, last_seen_at) VALUES (?, ?, ?, ?)')
    .bind(crypto.randomUUID(), await sha256Hex(secret), now, now)
    .run();
  return secret;
}

// Returns the device id for a bearer key, or null if the key is unknown or malformed.
export async function deviceFromKey(db: DB, key: string) {
  const code = normalizeCode(key);
  if (!isValidCode(code)) return null;
  const row = await db
    .prepare('SELECT id FROM devices WHERE key_hash = ?')
    .bind(await sha256Hex(code))
    .first<{ id: string }>();
  if (!row) return null;
  await db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').bind(Date.now(), row.id).run();
  return row.id;
}

// ---------- Backups ----------

export type BackupParse = { ok: true; text: string } | { ok: false; error: string };

// The app sends { data: { version, groups: [...] } }; only the shape is checked, not every field.
export function parseBackupBody(raw: unknown): BackupParse {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Body must be a JSON object.' };
  const data = (raw as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, error: 'data must be an object.' };
  }
  if (!Array.isArray((data as Record<string, unknown>).groups)) {
    return { ok: false, error: 'data.groups must be an array.' };
  }
  return { ok: true, text: JSON.stringify(data) };
}

export async function getBackup(db: DB, deviceId: string) {
  const row = await db
    .prepare('SELECT data, updated_at FROM backups WHERE device_id = ?')
    .bind(deviceId)
    .first<{ data: string; updated_at: number }>();
  if (!row) return null;
  return { data: JSON.parse(row.data) as unknown, updatedAt: row.updated_at };
}

export async function putBackup(db: DB, deviceId: string, text: string) {
  const now = Date.now();
  await db
    .prepare(
      'INSERT INTO backups (device_id, data, updated_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(device_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
    )
    .bind(deviceId, text, now)
    .run();
  return now;
}

// ---------- Shared bills ----------

export type BillPerson = { id: string; name: string; amount: number };
export type Bill = { title?: string; currency: string; payerId?: string; people: BillPerson[] };

export type BillParse = { ok: true; value: Bill } | { ok: false; error: string };

const MAX_PEOPLE = 50;
const MAX_AMOUNT = 10_000_000;

function shortString(value: unknown, max: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : null;
}

export function validateBill(raw: unknown): BillParse {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'bill must be an object.' };
  const record = raw as Record<string, unknown>;

  if (!Array.isArray(record.people) || record.people.length === 0 || record.people.length > MAX_PEOPLE) {
    return { ok: false, error: `bill.people must have 1 to ${MAX_PEOPLE} people.` };
  }
  const people: BillPerson[] = [];
  const seen = new Set<string>();
  for (const entry of record.people) {
    if (typeof entry !== 'object' || entry === null) return { ok: false, error: 'Each person must be an object.' };
    const person = entry as Record<string, unknown>;
    const id = shortString(person.id, 64);
    const name = shortString(person.name, 80);
    const amount = person.amount;
    if (!id || !name) return { ok: false, error: 'Each person needs an id and a name.' };
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
      return { ok: false, error: 'Each person needs a valid amount.' };
    }
    if (seen.has(id)) return { ok: false, error: 'Person ids must be unique.' };
    seen.add(id);
    people.push({ id, name, amount });
  }

  const bill: Bill = { currency: 'RM', people };
  if (record.title !== undefined && record.title !== null && record.title !== '') {
    const title = shortString(record.title, 120);
    if (!title) return { ok: false, error: 'bill.title is too long.' };
    bill.title = title;
  }
  if (record.currency !== undefined) {
    const currency = shortString(record.currency, 8);
    if (!currency) return { ok: false, error: 'bill.currency is invalid.' };
    bill.currency = currency;
  }
  if (record.payerId !== undefined && record.payerId !== null) {
    if (typeof record.payerId !== 'string' || !seen.has(record.payerId)) {
      return { ok: false, error: 'bill.payerId must be one of the people.' };
    }
    bill.payerId = record.payerId;
  }
  return { ok: true, value: bill };
}

// Someone can be marked paid only if they're on the bill and aren't the one who paid it.
function canBePaid(bill: Bill, personId: string) {
  return personId !== bill.payerId && bill.people.some((person) => person.id === personId);
}

export async function createShare(db: DB, deviceId: string, bill: Bill, paidIds: string[]) {
  const id = newShareId();
  const now = Date.now();
  await db
    .prepare('INSERT INTO shares (id, device_id, bill, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, deviceId, JSON.stringify(bill), now, now)
    .run();
  for (const personId of new Set(paidIds)) {
    if (canBePaid(bill, personId)) await setPaid(db, id, bill, personId, true);
  }
  return id;
}

export async function loadShare(db: DB, id: string) {
  if (!SHARE_ID_PATTERN.test(id)) return null;
  const row = await db
    .prepare('SELECT device_id, bill FROM shares WHERE id = ?')
    .bind(id)
    .first<{ device_id: string; bill: string }>();
  if (!row) return null;
  return { deviceId: row.device_id, bill: JSON.parse(row.bill) as Bill };
}

export async function paidIdsFor(db: DB, id: string, bill: Bill) {
  const { results } = await db
    .prepare('SELECT person_id FROM share_paid WHERE share_id = ?')
    .bind(id)
    .all<{ person_id: string }>();
  return results.map((row) => row.person_id).filter((personId) => canBePaid(bill, personId));
}

// Replaces the bill. A new payer means everyone's paid-back state is stale, as in the app.
export async function updateShare(db: DB, id: string, previous: Bill, bill: Bill) {
  if (previous.payerId !== bill.payerId) {
    await db.prepare('DELETE FROM share_paid WHERE share_id = ?').bind(id).run();
  }
  await db
    .prepare('UPDATE shares SET bill = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(bill), Date.now(), id)
    .run();
}

export async function setPaid(db: DB, id: string, bill: Bill, personId: string, paid: boolean) {
  if (!canBePaid(bill, personId)) return false;
  if (paid) {
    await db
      .prepare('INSERT OR IGNORE INTO share_paid (share_id, person_id, paid_at) VALUES (?, ?, ?)')
      .bind(id, personId, Date.now())
      .run();
  } else {
    await db.prepare('DELETE FROM share_paid WHERE share_id = ? AND person_id = ?').bind(id, personId).run();
  }
  return true;
}

export async function deleteShare(db: DB, id: string) {
  await db.prepare('DELETE FROM share_paid WHERE share_id = ?').bind(id).run();
  await db.prepare('DELETE FROM shares WHERE id = ?').bind(id).run();
}

// ---------- Public bill page ----------

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Matches the app's money(): whole cents, two decimals.
function formatAmount(currency: string, value: number) {
  return `${currency} ${(Math.round(value * 100) / 100).toFixed(2)}`;
}

export const PAGE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy':
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
};

export function renderSharePage(bill: Bill, paidIds: string[], flash?: string) {
  const payer = bill.people.find((person) => person.id === bill.payerId);
  const total = bill.people.reduce((sum, person) => sum + person.amount, 0);
  const title = escapeHtml(bill.title ?? 'Shared bill');

  const rows = bill.people
    .map((person) => {
      const name = escapeHtml(person.name);
      const amount = escapeHtml(formatAmount(bill.currency, person.amount));
      let status: string;
      if (person.id === bill.payerId) {
        status = '<span class="tag payer">Paid the bill</span>';
      } else if (paidIds.includes(person.id)) {
        status = '<span class="tag paid">Paid &#10003;</span>';
      } else if (!payer || person.amount <= 0) {
        status = '';
      } else {
        status =
          '<form method="post"><input type="hidden" name="personId" value="' +
          escapeHtml(person.id) +
          '"><button type="submit">I&#39;ve paid</button></form>';
      }
      return `<li><div><div class="name">${name}</div><div class="amount">${amount}</div></div>${status}</li>`;
    })
    .join('');

  const intro = payer
    ? `<p class="muted">${escapeHtml(payer.name)} paid. Find your name and tap &ldquo;I&#39;ve paid&rdquo; once you&#39;ve paid them back.</p>`
    : '<p class="muted">Here&#39;s what everyone owes.</p>' +
      '<p class="notice">The &ldquo;I&#39;ve paid&rdquo; buttons appear once the person who shared this picks who paid the bill in EZ-Split.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · EZ-Split</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font: 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F7F5FC; color: #171717; }
  main { max-width: 480px; margin: 0 auto; padding: 32px 16px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .muted { color: #6B6575; margin: 0 0 20px; }
  .notice { background: #F1EDFD; color: #4B3A9E; padding: 12px 14px; border-radius: 12px; margin: -8px 0 20px; font-size: 15px; }
  .flash { background: #E6F4EA; color: #1E5E2A; padding: 12px 14px; border-radius: 12px; margin-bottom: 16px; font-weight: 600; }
  ul { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 18px; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
  li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #EEE; }
  li:last-child { border-bottom: 0; }
  .name { font-weight: 600; }
  .amount { color: #6B6575; font-variant-numeric: tabular-nums; }
  form { margin: 0; }
  button { font: inherit; font-weight: 700; color: #fff; background: #9B87F0; border: 0; border-radius: 20px; padding: 8px 16px; cursor: pointer; }
  .tag { font-size: 14px; font-weight: 700; padding: 6px 12px; border-radius: 16px; white-space: nowrap; }
  .paid { background: #E6F4EA; color: #2E7D32; }
  .payer { background: #F1EDFD; color: #6F5BD0; }
  .total { display: flex; justify-content: space-between; padding: 16px 4px 0; font-weight: 700; }
  footer { margin-top: 28px; font-size: 13px; color: #8A8A8A; }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  ${intro}
  ${flash ? `<div class="flash">${escapeHtml(flash)}</div>` : ''}
  <ul>${rows}</ul>
  <div class="total"><span>Total</span><span>${escapeHtml(formatAmount(bill.currency, total))}</span></div>
  <footer>Shared from EZ-Split. Anyone with this link can see this bill. Only tap your own name.</footer>
</main>
</body>
</html>`;
}

export function renderNotFoundPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Bill not found · EZ-Split</title><style>body{margin:0;font:16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#F7F5FC;color:#171717}main{max-width:480px;margin:0 auto;padding:48px 16px;text-align:center}</style></head><body><main><h1>Bill not found</h1><p>This link may have been removed by the person who shared it.</p></main></body></html>`;
}
