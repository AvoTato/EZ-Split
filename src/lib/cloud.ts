import AsyncStorage from '@react-native-async-storage/async-storage';

import { formatCode, isValidCode, normalizeCode } from './recoveryCode';
import type { SharedBill } from './shareBill';

// Talks to the Worker's data routes (server/src/index.ts). No sign-in: on first use the
// device registers and gets a secret key, which doubles as the recovery code.

const DEVICE_STORAGE_KEY = 'ez-split/device/v1';
const REQUEST_TIMEOUT_MS = 15_000;
// Edits come in bursts; wait for a quiet moment before uploading the whole backup.
const BACKUP_DELAY_MS = 10_000;
const MAX_STATUS_IDS = 100;

type DeviceState = { key: string; lastBackupAt?: number };

export class CloudError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'CloudError';
    this.status = status;
    this.code = code;
  }
}

function config() {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
  const token = process.env.EXPO_PUBLIC_API_TOKEN;
  return baseUrl && token ? { baseUrl, token } : null;
}

export function isCloudConfigured() {
  return config() !== null;
}

async function request<T>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const settings = config();
  if (!settings) throw new CloudError(0, 'not_configured', 'EXPO_PUBLIC_API_URL and EXPO_PUBLIC_API_TOKEN are not set.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${settings.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new CloudError(0, 'timeout', 'The request timed out.');
    throw new CloudError(0, 'network', error instanceof Error ? error.message : 'Network request failed.');
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const record = (typeof payload === 'object' && payload !== null ? payload : {}) as Record<string, unknown>;
    const code = typeof record.error === 'string' ? record.error : 'upstream_error';
    const message = typeof record.message === 'string' ? record.message : `Request failed (${response.status}).`;
    throw new CloudError(response.status, code, message);
  }
  return payload as T;
}

// ---------- Device identity ----------

let device: DeviceState | null | undefined;
let registering: Promise<DeviceState> | null = null;

async function loadDevice() {
  if (device !== undefined) return device;
  try {
    const raw = await AsyncStorage.getItem(DEVICE_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as DeviceState) : null;
    device = parsed && typeof parsed.key === 'string' && isValidCode(parsed.key) ? parsed : null;
  } catch {
    device = null;
  }
  return device;
}

async function saveDevice(state: DeviceState | null) {
  device = state;
  try {
    if (state) await AsyncStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(state));
    else await AsyncStorage.removeItem(DEVICE_STORAGE_KEY);
  } catch {
    // Kept in memory for this session; registration repeats next launch if it didn't stick.
  }
}

async function ensureDevice(): Promise<DeviceState> {
  const existing = await loadDevice();
  if (existing) return existing;
  const settings = config();
  if (!settings) throw new CloudError(0, 'not_configured', 'Cloud backup is not set up.');
  registering ??= request<{ key: string }>('POST', '/devices', settings.token)
    .then(async ({ key }) => {
      const state = { key: normalizeCode(key) };
      await saveDevice(state);
      return state;
    })
    .finally(() => {
      registering = null;
    });
  return registering;
}

// Runs a call with this device's key. A 401 means the server no longer knows the key
// (for example the database was reset), so forget it and register fresh next time.
async function withDevice<T>(call: (key: string) => Promise<T>): Promise<T> {
  const state = await ensureDevice();
  try {
    return await call(state.key);
  } catch (error) {
    if (error instanceof CloudError && error.status === 401 && device?.key === state.key) {
      await saveDevice(null);
    }
    throw error;
  }
}

export async function getRecoveryCode() {
  const state = await loadDevice();
  return state ? formatCode(state.key) : null;
}

export async function getLastBackupAt() {
  return (await loadDevice())?.lastBackupAt ?? null;
}

// ---------- Backups ----------

let pendingPayload: (() => unknown) | null = null;
let backupTimer: ReturnType<typeof setTimeout> | null = null;

// Uploads the latest data shortly after changes stop. Failures are silent and retried
// on the next change or launch; the phone's own copy is always the one in use.
export function scheduleBackup(getPayload: () => unknown) {
  if (!isCloudConfigured()) return;
  pendingPayload = getPayload;
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = setTimeout(() => {
    backupTimer = null;
    const next = pendingPayload;
    pendingPayload = null;
    if (next) backupNow(next()).catch(() => {});
  }, BACKUP_DELAY_MS);
}

export async function backupNow(data: unknown) {
  const { updatedAt } = await withDevice((key) => request<{ updatedAt: number }>('PUT', '/backup', key, { data }));
  if (device) await saveDevice({ ...device, lastBackupAt: updatedAt });
  return updatedAt;
}

// Fetches the backup behind a recovery code and, if found, makes that code this phone's
// identity from now on. The phone's previous code stops being used.
export async function restoreFromCode(code: string): Promise<unknown> {
  if (!isValidCode(code)) throw new CloudError(400, 'invalid_code', 'That code is not complete.');
  const key = normalizeCode(code);
  const backup = await request<{ data: unknown; updatedAt: number }>('GET', '/backup', key);

  // Don't let a queued upload of this phone's old data land on the restored code.
  if (backupTimer) clearTimeout(backupTimer);
  backupTimer = null;
  pendingPayload = null;

  await saveDevice({ key, lastBackupAt: backup.updatedAt });
  return backup.data;
}

// ---------- Shared bills ----------

export function shareUrl(id: string) {
  const settings = config();
  return settings ? `${settings.baseUrl}/s/${id}` : null;
}

export async function createShare(bill: SharedBill, paidIds: string[]) {
  const { id } = await withDevice((key) => request<{ id: string }>('POST', '/shares', key, { bill, paidIds }));
  return id;
}

export async function updateShare(id: string, bill: SharedBill) {
  await withDevice((key) => request('PUT', `/shares/${id}`, key, { bill }));
}

export async function setSharePaid(id: string, personId: string, paid: boolean) {
  await withDevice((key) => request('PUT', `/shares/${id}/paid`, key, { personId, paid }));
}

export async function deleteShare(id: string) {
  await withDevice((key) => request('DELETE', `/shares/${id}`, key));
}

// Paid-back ids for each share, by share id. Shares that were deleted are missing.
export async function fetchSharesPaid(ids: string[]): Promise<Record<string, string[]>> {
  if (ids.length === 0) return {};
  const { shares } = await withDevice((key) =>
    request<{ shares: Record<string, { paidIds: string[] }> }>('POST', '/shares/status', key, {
      ids: ids.slice(-MAX_STATUS_IDS),
    }),
  );
  return Object.fromEntries(Object.entries(shares).map(([id, value]) => [id, value.paidIds]));
}
