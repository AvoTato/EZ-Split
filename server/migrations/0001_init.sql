-- Anonymous devices. The device secret is never stored, only its SHA-256.
-- The secret doubles as the recovery code the user writes down.
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

-- One backup per device: the app's whole local data as JSON, replaced on each upload.
CREATE TABLE backups (
  device_id TEXT PRIMARY KEY REFERENCES devices(id),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- A shared bill. The random id is the link, so anyone holding it can view the bill.
CREATE TABLE shares (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id),
  bill TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX shares_device ON shares(device_id);

-- Who has paid back on a shared bill. Written by the owner's app or by a friend on the web page.
CREATE TABLE share_paid (
  share_id TEXT NOT NULL REFERENCES shares(id),
  person_id TEXT NOT NULL,
  paid_at INTEGER NOT NULL,
  PRIMARY KEY (share_id, person_id)
);
