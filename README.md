<!-- docs: sync from coderbuzz/codex@b36584c -->

# @coderbuzz/sql

> **The un-opinionated SQL toolkit for TypeScript.** Schema-driven. Multi-dialect. Runtime agnostic. No ORM lock-in.
> AI agents: see [AI_KNOWLEDGE.md](https://github.com/coderbuzz/sql/blob/main/AI_KNOWLEDGE.md) for expert context.
<p align="center">
  <a href="https://www.npmjs.com/package/@coderbuzz/sql"><img src="https://img.shields.io/npm/v/@coderbuzz/sql.svg?style=flat-square" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/@coderbuzz/sql"><img src="https://img.shields.io/npm/dm/@coderbuzz/sql.svg?style=flat-square" alt="npm downloads" /></a>
  <a href="https://github.com/coderbuzz/sql/blob/main/LICENSE"><img src="https://img.shields.io/github/license/coderbuzz/sql.svg?style=flat-square" alt="MIT License" /></a>
  <a href="https://github.com/coderbuzz/sql"><img src="https://img.shields.io/github/stars/coderbuzz/sql.svg?style=flat-square" alt="GitHub Stars" /></a>
</p>

`@coderbuzz/sql` is a type-safe SQL toolkit that gives you the **full power of SQL** without the abstraction leaks of ORMs or the verbosity of raw query builders. Write schema definitions once, then use them for DDL, typed queries, migrations, batch inserts, and streaming — across **8 database dialects**.

This is not an ORM. There are no lazy-loaded relations, no magical `save()` methods, no hidden N+1 queries. You write SQL — but with **full type safety**, **fluent query builders**, **dialect-aware compilation**, and **zero runtime overhead** compared to hand-written queries.

---

## Why @coderbuzz/sql Over Drizzle, Kysely, or Prisma?

| Pain Point | Drizzle ORM | Kysely | Prisma | **@coderbuzz/sql** |
|---|---|---|---|---|
| Runtime agnostic | Bun, Node, Deno | Bun, Node, Deno | Node only | **Bun, Node, Deno** |
| Dialects supported | 5 (SQLite, PG, MySQL, PG, SQLite) | 6 | 5 (with connectors) | **8** — SQLite, PG, MySQL, MSSQL, ClickHouse, Oracle, Snowflake, Databricks |
| Query builder vs ORM | Hybrid (ORM-like) | Query builder | ORM (magic) | **Query builder** — full SQL control |
| Learning curve | Steady (ORM conventions) | Low (SQL-like) | Steep (Prisma schema, CLI) | **Low** — you already know SQL |
| Migration tools | Drizzle Kit (CLI) | Manual | Prisma Migrate (CLI) | **Built-in** — `introspect()` + `diff()` + `applyDiff()` |
| Batch insert | External | External | `createMany()` | **Built-in batcher** — debounce, timeout, backpressure |
| Streaming | Limited | No | No | **Built-in** — `stream()` for SQLite, PG |
| Prepared statements | Some dialects | Some dialects | Via Prisma Client | **Built-in** — SQLite (Bun), PG |
| Middleware pipeline | Hooks only | No | Middleware | **Plugin system** — `db.use(middleware)` for logging, tracing, safety |
| Raw SQL tagged templates | Yes | Yes | `$queryRaw` | **Yes** — `db.sql\`SELECT * FROM users WHERE id = ${id}\`` with dialect-aware placeholders |
| ClickHouse support | No | No | No | **Native** — with MergeTree engine options |
| Bundle size | ~100 KB+ | ~50 KB | ~5 MB+ | **<30 KB gzip** — tree-shakeable |

---

## When to Use This

- **You want type safety** without an ORM's magic
- **You need multi-dialect support** — one codebase for SQLite dev and PostgreSQL prod
- **You need ClickHouse, Snowflake, or Databricks support** — Drizzle and Kysely don't cover these
- **You want full control** over SQL output — every query is inspectable via `.toSQL()`
- **You need high-throughput batch inserts** — debounce, timeout, and backpressure built in
- **You want schema migrations** without a CLI — introspect live DBs, diff against schemas, generate ALTER TABLE

---

## Features

- **8 databases** — SQLite, PostgreSQL, MySQL/MariaDB, SQL Server, ClickHouse, Oracle, Snowflake, Databricks/Spark SQL
- **Schema-driven table definitions** — define columns once for DDL + typed queries
- **Fluent query builders** — SELECT, INSERT, UPDATE, DELETE with full type inference
- **Safe raw SQL** — `db.sql\`...\`` tagged templates with dialect-aware placeholders
- **Transactions** — automatic rollback on error, per-dialect isolation
- **Streaming** — `stream()` for large result sets (SQLite, PostgreSQL)
- **Prepared statements** — `prepare()` with caching (SQLite/Bun, PostgreSQL)
- **High-throughput batch inserts** — `InsertBatcher` with debounce, row count, and timeout strategies
- **Schema introspection and migration** — `introspect()`, `diff()`, `applyDiff()` — no CLI needed
- **Middleware pipeline** — `db.use()` for logging, metrics, safety guards, tracing
- **CTE, JOIN, UNION, subqueries** — full SQL composition
- **Expression helpers** — `eq`, `and`, `or`, `inList`, `isNull`, `like`, `ilike`, `raw`, etc.
- **Aggregate helpers** — `count`, `sum`, `avg`, `min`, `max`
- **Infer types** — `InferRow<S>`, `InferSelect<S, F>` for subset field selection
- **Runtime agnostic** — Bun, Node.js, Deno

## Benchmarks

Full results at **[github.com/coderbuzz/benchmarks](https://github.com/coderbuzz/benchmarks)**.

SQL query compilation throughput on Apple M-series, Bun runtime. Higher is better.

| Scenario | @coderbuzz/sql | Kysely | Factor vs Kysely | Drizzle ORM | Factor vs Drizzle |
|---|---|---|---|---|---|
| SELECT simple | **1,700,391 ops/s** | 561,869 | **3.0x** | 34,239 | **49.7x** |
| SELECT JOIN (2 tables) | **2,208,322 ops/s** | 310,690 | **7.1x** | 16,801 | **131.4x** |
| INSERT single row | **2,954,261 ops/s** | 393,159 | **7.5x** | 55,085 | **53.6x** |
| INSERT batch 100 rows | **134,187 ops/s** | 17,634 | **7.6x** | 914 | **146.8x** |
| CTE (WITH clause) | **831,703 ops/s** | 224,893 | **3.7x** | 12,222 | **68.0x** |
| 10 nested WHERE conditions | **656,309 ops/s** | 117,064 | **5.6x** | 12,692 | **51.7x** |

`@coderbuzz/sql` is 3-7x faster than Kysely and 50-147x faster than Drizzle ORM across every query type. The gap widens with query complexity (batch, JOIN, conditions) due to `@coderbuzz/sql`'s zero-overhead string compilation strategy vs Kysely's AST-based approach and Drizzle's ORM abstraction layer.

---

## Installation

```sh
# npm / Bun / pnpm / yarn
bun add @coderbuzz/sql
```

Install the driver for your database:

```sh
bun add pg                   # PostgreSQL
bun add mysql2               # MySQL / MariaDB
bun add mssql                # SQL Server
bun add better-sqlite3       # SQLite (Node.js)
bun add oracledb             # Oracle
bun add snowflake-sdk        # Snowflake
bun add @databricks/sql      # Databricks
```

SQLite on Bun uses `bun:sqlite` (built-in, no driver needed).
SQLite on Deno uses `@db/sqlite`.

---

## Supported Databases

| Database | Subpath | Namespace | Driver |
|---|---|---|---|
| SQLite | `@coderbuzz/sql/sqlite` | `sqlite` | `bun:sqlite`, `better-sqlite3`, `node:sqlite`, `@db/sqlite` |
| PostgreSQL | `@coderbuzz/sql/postgres` | `pg` | `pg` |
| MySQL / MariaDB | `@coderbuzz/sql/mysql` | `mysql` | `mysql2` |
| SQL Server | `@coderbuzz/sql/mssql` | `mssql` | `mssql` |
| ClickHouse | `@coderbuzz/sql/clickhouse` | `ch` | Native `fetch` HTTP |
| Oracle | `@coderbuzz/sql/oracle` | `oracle` | `oracledb` |
| Snowflake | `@coderbuzz/sql/snowflake` | `snowflake` | `snowflake-sdk` |
| Databricks / Spark SQL | `@coderbuzz/sql/databricks` | `databricks` | `@databricks/sql` |

---

## Quick Start

```ts
import { sqlite } from "@coderbuzz/sql/sqlite";

const db = sqlite.connect({ path: ":memory:" });

const users = sqlite.table("users", {
  id: sqlite.integer().primaryKey(),
  email: sqlite.text().notNull().unique(),
  name: sqlite.text().notNull(),
  active: sqlite.boolean().default(true),
  created_at: sqlite.datetime().defaultNow(),
});

await db.migrate(users);

await users.insert(db)
  .values([{ id: 1, email: "ada@example.com", name: "Ada Lovelace", active: true }])
  .execute();

const rows = await users.from(db)
  .fields("id", "email", "name")
  .where(sqlite.eq("active", true))
  .order_by("id DESC")
  .limit(10)
  .execute();
// rows typed as Array<{ id: number; email: string; name: string }>

db.close();
```

---

## Core Concepts

| Concept | What it does |
|---|---|
| **Dialect namespace** | One-stop API for a database: `connect`, `table`, column types, expression helpers |
| **Table schema** | Defines columns once, then reuses them for DDL and typed queries |
| **Query builder** | Builds SELECT, INSERT, UPDATE, and DELETE queries fluently |
| **Engine** | Executes compiled SQL through the selected database driver |

---

## Schema Definition

### Define a Table

```ts
import { pg } from "@coderbuzz/sql/postgres";

const accounts = pg.table("accounts", {
  id: pg.serial().primaryKey(),
  email: pg.text().notNull().unique().index(),
  display_name: pg.varchar(120).notNull(),
  balance: pg.decimal(12, 2).default(0),
  metadata: pg.jsonb<Record<string, unknown>>().nullable(),
  created_at: pg.timestamptz().defaultNow(),
});
```

### Column Modifiers

| Modifier | Purpose |
|---|---|
| `.primaryKey()` | Mark as primary key |
| `.notNull()` | Disallow NULL |
| `.nullable()` | Allow NULL, infer `T \| null` |
| `.index()` | Generate a standalone index |
| `.unique()` | Add unique constraint |
| `.default(value)` | Add default value |
| `.defaultNow()` | Add `NOW()` as default |

### Infer Row Types

```ts
import type { InferRow } from "@coderbuzz/sql";
type AccountRow = InferRow<typeof accounts.columns>;
// { id: number; email: string; display_name: string; balance: number; ... }
```

### Bind a Table to an Engine

```ts
const boundUsers = users.bind(db);
await boundUsers.create();
await boundUsers.insert().values([{ id: 1, email: "ada@example.com", name: "Ada" }]).execute();
const rows = await boundUsers.from().fields("id", "email").where({ id: 1 }).execute();
await boundUsers.drop();
```

---

## DDL and Migration

### Generate DDL

```ts
const createTableSql = users.createTable("postgres");
const indexSql = users.createIndexes("postgres");
const dropSql = users.dropTable();
```

### Run Simple Migration

```ts
await db.migrate(users, posts, comments);
```

### Schema Migration Utilities

Introspect, diff, and apply schema changes:

```ts
import { introspect } from "@coderbuzz/sql/dist/migration/introspect";
import { diff } from "@coderbuzz/sql/dist/migration/diff";
import { applyDiff } from "@coderbuzz/sql/dist/migration/apply";
import { sqliteCompiler } from "@coderbuzz/sql/dist/dialects/sqlite";

const db = sqlite.connect({ path: "./app.db" });
const usersV2 = sqlite.table("users", {
  id: sqlite.integer().primaryKey(),
  email: sqlite.text().notNull().unique(),
  name: sqlite.text().notNull(),
  bio: sqlite.text().nullable(), // new column
});

const live = await introspect(db);
const diffs = diff(live, [usersV2.toAst()]);
const stmts = applyDiff(diffs, sqliteCompiler);

for (const stmt of stmts) {
  await db.execute(stmt);
}
```

**Dialect support:**

| Dialect | ADD COLUMN | DROP COLUMN | ALTER COLUMN |
|---|---|---|---|
| SQLite | ✓ | skipped (warns) | skipped (warns) |
| PostgreSQL | ✓ | ✓ | ✓ |
| MySQL | ✓ | ✓ | ✓ (MODIFY) |
| MSSQL | ✓ | ✓ | ✓ |

---

## SELECT Queries

```ts
// Basic
const rows = await db.select("*").from("users").where({ active: true }).order_by("id DESC").limit(20).execute();

// Typed from table
const rows = await users.from(db).fields("id", "email", "name").where(pg.eq("active", true)).execute();

// With aliases and computed fields
const rows = await users.from(db)
  .fields("id", ["email", "userEmail"], expr<string>("UPPER(name)", "upperName"))
  .execute();

// DISTINCT
const rows = await db.select_distinct("country").from("users").execute();

// JOIN
const rows = await db.select("u.id", "u.email", "p.title")
  .from("users u").left_join("posts p", "p.user_id = u.id")
  .where(pg.eq("u.active", true)).execute();

// GROUP BY / HAVING
const rows = await db.select("user_id", "COUNT(*) AS total")
  .from("posts").group_by("user_id").having("COUNT(*) > 3").execute();

// CTE
const rows = await db
  .with("active_users", (q) => q.select("id", "email").from("users").where({ active: true }))
  .select("*").from("active_users").execute();

// Subquery
const sub = db.select("user_id", "COUNT(*) AS cnt").from("orders").group_by("user_id");
const rows = await db.select("*").from({ query: sub, alias: "order_counts" }).execute();

// UNION / INTERSECT / EXCEPT
const active = db.select("id").from("users").where({ active: true });
const invited = db.select("user_id AS id").from("invites");
const rows = await active.union(invited).execute();

// Compile without executing
const compiled = users.from(db).fields("id", "email").where({ active: true }).toSQL();
console.log(compiled.sql); // "SELECT "id", "email" FROM users WHERE active = ?"
console.log(compiled.params); // [true]
```

### Explain Query

```ts
const plan = await users.from(db).where({ id: 1 }).explain().execute();
```

---

## WHERE Conditions

### Object Conditions

```ts
await users.from(db).where({ active: true, role: "admin" }).execute();
// WHERE active = ? AND role = ?

await users.from(db).where({ id: [1, 2, 3] }).execute();
// WHERE id IN (?, ?, ?)

await users.from(db).where({ score: ">= 90", deleted_at: "IS NULL" }).execute();
// WHERE score >= 90 AND deleted_at IS NULL
```

### Logical Groups

```ts
await users.from(db).where({
  or: [{ role: "admin" }, { role: "owner" }],
}).execute();
// WHERE (role = ? OR role = ?)

await users.from(db).where({
  and: [{ active: true }, { not: { role: "banned" } }],
}).execute();
```

### Expression Helpers

```ts
await users.from(db).where(
  pg.and(
    pg.eq("active", true),
    pg.gte("score", 90),
    pg.like("email", "%@example.com"),
  ),
).execute();
```

All helpers: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `inList`, `isNull`, `isNotNull`, `and`, `or`, `not`, `raw`.

---

## INSERT Queries

```ts
await users.insert(db)
  .values([
    { email: "ada@example.com", name: "Ada", active: true },
    { email: "grace@example.com", name: "Grace", active: true },
  ])
  .execute();

// With RETURNING (PostgreSQL, SQLite)
const inserted = await users.insert(db)
  .values([{ email: "ada@example.com", name: "Ada" }])
  .returning("id", "email")
  .execute();

// Upsert (ON CONFLICT)
await db.insert_into("users", {
  onConflict: { type: "do_update", columns: ["email"], set: { name: "Ada Updated" } },
}).values([{ email: "ada@example.com", name: "Ada" }]).execute();
```

### ClickHouse INSERT with SETTINGS

```ts
await events.insert(db)
  .options({ settings: { async_insert: "1", wait_for_async_insert: "0" } })
  .values([{ id: "uuid", tenant_id: "acme", event_type: "click", score: 1.25 }])
  .execute();
```

---

## Batch Insert

High-throughput ingestion with debounce, row count, and timeout strategies:

```ts
const batcher = db.batchInsert("events", {
  wait: 50,        // flush after 50ms of inactivity
  max: 5_000,      // flush when 5000 rows are pending
  timeout: 2_000,  // force flush after 2000ms
});

for (const event of events) {
  batcher.write(event);
}

await batcher.close(); // flush remaining + wait for all in-flight requests
```

### ClickHouse High-Throughput Example

```ts
const batcher = db.batchInsert("events", {
  wait: 25, max: 10_000, timeout: 1_000,
  settings: { async_insert: "1", wait_for_async_insert: "0" },
});

for (let i = 0; i < 100_000; i++) {
  batcher.write({
    id: crypto.randomUUID(), tenant_id: "acme",
    event_type: i % 2 === 0 ? "view" : "click",
    score: Math.random(), created_at: new Date(),
  });
}
await batcher.close();
```

---

## UPDATE Queries

```ts
await users.update(db).set({ active: false }).where(pg.eq("id", 42)).execute();

// With RETURNING
const updated = await users.update(db)
  .set({ name: "Ada Updated" }).where({ id: 1 })
  .returning("id", "name").execute();

// Inspect SQL
const compiled = users.update(db).set({ score: 100 }).where({ id: 5 }).toSQL();
```

---

## DELETE Queries

```ts
await users.delete(db).where({ id: 1 }).execute();
// Or via engine
await db.delete_from("users").where(pg.lt("created_at", new Date("2024-01-01"))).execute();
```

**Warning:** `.delete()` without `.where()` deletes all rows. Use middleware to guard.

---

## Raw SQL

```ts
const email = "ada@example.com";
const rows = await db.sql`
  SELECT id, email, name FROM users WHERE email = ${email}
`.execute();

// Typed
type UserRow = { id: number; email: string; name: string };
const rows = await db.sql<UserRow[]>`
  SELECT id, email, name FROM users WHERE active = ${true}
`.execute();

// Dialect-aware placeholders
const q = pgDb.sql`SELECT * FROM users WHERE id = ${5} AND name = ${"Bob"}`;
// q.sql: "SELECT * FROM users WHERE id = $1 AND name = $2"
```

SQL injection safe — values are **never** inlined in SQL text.

---

## Transactions

```ts
await db.transaction(async (tx) => {
  await users.insert(tx).values([{ email: "ada@example.com", name: "Ada" }]).execute();
  await auditLog.insert(tx).values([{ action: "user.created", actor: "system" }]).execute();
});
// Auto-rollback on error
```

---

## Middleware

```ts
// Query logging
db.use(async (query, next) => {
  const start = performance.now();
  try {
    return await next();
  } finally {
    console.log("[sql]", query.sql, query.params, `${performance.now() - start}ms`);
  }
});

// Safety guard — block DELETE without WHERE
db.use(async (query, next) => {
  const sql = query.sql.trim().toLowerCase();
  if ((sql.startsWith("delete from") || sql.startsWith("update ")) && !sql.includes(" where ")) {
    throw new Error(`Unsafe query blocked: ${query.sql}`);
  }
  return next();
});

// Tracing
db.use(async (query, next) => {
  const span = tracer.startSpan("db.query");
  try { return await next(); }
  finally { span.end(); }
});
```

---

## Streaming and Prepared Queries

### Stream Rows

```ts
for await (const row of users.from(db).where({ active: true }).stream()) {
  console.log(row);
}
```

Supported by: SQLite (Bun), PostgreSQL.

### Prepared Queries

```ts
const prepared = users.from(db).where({ id: 1 }).prepare();
const rows = await prepared.execute();
prepared.close();
```

Supported by: SQLite (Bun), PostgreSQL.

---

## Aggregate Helpers

```ts
import { avg, count, max, min, sum } from "@coderbuzz/sql";

const stats = await orders.from(db)
  .fields(
    "customer_id",
    count("*", "orderCount"),
    sum("total", "totalSpent"),
    avg("total", "averageOrder"),
    min<Date>("created_at", "firstOrderAt"),
    max<Date>("created_at", "lastOrderAt"),
  )
  .group_by("customer_id")
  .execute();
```

---

## Dialect Namespaces

Each namespace includes: `connect(config)`, `table(name, schema, options?)`, column factories, and expression helpers.

### SQLite

```ts
const db = sqlite.connect({ path: "./app.db", readonly: false, create: true });
```

WAL mode enabled automatically for file-based databases.

### PostgreSQL

```ts
const db = pg.connect({ connectionString: process.env.DATABASE_URL, max: 10 });
```

### MySQL

```ts
const db = mysql.connect({ host: "localhost", port: 3306, database: "app", user: "root", password: "secret", connectionLimit: 10 });
```

### SQL Server

```ts
const db = mssql.connect({ server: "localhost", port: 1433, database: "app", user: "sa", password: "YourStrongPassword!", options: { trustServerCertificate: true } });
```

### ClickHouse

```ts
const db = ch.connect({ url: "http://localhost:8123", database: "default", username: "default", password: "" });
```

### Oracle, Snowflake, Databricks

See the full API reference for connection config details.

---

## Dialect Behavior Notes

| Feature | Notes |
|---|---|
| Placeholders | `?` (SQLite/MySQL/ClickHouse), `$N` (PostgreSQL), `@pN` (MSSQL), `:N` (Oracle) |
| `RETURNING` | PostgreSQL and SQLite only |
| Full outer join | Not supported by SQLite, MySQL, or ClickHouse |
| ClickHouse params | Escaped and inlined into SQL (no native binding) |
| ClickHouse indexes | Part of ENGINE definition |
| MSSQL limit without order | Injects `ORDER BY (SELECT NULL)` automatically |
| SQLite WAL mode | Enabled automatically for file-based DBs |
| Identifier quoting | `"quotes"` (PG, SQLite, Oracle, Snowflake), backticks (MySQL, ClickHouse, Databricks), `[brackets]` (MSSQL) |

---

## API Reference

### `Sql<T>` (Base Engine)

```ts
db.use(middleware): this
await db.execute(queryOrSql): Promise<T>
await db.transaction(fn): Promise<R>
await db.migrate(...tables): Promise<void>
db.select(...fields): SelectQuery<T>
db.select_distinct(...fields): SelectQuery<T>
db.insert_into(table, options?): InsertQuery<T>
db.batchInsert(table, options): InsertBatcher<T>
db.update(table): UpdateQuery<T>
db.delete_from(table): DeleteQuery<T>
db.sql<R>(strings, ...values): RawQuery<R>
db.dialect: string
db.compiler: BaseCompiler
```

### `SqlTable<S>`

```ts
table.tableName, table.columns, table.options
table.toAst(), table.createTable(), table.createIndexes(), table.dropTable()
table.from(engine), table.select(), table.insert(), table.update(), table.delete()
table.bind(engine): BoundTable<S>
```

### `SelectQuery<T>`

Full chain: `.with()`, `.select()`, `.from()`, `.left_join()`, `.inner_join()`, `.right_join()`, `.full_join()`, `.where()`, `.group_by()`, `.having()`, `.order_by()`, `.limit()`, `.union()`, `.union_all()`, `.intersect()`, `.except()`, `.toSQL()`, `.explain()`, `.explain_analyze()`, `.execute()`, `.stream()`, `.prepare()`

### `InsertBatcher<T>`

```ts
batcher.write(rowOrRows): void
await batcher.flush(), await batcher.drain(), await batcher.close()
batcher.pendingCount, batcher.inflightCount
```

---

## Complete Examples

### SQLite CRUD

```ts
import { sqlite } from "@coderbuzz/sql/sqlite";

const db = sqlite.connect({ path: ":memory:" });

const users = sqlite.table("users", {
  id: sqlite.integer().primaryKey(),
  email: sqlite.text().notNull().unique(),
  name: sqlite.text().notNull(),
  active: sqlite.boolean().default(true),
});

await db.migrate(users);

await users.insert(db)
  .values([
    { id: 1, email: "ada@example.com", name: "Ada", active: true },
    { id: 2, email: "grace@example.com", name: "Grace", active: true },
  ])
  .execute();

const activeUsers = await users.from(db)
  .fields("id", "email", "name")
  .where(sqlite.eq("active", true))
  .order_by("id ASC")
  .execute();

await users.update(db).set({ active: false }).where({ id: 2 }).execute();
await users.delete(db).where({ id: 1 }).execute();
db.close();
```

### PostgreSQL Transaction with RETURNING

```ts
import { pg } from "@coderbuzz/sql/postgres";

const db = pg.connect({ connectionString: process.env.DATABASE_URL });

const accounts = pg.table("accounts", {
  id: pg.serial().primaryKey(),
  owner: pg.text().notNull(),
  balance: pg.decimal(12, 2).default(0),
});

await db.migrate(accounts);

await db.transaction(async (tx) => {
  const [inserted] = await accounts.insert(tx)
    .values([{ owner: "Ada", balance: 1000 }])
    .returning("id", "owner")
    .execute() as { id: number; owner: string }[];

  await accounts.update(tx)
    .set({ balance: 900 })
    .where({ id: inserted.id })
    .execute();
});

await db.close();
```

---

## License

MIT © 2026 Indra Gunawan
