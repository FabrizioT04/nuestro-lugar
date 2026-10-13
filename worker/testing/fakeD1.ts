/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

// D1 de mentira sobre SQLite de Node (solo para pruebas): aplica las migraciones reales
// y ofrece la parte de la API de D1 que usan los repositorios (prepare/bind/all/first/run/batch).

type Value = string | number | null;

class Statement {
  constructor(
    private readonly db: DatabaseSync,
    private readonly sql: string,
    private readonly params: Value[] = [],
  ) {}

  bind(...params: unknown[]) {
    return new Statement(this.db, this.sql, params.map((value) => (value === undefined ? null : (value as Value))));
  }

  async all<T>() {
    return { results: this.db.prepare(this.sql).all(...this.params).map((row: object) => ({ ...row })) as T[], success: true };
  }

  async first<T>() {
    const row = this.db.prepare(this.sql).get(...this.params);
    return (row ? { ...row } : null) as T | null;
  }

  async run() {
    this.db.prepare(this.sql).run(...this.params);
    return { success: true };
  }
}

export function createFakeD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  const dir = join(import.meta.dirname, "../../migrations");
  for (const file of readdirSync(dir).filter((name: string) => name.endsWith(".sql")).sort()) db.exec(readFileSync(join(dir, file), "utf8"));

  const fake = {
    prepare: (sql: string) => new Statement(db, sql),
    async batch(statements: Statement[]) {
      db.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.all());
        db.exec("COMMIT");
        return results;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
  return fake as unknown as D1Database;
}
