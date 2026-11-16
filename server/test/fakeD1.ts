import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import type { DB, Stmt } from '../src/store.ts';

// An in-memory SQLite database behind the slice of the D1 API the Worker uses,
// set up with the real migration so tests exercise the real SQL.
export function fakeD1(): DB {
  const sqlite = new DatabaseSync(':memory:');
  const migration = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations', '0001_init.sql');
  sqlite.exec(readFileSync(migration, 'utf8'));

  return {
    prepare(sql: string): Stmt {
      let params: SQLInputValue[] = [];
      const stmt: Stmt = {
        bind(...values: unknown[]) {
          params = values as SQLInputValue[];
          return stmt;
        },
        async first<T>() {
          return (sqlite.prepare(sql).get(...params) as T | undefined) ?? null;
        },
        async run() {
          return sqlite.prepare(sql).run(...params);
        },
        async all<T>() {
          return { results: sqlite.prepare(sql).all(...params) as T[] };
        },
      };
      return stmt;
    },
  };
}
