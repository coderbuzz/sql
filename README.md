<!-- docs: sync from coderbuzz/codex@0063efc -->

# @coderbuzz/sql

Runtime-agnostic TypeScript SQL toolkit for **Bun**, **Node.js**, and **Deno**.
Schema-driven table definitions, fluent query builders, dialect-aware SQL
compilation, engine adapters, safe raw SQL, transactions, streaming, prepared
queries, high-throughput batch inserts, and schema migration utilities.

## Table of Contents

- [Installation](#installation)
- [Supported Databases](#supported-databases)
- [Import Guide](#import-guide)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
- [Schema Definition](#schema-definition)
- [DDL and Migration](#ddl-and-migration)
- [Schema Migration Utilities](#schema-migration-utilities)
- [SELECT Queries](#select-queries)
- [WHERE Conditions](#where-conditions)
- [Expression Helpers](#expression-helpers)
- [INSERT Queries](#insert-queries)
- [Batch Insert](#batch-insert)
- [UPDATE Queries](#update-queries)
- [DELETE Queries](#delete-queries)
- [Raw SQL](#raw-sql)
- [Transactions](#transactions)
- [Middleware](#middleware)
- [Streaming and Prepared Queries](#streaming-and-prepared-queries)
- [Aggregate Helpers](#aggregate-helpers)
- [Dialect Namespaces](#dialect-namespaces)
- [Column Type Reference](#column-type-reference)
- [Dialect Behavior Notes](#dialect-behavior-notes)
- [API Reference](#api-reference)
- [Complete Examples](#complete-examples)

## Installation

`@coderbuzz/sql` is runtime-agnostic and works in **Bun**, **Node.js**, and
**Deno**. Bun is the primary runtime and has the smoothest SQLite experience
because `bun:sqlite` is built in.

### Bun

```sh
bun add @coderbuzz/sql
```

Install the driver for the database you use:

```sh
# PostgreSQL
bun add pg

# MySQL / MariaDB
bun add mysql2

# SQL Server
bun add mssql

# SQLite on Node.js
bun add better-sqlite3

# Oracle
bun add oracledb

# Snowflake
bun add snowflake-sdk

# Databricks
bun add @databricks/sql
```

SQLite on Bun uses `bun:sqlite` and does not need an extra driver:

```ts
import { sqlite } from "@coderbuzz/sql/sqlite";

const db = sqlite.connect({ path: ":memory:" });
```

### Node.js

```sh
npm install @coderbuzz/sql
# or
pnpm add @coderbuzz/sql
# or
yarn add @coderbuzz/sql
```

Install the driver for your database:

```sh
# PostgreSQL
npm install pg

# MySQL / MariaDB
npm install mysql2

# SQL Server
npm install mssql

# SQLite
npm install better-sqlite3

# Oracle
npm install oracledb

# Snowflake
npm install snowflake-sdk

# Databricks
npm install @databricks/sql
```

SQLite on Node.js uses `better-sqlite3` when installed, with automatic fallback
to Node's built-in `node:sqlite` on compatible Node versions.

### Deno

Use NPM imports:

```ts
import { sqlite } from "npm:@coderbuzz/sql/sqlite";
import { pg } from "npm:@coderbuzz/sql/postgres";
```

For SQLite on Deno, install/use the `@db/sqlite` NPM package:

```ts
import { sqlite } from "npm:@coderbuzz/sql/sqlite";

const db = sqlite.connect({ path: "./app.db" });
```

## Supported Databases

| Database               | Subpath                     | Namespace    | Driver                                                         |
| ---------------------- | --------------------------- | ------------ | -------------------------------------------------------------- |
| SQLite                 | `@coderbuzz/sql/sqlite`     | `sqlite`     | `bun:sqlite`, `better-sqlite3`, `node:sqlite`, or `@db/sqlite` |
| PostgreSQL             | `@coderbuzz/sql/postgres`   | `pg`         | `pg`                                                           |
| MySQL / MariaDB        | `@coderbuzz/sql/mysql`      | `mysql`      | `mysql2`                                                       |
| SQL Server             | `@coderbuzz/sql/mssql`      | `mssql`      | `mssql`                                                        |
| ClickHouse             | `@coderbuzz/sql/clickhouse` | `ch`         | Native `fetch` HTTP client                                     |
| Oracle                 | `@coderbuzz/sql/oracle`     | `oracle`     | `oracledb`                                                     |
| Snowflake              | `@coderbuzz/sql/snowflake`  | `snowflake`  | `snowflake-sdk`                                                |
| Databricks / Spark SQL | `@coderbuzz/sql/databricks` | `databricks` | `@databricks/sql`                                              |

## Import Guide

Use dialect namespaces for most application code:

```ts
import { sqlite } from "@coderbuzz/sql/sqlite";
import { pg } from "@coderbuzz/sql/postgres";
import { mysql } from "@coderbuzz/sql/mysql";
import { mssql } from "@coderbuzz/sql/mssql";
import { ch } from "@coderbuzz/sql/clickhouse";
import { oracle } from "@coderbuzz/sql/oracle";
import { snowflake } from "@coderbuzz/sql/snowflake";
import { databricks } from "@coderbuzz/sql/databricks";
```

Use root exports for shared classes, helpers, and types:

```ts
import {
  avg,
  type CompiledQuery,
  count,
  DeleteQuery,
  expr,
  type InferRow,
  type InferSelect,
  InsertBatcher,
  InsertQuery,
  max,
  min,
  SelectQuery,
  Sql,
  SqlColumn,
  SqlTable,
  sum,
  UpdateQuery,
} from "@coderbuzz/sql";
```

Use type-only subpaths to access column factories without importing an engine:

```ts
import * as pgTypes from "@coderbuzz/sql/postgres-types";
import * as sqliteTypes from "@coderbuzz/sql/sqlite-types";
import * as clickhouseTypes from "@coderbuzz/sql/clickhouse-types";
import * as mysqlTypes from "@coderbuzz/sql/mysql-types";
import * as mssqlTypes from "@coderbuzz/sql/mssql-types";
import * as oracleTypes from "@coderbuzz/sql/oracle-types";
import * as snowflakeTypes from "@coderbuzz/sql/snowflake-types";
import * as databricksTypes from "@coderbuzz/sql/databricks-types";
```

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
  .values([
    {
      id: 1,
      email: "ada@example.com",
      name: "Ada Lovelace",
      active: true,
      created_at: new Date(),
    },
  ])
  .execute();

const rows = await users.from(db)
  .fields("id", "email", "name")
  .where(sqlite.eq("active", true))
  .order_by("id DESC")
  .limit(10)
  .execute();

console.log(rows);
// rows is typed as Array<{ id: number; email: string; name: string }>

db.close();
```

## Core Concepts

`@coderbuzz/sql` has four main pieces:

| Concept               | What it does                                                                      |
| --------------------- | --------------------------------------------------------------------------------- |
| **Dialect namespace** | One-stop API for a database: `connect`, `table`, column types, expression helpers |
| **Table schema**      | Defines columns once, then reuses them for DDL and typed queries                  |
| **Query builder**     | Builds `SELECT`, `INSERT`, `UPDATE`, and `DELETE` queries fluently                |
| **Engine**            | Executes compiled SQL through the selected database driver                        |

Typical flow:

```ts
const db = pg.connect(config);
const users = pg.table("users", schema);

await db.migrate(users);
await users.insert(db).values(rows).execute();
await users.from(db).where(pg.eq("id", 1)).execute();
```

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

Column modifiers are immutable — each call returns a new `SqlColumn` instance.

| Modifier          | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `.primaryKey()`   | Mark column as primary key                       |
| `.notNull()`      | Disallow `NULL`                                  |
| `.nullable()`     | Allow `NULL` and infer `T \| null` in TypeScript |
| `.index()`        | Generate a standalone index where supported      |
| `.unique()`       | Add unique constraint where supported            |
| `.default(value)` | Add default value to DDL                         |
| `.defaultNow()`   | Add `NOW()` as default                           |

Legacy ALL_CAPS modifiers are still supported for backward compatibility:

```ts
sqlite.integer().PRIMARY();
sqlite.text().NOT_NULL();
sqlite.text().ALLOW_NULL();
sqlite.text().INDEX();
sqlite.integer().DEFAULT(0);
```

Prefer camelCase modifiers in new code.

### Infer Row Types

```ts
import type { InferRow } from "@coderbuzz/sql";

type AccountRow = InferRow<typeof accounts.columns>;
// {
//   id: number;
//   email: string;
//   display_name: string;
//   balance: number;
//   metadata: Record<string, unknown> | null;
//   created_at: Date;
// }
```

### Infer Selected Field Types

Use `InferSelect` for type-narrowing when selecting a subset of columns:

```ts
import type { InferSelect } from "@coderbuzz/sql";

type UserPreview = InferSelect<
  typeof users.columns,
  ["id", "email", "name"]
>;
// { id: number; email: string; name: string }
```

### Bind a Table to an Engine

Use `bind()` when one module owns a table and engine pair, avoiding the need to
pass the engine on every call:

```ts
const boundUsers = users.bind(db);

await boundUsers.create(); // CREATE TABLE IF NOT EXISTS users (...)

await boundUsers.insert()
  .values([{ id: 1, email: "ada@example.com", name: "Ada" }])
  .execute();

const rows = await boundUsers.from()
  .fields("id", "email")
  .where({ id: 1 })
  .execute();

await boundUsers.drop(); // DROP TABLE IF EXISTS users
```

## DDL and Migration

### Generate DDL

```ts
const createTableSql = users.createTable("postgres");
const indexSql = users.createIndexes("postgres");
const dropSql = users.dropTable();
```

Execute manually:

```ts
await db.execute(users.createTable(db.dialect));

for (const sql of users.createIndexes(db.dialect)) {
  await db.execute(sql);
}
```

### Run Simple Migration

`migrate(...tables)` creates tables and indexes using
`CREATE TABLE IF NOT EXISTS` where supported. Safe to call repeatedly.

```ts
await db.migrate(users, posts, comments);
```

`migrate()` does not alter existing tables or drop columns. Use it for initial
schema creation and idempotent startup setup. Use the migration utilities below
for schema evolution.

### ClickHouse Table Options

ClickHouse supports engine-level table options via the third argument of
`ch.table()`:

```ts
const events = ch.table("events", {
  id: ch.uuid(),
  tenant_id: ch.string().index(),
  event_type: ch.lowCardinality("String"),
  score: ch.float64(),
  created_at: ch.datetime64(3),
}, {
  engine: "MergeTree()",
  orderBy: ["tenant_id", "created_at"],
  partitionBy: "toYYYYMM(created_at)",
});

await db.migrate(events);
```

## Schema Migration Utilities

`@coderbuzz/sql` includes three migration utilities: `introspect`, `diff`, and
`applyDiff`. These let you compare a live database schema against your
TypeScript table definitions and generate the necessary `ALTER TABLE`
statements.

> **Note**: These utilities are in `dist/migration/` — a direct path import.
> They are not part of the main dialect namespace.

### introspect(db)

Queries the live database and returns `CreateTableNode[]` representing the
current schema. Supported dialects: SQLite, PostgreSQL, MySQL, MSSQL.

```ts
import { introspect } from "@coderbuzz/sql/dist/migration/introspect";

const live = await introspect(db);
// live: CreateTableNode[]  — one entry per table
```

### diff(live, target)

Computes column-level differences between the live schema and your target schema
(expressed as `table.toAst()` results).

```ts
import { diff } from "@coderbuzz/sql/dist/migration/diff";

const live = await introspect(db);
const diffs = diff(live, [usersTable.toAst(), postsTable.toAst()]);
// diffs: TableDiff[]
```

`TableDiff` shape:

```ts
interface TableDiff {
  tableName: string;
  addColumns: ColumnDefNode[]; // columns in target but not in live
  dropColumns: string[]; // columns in live but not in target
  alterColumns: { from: ColumnDefNode; to: ColumnDefNode }[];
  addIndexes: CreateIndexNode[];
  dropIndexes: string[];
}
```

Rules:

- Tables only in target → returned as an `addColumns` diff with all target
  columns (signal to CREATE TABLE).
- Tables only in live → ignored (no DROP TABLE by default — safe default).

### applyDiff(diffs, compiler)

Converts `TableDiff[]` into `ALTER TABLE` SQL statements.

```ts
import { applyDiff } from "@coderbuzz/sql/dist/migration/apply";
import { sqliteCompiler } from "@coderbuzz/sql/dist/dialects/sqlite";

const stmts = applyDiff(diffs, sqliteCompiler);
for (const stmt of stmts) {
  await db.execute(stmt);
}
```

Dialect support:

| Dialect    | ADD COLUMN  | DROP COLUMN     | ALTER COLUMN    |
| ---------- | ----------- | --------------- | --------------- |
| SQLite     | ✓           | skipped (warns) | skipped (warns) |
| PostgreSQL | ✓           | ✓               | ✓               |
| MySQL      | ✓           | ✓               | ✓ (MODIFY)      |
| MSSQL      | ✓           | ✓               | ✓               |
| Others     | best-effort | best-effort     | best-effort     |

### Full Migration Round-Trip Example

```ts
import { sqlite } from "@coderbuzz/sql/sqlite";
import { introspect } from "@coderbuzz/sql/dist/migration/introspect";
import { diff } from "@coderbuzz/sql/dist/migration/diff";
import { applyDiff } from "@coderbuzz/sql/dist/migration/apply";
import { sqliteCompiler } from "@coderbuzz/sql/dist/dialects/sqlite";

const db = sqlite.connect({ path: "./app.db" });

// V2 schema (with new columns)
const usersV2 = sqlite.table("users", {
  id: sqlite.integer().primaryKey(),
  name: sqlite.text().notNull(),
  email: sqlite.text().nullable(), // new column
  bio: sqlite.text().nullable(), // new column
});

const live = await introspect(db);
const diffs = diff(live, [usersV2.toAst()]);
const stmts = applyDiff(diffs, sqliteCompiler);

if (stmts.length === 0) {
  console.log("Schema is up to date.");
} else {
  console.log(`Applying ${stmts.length} migration(s)...`);
  for (const stmt of stmts) {
    await db.execute(stmt);
  }
}
```

## SELECT Queries

### Basic SELECT

```ts
const rows = await db.select("*")
  .from("users")
  .where({ active: true })
  .order_by("id DESC")
  .limit(20)
  .execute();
```

### Typed SELECT from a Table

```ts
const rows = await users.from(db)
  .fields("id", "email", "name")
  .where(pg.eq("active", true))
  .execute();

// rows: Array<{ id: number; email: string; name: string }>
```

### SELECT with Aliases and Computed Fields

```ts
import { expr } from "@coderbuzz/sql";

const rows = await users.from(db)
  .fields(
    "id",
    ["email", "userEmail"], // rename: result key is "userEmail"
    expr<string>("UPPER(name)", "upperName"), // computed expression
  )
  .execute();

// rows: Array<{ id: number; userEmail: string; upperName: string }>
```

### DISTINCT

```ts
const rows = await db.select_distinct("country")
  .from("users")
  .execute();
```

### JOIN

```ts
const rows = await db.select("u.id", "u.email", "p.title")
  .from("users u")
  .left_join("posts p", "p.user_id = u.id")
  .where(pg.eq("u.active", true))
  .execute();
```

Supported join methods:

- `.left_join(table, on)`
- `.inner_join(table, on)`
- `.right_join(table, on)`
- `.full_join(table, on)` — not supported by SQLite, MySQL, or ClickHouse

### GROUP BY and HAVING

```ts
const rows = await db.select("user_id", "COUNT(*) AS total")
  .from("posts")
  .group_by("user_id")
  .having("COUNT(*) > 3")
  .order_by("total DESC")
  .execute();
```

### LIMIT and OFFSET

```ts
const rows = await db.select("*")
  .from("users")
  .order_by("id ASC")
  .limit(50, 100) // limit(count, offset)
  .execute();
```

The compiler renders dialect-appropriate pagination syntax:

- Standard (SQLite, PostgreSQL, MySQL, ClickHouse): `LIMIT n OFFSET m`
- MSSQL and Oracle: `OFFSET n ROWS FETCH NEXT m ROWS ONLY`

### CTE (Common Table Expressions)

```ts
const rows = await db
  .with("active_users", (q) =>
    q.select("id", "email")
      .from("users")
      .where({ active: true }))
  .select("*")
  .from("active_users")
  .execute();
```

### Subquery in FROM

```ts
const sub = db.select("user_id", "COUNT(*) AS cnt")
  .from("orders")
  .group_by("user_id");

const rows = await db.select("*")
  .from({ query: sub, alias: "order_counts" })
  .where({ cnt: "> 5" })
  .execute();
```

### UNION, INTERSECT, EXCEPT

```ts
const active = db.select("id").from("users").where({ active: true });
const invited = db.select("user_id AS id").from("invites");

const rows = await active.union(invited).execute(); // UNION
const rows2 = await active.union_all(invited).execute(); // UNION ALL
const rows3 = await active.intersect(invited).execute(); // INTERSECT
const rows4 = await active.except(invited).execute(); // EXCEPT
```

### Compile Without Executing

```ts
const compiled = users.from(db)
  .fields("id", "email")
  .where({ active: true })
  .toSQL();

console.log(compiled.sql); // "SELECT "id", "email" FROM users WHERE active = ?"
console.log(compiled.params); // [true]
```

### Explain Query

```ts
const plan = await users.from(db)
  .where({ id: 1 })
  .explain()
  .execute();
```

`explain()` uses dialect-aware prefixes:

- SQLite: `EXPLAIN QUERY PLAN`
- PostgreSQL: `EXPLAIN ANALYZE`
- All others: `EXPLAIN`

`explain()` returns a `RawQuery` which is also destructurable as
`{ sql, params }`:

```ts
const { sql, params } = users.from(db).where({ id: 1 }).explain();
```

## WHERE Conditions

### Object Conditions

Simple key-value objects produce parameterised WHERE clauses:

```ts
await users.from(db)
  .where({
    active: true,
    role: "admin",
  })
  .execute();
// WHERE active = ? AND role = ?   params: [true, "admin"]
```

Array values become `IN (...)`:

```ts
await users.from(db)
  .where({ id: [1, 2, 3] })
  .execute();
// WHERE id IN (?, ?, ?)   params: [1, 2, 3]
```

String values starting with an operator are inlined directly (not
parameterised):

```ts
await users.from(db)
  .where({
    score: ">= 90",
    deleted_at: "IS NULL",
    status: "IS NOT NULL",
  })
  .execute();
// WHERE score >= 90 AND deleted_at IS NULL AND status IS NOT NULL
```

Operator prefixes: `=`, `!=`, `<>`, `>=`, `>`, `<=`, `<`, `LIKE`, `NOT LIKE`,
`IS`, `IS NOT`, `IN`, `NOT IN`.

### Logical Groups

```ts
// OR group
await users.from(db)
  .where({
    or: [
      { role: "admin" },
      { role: "owner" },
    ],
  })
  .execute();
// WHERE (role = ? OR role = ?)

// AND group
await users.from(db)
  .where({
    and: [
      { active: true },
      { not: { role: "banned" } },
    ],
  })
  .execute();
// WHERE (active = ? AND NOT (role = ?))
```

### Raw String in WHERE

```ts
await users.from(db)
  .where("created_at > NOW() - INTERVAL '7 days'")
  .execute();
```

## Expression Helpers

Each dialect namespace and the root package export typed expression helpers.
These produce AST nodes and are preferred for complex query composition:

```ts
await users.from(db)
  .where(pg.and(
    pg.eq("active", true),
    pg.gte("score", 90),
    pg.like("email", "%@example.com"),
  ))
  .execute();
```

Import directly from the root package:

```ts
import {
  and,
  eq,
  gt,
  gte,
  ilike,
  inList,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  ne,
  not,
  or,
  raw,
} from "@coderbuzz/sql";
```

| Helper                | SQL output          | Notes                         |
| --------------------- | ------------------- | ----------------------------- |
| `eq(col, value)`      | `col = ?`           | Parameterised                 |
| `ne(col, value)`      | `col != ?`          | Parameterised                 |
| `gt(col, value)`      | `col > ?`           | Parameterised                 |
| `gte(col, value)`     | `col >= ?`          | Parameterised                 |
| `lt(col, value)`      | `col < ?`           | Parameterised                 |
| `lte(col, value)`     | `col <= ?`          | Parameterised                 |
| `like(col, pattern)`  | `col LIKE ?`        | Pattern is parameterised      |
| `ilike(col, pattern)` | `col ILIKE ?`       | PostgreSQL case-insensitive   |
| `inList(col, values)` | `col IN (?, ...)`   | Values are parameterised      |
| `isNull(col)`         | `col IS NULL`       | No parameter                  |
| `isNotNull(col)`      | `col IS NOT NULL`   | No parameter                  |
| `and(...exprs)`       | `(a AND b AND ...)` | Logical AND group             |
| `or(...exprs)`        | `(a OR b OR ...)`   | Logical OR group              |
| `not(expr)`           | `NOT (...)`         | Logical NOT                   |
| `raw(sql, params?)`   | Raw SQL fragment    | Params appended to param list |

```ts
// Nesting logical operators
.where(and(
  eq("active", true),
  or(
    eq("role", "admin"),
    eq("role", "owner"),
  ),
  not(isNull("email")),
))

// raw() helper with params
.where(raw("created_at > NOW() - INTERVAL ? DAY", [7]))
```

## INSERT Queries

### Insert Rows

```ts
await users.insert(db)
  .values([
    { email: "ada@example.com", name: "Ada", active: true },
    { email: "grace@example.com", name: "Grace", active: true },
  ])
  .execute();
```

### Explicit Columns

```ts
await users.insert(db)
  .columns("email", "name")
  .values([
    { email: "ada@example.com", name: "Ada" },
  ])
  .execute();
```

### RETURNING

```ts
const inserted = await users.insert(db)
  .values([{ email: "ada@example.com", name: "Ada" }])
  .returning("id", "email")
  .execute();
```

`RETURNING` is supported by **PostgreSQL** and **SQLite** only. Calling
`.returning()` on an unsupported dialect throws at `.toSQL()` time:
`"RETURNING is not supported by this dialect"`.

### Conflict Handling (Upsert)

```ts
// INSERT ... ON CONFLICT DO NOTHING
await db.insert_into("users", {
  onConflict: {
    type: "do_nothing",
    columns: ["email"],
  },
})
  .values([{ email: "ada@example.com", name: "Ada" }])
  .execute();

// INSERT ... ON CONFLICT DO UPDATE
await db.insert_into("users", {
  onConflict: {
    type: "do_update",
    columns: ["email"],
    set: { name: "Ada Updated" },
  },
})
  .values([{ email: "ada@example.com", name: "Ada" }])
  .execute();
```

Conflict syntax varies by database — validate generated SQL for your dialect.

### ClickHouse INSERT SETTINGS

```ts
await events.insert(db)
  .options({
    settings: {
      async_insert: "1",
      wait_for_async_insert: "0",
    },
  })
  .values([
    {
      id: "00000000-0000-0000-0000-000000000001",
      tenant_id: "acme",
      event_type: "click",
      score: 1.25,
      created_at: new Date(),
    },
  ])
  .execute();
```

### Manual Flush (Batch Accumulation)

`InsertQuery` supports manual batch accumulation. Call `.values()` multiple
times and then `.flush()` to execute once:

```ts
const q = users.insert(db);
q.values([{ id: 10, name: "X" }]);
q.values([{ id: 11, name: "Y" }]);
await q.flush(); // executes one INSERT with both rows
```

## Batch Insert

Use `batchInsert()` for high-throughput ingestion. It accumulates rows and
flushes them in batches using debounce, row count, and timeout strategies.

```ts
const batcher = db.batchInsert("events", {
  wait: 50, // flush after 50ms of inactivity (required)
  max: 5_000, // flush when 5000 rows are pending
  timeout: 2_000, // force flush after 2000ms regardless
});

for (const event of events) {
  batcher.write(event);
}

await batcher.close(); // flush remaining + wait for all in-flight requests
```

### Batch Options

| Option     | Required | Default | Purpose                                                 |
| ---------- | -------- | ------- | ------------------------------------------------------- |
| `wait`     | Yes      | —       | Flush after this many ms of write inactivity (debounce) |
| `max`      | No       | `1000`  | Flush immediately when pending rows reach this count    |
| `timeout`  | No       | `5000`  | Force flush after first pending write waits this long   |
| `settings` | No       | —       | Engine-specific insert settings (e.g. ClickHouse)       |

### Write One Row or Many Rows

```ts
batcher.write({ id: 1, name: "one" });

batcher.write([
  { id: 2, name: "two" },
  { id: 3, name: "three" },
]);
```

### Manual Flush and Drain

```ts
await batcher.flush(); // flush pending rows now
await batcher.drain(); // wait for all in-flight auto-flushes
await batcher.close(); // flush + drain + prevent future writes
```

After `close()`, calling `write()` throws `"InsertBatcher is already closed"`.

### Inspect Batcher State

```ts
console.log(batcher.pendingCount); // rows waiting to be flushed
console.log(batcher.inflightCount); // active in-flight flush requests
```

### ClickHouse High-Throughput Example

```ts
import { ch } from "@coderbuzz/sql/clickhouse";

const db = ch.connect({
  url: "http://localhost:8123",
  database: "analytics",
});

const batcher = db.batchInsert("events", {
  wait: 25,
  max: 10_000,
  timeout: 1_000,
  settings: {
    async_insert: "1",
    wait_for_async_insert: "0",
  },
});

for (let i = 0; i < 100_000; i++) {
  batcher.write({
    id: crypto.randomUUID(),
    tenant_id: "acme",
    event_type: i % 2 === 0 ? "view" : "click",
    score: Math.random(),
    created_at: new Date(),
  });
}

await batcher.close();
```

## UPDATE Queries

```ts
await users.update(db)
  .set({ active: false })
  .where(pg.eq("id", 42))
  .execute();
```

Multiple `.set()` calls merge into one update:

```ts
await users.update(db)
  .set({ active: false })
  .set({ updated_at: new Date() })
  .where({ id: 1 })
  .execute();
```

### UPDATE with RETURNING

```ts
const updated = await users.update(db)
  .set({ name: "Ada Updated" })
  .where({ id: 1 })
  .returning("id", "name")
  .execute();
```

`RETURNING` is supported only by **PostgreSQL** and **SQLite**.

### Compile Without Executing

```ts
const compiled = users.update(db)
  .set({ score: 100 })
  .where({ id: 5 })
  .toSQL();

// compiled.sql:    "UPDATE users SET score = ? WHERE id = ?"
// compiled.params: [100, 5]
```

## DELETE Queries

```ts
await users.delete(db)
  .where({ id: 1 })
  .execute();
```

Delete through the engine directly:

```ts
await db.delete_from("users")
  .where(pg.lt("created_at", new Date("2024-01-01")))
  .execute();
```

> **Warning**: calling `.delete()` or `.delete_from()` without `.where()`
> deletes all rows in the table. Add a middleware guard if needed (see
> [Middleware](#middleware)).

## Raw SQL

Use `db.sql` as a tagged template for safe parameterized raw SQL. Values are
**never** inlined — they always become bound parameters.

```ts
const email = "ada@example.com";

const rows = await db.sql`
  SELECT id, email, name
  FROM users
  WHERE email = ${email}
`.execute();
```

### Typed Raw Result

```ts
type UserRow = {
  id: number;
  email: string;
  name: string;
};

const rows = await db.sql<UserRow[]>`
  SELECT id, email, name
  FROM users
  WHERE active = ${true}
`.execute();

// rows: UserRow[]
```

### Raw Query Object

The `db.sql` template returns a `RawQuery` which is both executable and
inspectable:

```ts
const query = db.sql`SELECT * FROM users WHERE id = ${1}`;

console.log(query.sql); // "SELECT * FROM users WHERE id = ?"
console.log(query.params); // [1]

await query.execute();
```

### Dialect-Aware Placeholders

The `db.sql` tagged template uses the correct placeholder style for the current
dialect:

```ts
// PostgreSQL — $1, $2, ...
const q = pgDb.sql`SELECT * FROM users WHERE id = ${5} AND name = ${"Bob"}`;
// q.sql: "SELECT * FROM users WHERE id = $1 AND name = $2"

// MSSQL — @p1, @p2, ...
const q2 = mssqlDb.sql`SELECT * FROM t WHERE id = ${3}`;
// q2.sql: "SELECT * FROM t WHERE id = @p1"
```

### Security

The tagged template prevents SQL injection by design:

```ts
const malicious = "'; DROP TABLE users; --";
const q = db.sql`SELECT * FROM users WHERE name = ${malicious}`;

// q.sql    → "SELECT * FROM users WHERE name = ?"
// q.params → ["'; DROP TABLE users; --"]
// The malicious string is NEVER in the SQL text
```

## Transactions

```ts
await db.transaction(async (tx) => {
  await users.insert(tx)
    .values([{ email: "ada@example.com", name: "Ada" }])
    .execute();

  await auditLog.insert(tx)
    .values([{ action: "user.created", actor: "system" }])
    .execute();
});
```

If the callback throws, the transaction rolls back automatically.

Engine notes:

- **Base engines** (SQLite, generic) use `BEGIN`, `COMMIT`, and `ROLLBACK`.
- **MySQL** checks out a single pool connection for the transaction scope.
- **MSSQL** uses an `mssql.Transaction`.
- **PostgreSQL** currently uses the base transaction path.

## Middleware

Middleware wraps every `execute()` call in registration order:

```ts
db.use(async (query, next) => {
  const start = performance.now();

  try {
    return await next();
  } finally {
    console.log(
      "[sql]",
      query.sql,
      query.params,
      `${performance.now() - start}ms`,
    );
  }
});
```

Multiple middlewares chain in registration order:

```ts
// Logging
db.use(async (query, next) => {
  console.log("[sql]", query.sql);
  return next();
});

// Safety guard — block DELETE without WHERE
db.use(async (query, next) => {
  const sql = query.sql.trim().toLowerCase();
  if (sql.startsWith("delete from") && !sql.includes(" where ")) {
    throw new Error("Refusing to execute DELETE without WHERE");
  }
  return next();
});

// Tracing
db.use(async (query, next) => {
  const span = tracer.startSpan("db.query");
  try {
    const result = await next();
    span.end();
    return result;
  } catch (e) {
    span.recordException(e as Error);
    span.end();
    throw e;
  }
});
```

## Streaming and Prepared Queries

### Stream Rows

```ts
for await (const row of users.from(db).where({ active: true }).stream()) {
  console.log(row);
}
```

`stream()` returns an `AsyncIterable`. Currently supported by:

- SQLite on Bun (uses `bun:sqlite` synchronous iterator)
- PostgreSQL (fetches all rows, yields one by one)

Unsupported engines throw:
`"Streaming is not supported by this dialect. Use SQLite or PostgreSQL."`

### Prepared Queries

```ts
const prepared = users.from(db)
  .where({ id: 1 })
  .prepare();

const rows = await prepared.execute();

prepared.close();
```

Currently supported by:

- SQLite on Bun (uses `bun:sqlite` statement caching)
- PostgreSQL (named prepared statements)

Unsupported engines throw:
`"Prepared statements are not supported by this dialect. Use SQLite or PostgreSQL."`

## Aggregate Helpers

Root exports include aggregate helpers that return `ComputedField<T>` values for
use in `.fields()`:

```ts
import { avg, count, max, min, sum } from "@coderbuzz/sql";

const rows = await orders.from(db)
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

// rows: Array<{
//   customer_id: number;
//   orderCount: number;
//   totalSpent: number;
//   averageOrder: number;
//   firstOrderAt: Date;
//   lastOrderAt: Date;
// }>
```

| Helper                  | SQL            | Default alias |
| ----------------------- | -------------- | ------------- |
| `count(field?, alias?)` | `COUNT(field)` | `"count"`     |
| `sum(field, alias?)`    | `SUM(field)`   | `"sum"`       |
| `avg(field, alias?)`    | `AVG(field)`   | `"avg"`       |
| `min<T>(field, alias?)` | `MIN(field)`   | `"min"`       |
| `max<T>(field, alias?)` | `MAX(field)`   | `"max"`       |

## Dialect Namespaces

Each namespace includes: `connect(config)`, `table(name, schema, options?)`,
column factories, and expression helpers (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`,
`like`, `ilike`, `inList`, `isNull`, `isNotNull`, `and`, `or`, `not`, `raw`).

### SQLite

```ts
import { sqlite, type SqliteConfig, SQLiteEngine } from "@coderbuzz/sql/sqlite";

const db = sqlite.connect({
  path: "./app.db",
  readonly: false,
  create: true,
});
```

Config:

| Option     | Type      | Default       | Description                         |
| ---------- | --------- | ------------- | ----------------------------------- |
| `path`     | `string`  | `":memory:"`  | File path or `:memory:`             |
| `readonly` | `boolean` | `false`       | Open in read-only mode              |
| `create`   | `boolean` | `true` on Bun | Create DB file if it does not exist |

SQLite enables `PRAGMA journal_mode = WAL` automatically for file-based
databases (improves write concurrency).

Column types: `char`, `varchar`, `text`, `clob`, `integer`, `int`, `smallint`,
`bigint`, `real`, `float`, `double`, `numeric`, `decimal`, `boolean`, `date`,
`time`, `datetime`.

### PostgreSQL

```ts
import {
  pg,
  type PostgresConfig,
  PostgresEngine,
} from "@coderbuzz/sql/postgres";

const db = pg.connect({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
```

Config:

| Option             | Type     | Description                  |
| ------------------ | -------- | ---------------------------- |
| `host`             | `string` | Default: `"localhost"`       |
| `port`             | `number` | Default: `5432`              |
| `database`         | `string` |                              |
| `user`             | `string` |                              |
| `password`         | `string` |                              |
| `connectionString` | `string` | Overrides individual options |
| `max`              | `number` | Pool size. Default: `10`     |

Postgres-specific column types: `serial`, `bigserial`, `uuid`, `jsonb<T>`,
`json<T>`, `text_array`, `inet`, `timestamptz`, `bytea`, `citext`. Plus all ANSI
types.

### MySQL / MariaDB

```ts
import { mysql, type MySQLConfig, MySQLEngine } from "@coderbuzz/sql/mysql";

const db = mysql.connect({
  host: "localhost",
  port: 3306,
  database: "app",
  user: "root",
  password: "secret",
  connectionLimit: 10,
});
```

MySQL-specific column types: `tinyint`, `mediumint`, `mediumtext`, `longtext`,
`json<T>`, `year`, `enumType(...values)`. Plus all ANSI types.

### SQL Server

```ts
import { mssql, type MSSQLConfig, MSSQLEngine } from "@coderbuzz/sql/mssql";

const db = mssql.connect({
  server: "localhost",
  port: 1433,
  database: "app",
  user: "sa",
  password: "YourStrongPassword!",
  options: { trustServerCertificate: true },
});
```

MSSQL-specific column types: `nvarchar(n | "MAX")`, `datetime2`,
`uniqueidentifier`, `money`, `bit`. Plus all ANSI types.

### ClickHouse

```ts
import {
  ch,
  type ClickHouseConfig,
  ClickHouseEngine,
} from "@coderbuzz/sql/clickhouse";

const db = ch.connect({
  url: "http://localhost:8123",
  database: "default",
  username: "default",
  password: "",
});
```

ClickHouse `execute()` returns a `ClickHouseDataset`:

```ts
type ClickHouseDataset = {
  data: Record<string, unknown>[];
  meta: { name: string; type: string }[];
  rows: number;
  statistics?: {
    read_rows?: string;
    read_bytes?: string;
    written_rows?: string;
    written_bytes?: string;
    total_rows_to_read?: string;
  };
};
```

ClickHouse column types: `string`, `fixedString(n)`, `int8`, `int16`, `int32`,
`int64`, `uint8`, `uint16`, `uint32`, `uint64`, `float32`, `float64`,
`decimal(p, s)`, `boolean`, `date`, `date32`, `datetime`,
`datetime64(precision)`, `uuid`, `ipv4`, `ipv6`, `lowCardinality(type)`.

### Oracle

```ts
import { oracle, type OracleConfig, OracleEngine } from "@coderbuzz/sql/oracle";

const db = oracle.connect({
  user: "app",
  password: "secret",
  connectString: "localhost/XEPDB1",
  poolMax: 10,
});
```

Oracle-specific column types: `number(precision?, scale?)`, `varchar2(n)`,
`clob`, `blob`, `date` (exported as `oracleDate`), `timestamp_tz(precision)`.

### Snowflake

```ts
import {
  snowflake,
  type SnowflakeConfig,
  SnowflakeEngine,
} from "@coderbuzz/sql/snowflake";

const db = snowflake.connect({
  account: "my-account",
  username: "APP_USER",
  password: "secret",
  database: "APP_DB",
  schema: "PUBLIC",
  warehouse: "COMPUTE_WH",
  role: "APP_ROLE",
});
```

Snowflake-specific column types: `variant<T>`, `timestamp_ntz(precision)`,
`timestamp_ltz(precision)`, `array_type<T>`, `object_type<T>`.

### Databricks

```ts
import {
  databricks,
  type DatabricksConfig,
  DatabricksEngine,
} from "@coderbuzz/sql/databricks";

const db = databricks.connect({
  host: "adb-xxxx.azuredatabricks.net",
  path: "/sql/1.0/warehouses/xxxx",
  token: "dapi...",
});
```

Databricks-specific column types: `string`, `long`, `double`,
`struct<T>(fields)`, `map_type<K, V>`, `array_type<T>`.

## Column Type Reference

### ANSI Types

Available from `@coderbuzz/sql`, `@coderbuzz/sql/ansi`, and ANSI-based
namespaces.

| Factory                              | TypeScript type | SQL type                                  |
| ------------------------------------ | --------------- | ----------------------------------------- |
| `char(length = 1)`                   | `string`        | `CHAR(n)`                                 |
| `varchar(length = 255)`              | `string`        | `VARCHAR(n)`                              |
| `clob()`                             | `string`        | `CLOB`                                    |
| `text()`                             | `string`        | `TEXT`                                    |
| `integer()`                          | `number`        | `INTEGER`                                 |
| `int()`                              | `number`        | `INT`                                     |
| `smallint()`                         | `number`        | `SMALLINT`                                |
| `bigint()`                           | `number`        | `BIGINT`                                  |
| `decimal(precision = 10, scale = 2)` | `number`        | `DECIMAL(p, s)`                           |
| `numeric(precision = 10, scale = 2)` | `number`        | `NUMERIC(p, s)`                           |
| `float(precision?)`                  | `number`        | `FLOAT` or `FLOAT(n)`                     |
| `real()`                             | `number`        | `REAL`                                    |
| `doublePrecision()`                  | `number`        | `DOUBLE PRECISION`                        |
| `boolean()`                          | `boolean`       | `BOOLEAN`                                 |
| `date()`                             | `Date`          | `DATE`                                    |
| `time(withTimeZone = false)`         | `Date`          | `TIME` or `TIME WITH TIME ZONE`           |
| `timestamp(withTimeZone = false)`    | `Date`          | `TIMESTAMP` or `TIMESTAMP WITH TIME ZONE` |

### SQLite Types

```ts
import * as t from "@coderbuzz/sql/sqlite-types";
```

Factories: `char`, `varchar`, `text`, `clob`, `integer`, `int`, `smallint`,
`bigint`, `real`, `float`, `double`, `numeric`, `decimal`, `boolean`, `date`,
`time`, `datetime`.

### PostgreSQL Types

```ts
import * as t from "@coderbuzz/sql/postgres-types";
```

Postgres-specific: `serial()`, `bigserial()`, `uuid()`, `jsonb<T>()`,
`json<T>()`, `text_array()`, `inet()`, `timestamptz()`, `bytea()`, `citext()`.
The `pg` namespace also includes all ANSI factories.

### MySQL Types

```ts
import * as t from "@coderbuzz/sql/mysql-types";
```

MySQL-specific: `tinyint()`, `mediumint()`, `mediumtext()`, `longtext()`,
`json<T>()`, `year()`, `enumType(...values)`. The `mysql` namespace also
includes all ANSI factories.

### MSSQL Types

```ts
import * as t from "@coderbuzz/sql/mssql-types";
```

MSSQL-specific: `nvarchar(n | "MAX")`, `datetime2()`, `uniqueidentifier()`,
`money()`, `bit()`. The `mssql` namespace also includes all ANSI factories.

### ClickHouse Types

```ts
import * as t from "@coderbuzz/sql/clickhouse-types";
```

Factories: `string()`, `fixedString(n)`, `int8()`, `int16()`, `int32()`,
`int64()`, `uint8()`, `uint16()`, `uint32()`, `uint64()`, `float32()`,
`float64()`, `decimal(p, s)`, `boolean()`, `date()`, `date32()`, `datetime()`,
`datetime64(precision)`, `uuid()`, `ipv4()`, `ipv6()`, `lowCardinality(type)`.

### Oracle Types

```ts
import * as t from "@coderbuzz/sql/oracle-types";
```

Oracle-specific: `number(precision?, scale?)`, `varchar2(n)`, `clob()`,
`blob()`, `date()`, `timestamp_tz(precision)`.

### Snowflake Types

```ts
import * as t from "@coderbuzz/sql/snowflake-types";
```

Snowflake-specific: `variant<T>()`, `timestamp_ntz(precision)`,
`timestamp_ltz(precision)`, `array_type<T>()`, `object_type<T>()`.

### Databricks Types

```ts
import * as t from "@coderbuzz/sql/databricks-types";
```

Databricks-specific: `string()`, `long()`, `double()`, `struct<T>(fields)`,
`map_type<K, V>()`, `array_type<T>()`.

## Dialect Behavior Notes

| Feature                       | Notes                                                                                                               |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Placeholders                  | `?` (SQLite/MySQL/ClickHouse/Snowflake/Databricks), `$N` (PostgreSQL), `@pN` (MSSQL), `:N` (Oracle)                 |
| `RETURNING`                   | Supported by PostgreSQL and SQLite; throws `"RETURNING is not supported by this dialect"` on others                 |
| Full outer join               | Not supported by SQLite, MySQL, or ClickHouse — throws at compile time                                              |
| ClickHouse params             | Values are safely escaped and inlined into SQL (no native binding in HTTP API)                                      |
| ClickHouse indexes            | Standalone `CREATE INDEX` statements not emitted — indexes are part of ENGINE definition                            |
| ClickHouse unique constraints | Not supported; use `ReplacingMergeTree` or enforce at the application level                                         |
| MSSQL limit without order     | Compiler injects `ORDER BY (SELECT NULL)` automatically for `OFFSET/FETCH`                                          |
| MySQL primary serial          | `SERIAL` primary keys become `INT AUTO_INCREMENT` in DDL                                                            |
| SQLite WAL mode               | Enabled automatically for file-based SQLite databases                                                               |
| Identifier quoting            | `"quotes"` (PostgreSQL, SQLite, Oracle, Snowflake), backticks (MySQL, ClickHouse, Databricks), `[brackets]` (MSSQL) |

## API Reference

### `Sql<T>` (Base Engine)

All concrete engines extend this class.

```ts
// Middleware
db.use(middleware: Middleware<T>): this

// Execution
await db.execute(queryOrSql: CompiledQuery | string): Promise<T>

// Transaction
await db.transaction(fn: (tx: this) => Promise<R>): Promise<R>

// Migration
await db.migrate(...tables: SqlTable<any>[]): Promise<void>

// Query builders
db.select(...fields: string[]): SelectQuery<T>
db.select_distinct(...fields: string[]): SelectQuery<T>
db.with(alias: string, queryFn: (q: SelectQuery<T>) => SelectQuery<T>): SelectQuery<T>
db.insert_into(table: string, options?: InsertOptions): InsertQuery<T>
db.batchInsert(table: string, options: BatchOptions): InsertBatcher<T>
db.update(table: string): UpdateQuery<T>
db.delete_from(table: string): DeleteQuery<T>
db.sql<R>(strings, ...values): RawQuery<R>

// Engine internals
db.dialect: string        // "sqlite", "postgres", "mysql", etc.
db.compiler: BaseCompiler
```

### `SqlTable<S>`

```ts
table.tableName: string
table.columns: S
table.options: TableOptions

table.toAst(ifNotExists?: boolean): CreateTableNode
table.createTable(dialect: string, ifNotExists?: boolean): string
table.createIndexes(dialect: string, ifNotExists?: boolean): string[]
table.dropTable(ifExists?: boolean): string

table.from(engine): TypedSelectQuery<InferRow<S>, S>
table.select(engine, ...fields): SelectQuery
table.insert(engine): InsertQuery
table.update(engine): UpdateQuery
table.delete(engine): DeleteQuery
table.bind(engine): BoundTable<S>
```

### `BoundTable<S>`

```ts
await bound.create(): Promise<void>   // CREATE TABLE IF NOT EXISTS
await bound.drop(): Promise<void>     // DROP TABLE IF EXISTS

bound.from(): TypedSelectQuery<InferRow<S>, S>
bound.insert(): InsertQuery
bound.update(): UpdateQuery
bound.delete(): DeleteQuery
```

### `SelectQuery<T>`

```ts
query.with(alias, queryFn): this
query.select(...fields): this
query.select_distinct(...fields): this
query.from(tableOrSubquery): this
query.left_join(table, on): this
query.inner_join(table, on): this
query.right_join(table, on): this
query.full_join(table, on): this
query.where(condition): this
query.group_by(...fields): this
query.having(condition): this
query.order_by(...fields): this
query.limit(count, offset?): this
query.union(query): this
query.union_all(query): this
query.intersect(query): this
query.except(query): this
query.toSQL(options?): CompiledQuery
query.explain(options?): RawQuery<ExplainRow>
query.explain_analyze(options?): CompiledQuery
query.execute(): Promise<T>
query.stream(): AsyncIterable<Row>
query.prepare(): PreparedQuery<T>
```

### `TypedSelectQuery<TResult, S>` (extends SelectQuery)

```ts
query.fields<F extends AnyField<S>[]>(...cols: F): TypedSelectQuery<InferSelect<S, F>, S>
query.execute(): Promise<TResult[]>
```

### `InsertQuery<T>`

```ts
query.into(table): this
query.options(options: InsertOptions): this
query.columns(...cols): this
query.values(rows: Record<string, unknown>[]): this
query.returning(...fields): this
query.flush(): Promise<T | void>
query.toSQL(): CompiledQuery
query.execute(): Promise<T>
```

### `InsertBatcher<T>`

```ts
batcher.write(rowOrRows): void
await batcher.flush(): Promise<void>
await batcher.drain(): Promise<void>
await batcher.close(): Promise<void>
batcher.pendingCount: number
batcher.inflightCount: number
```

### `UpdateQuery<T>`

```ts
query.table(name): this
query.set(values: Record<string, unknown>): this
query.where(condition): this
query.returning(...fields): this
query.toSQL(): CompiledQuery
query.execute(): Promise<T>
```

### `DeleteQuery<T>`

```ts
query.from(table): this
query.where(condition): this
query.toSQL(): CompiledQuery
query.execute(): Promise<T>
```

### `RawQuery<T>`

```ts
query.sql: string
query.params: readonly unknown[]
query.toSQL(): CompiledQuery
query.execute(): Promise<T>
```

### Key Types

```ts
// Compiled query output
interface CompiledQuery {
  readonly sql: string;
  readonly params: readonly unknown[];
}

// WHERE / HAVING conditions
type WhereClause = string | FieldObject | Condition[] | LogicalGroup;
type FieldCondition =
  | string
  | number
  | boolean
  | Array<string | number | boolean>;
type LogicalGroup =
  | { and: Condition | Condition[] }
  | { or: Condition | Condition[] }
  | { not: Condition };

// Conflict handling
type OnConflictClause =
  | { type: "do_nothing"; columns?: string[] }
  | { type: "do_update"; columns: string[]; set: Record<string, unknown> };

// Insert options
type InsertOptions = {
  settings?: Record<string, string>;
  onConflict?: OnConflictClause;
};

// Batch insert options
type BatchOptions = {
  wait: number; // required
  max?: number; // default 1000
  timeout?: number; // default 5000
  settings?: Record<string, string>;
};

// Table options (ClickHouse)
type TableOptions = {
  engine?: string;
  orderBy?: string[];
  partitionBy?: string;
};

// Computed field (for expr() and aggregate helpers)
interface ComputedField<T, Alias extends string = string> {
  readonly sql: string;
  readonly alias: Alias;
}

// Middleware
type Middleware<T> = (
  query: CompiledQuery,
  next: () => Promise<T>,
) => Promise<T>;
```

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

// INSERT multiple rows
await users.insert(db)
  .values([
    { id: 1, email: "ada@example.com", name: "Ada", active: true },
    { id: 2, email: "grace@example.com", name: "Grace", active: true },
  ])
  .execute();

// SELECT with type-safe field projection
const activeUsers = await users.from(db)
  .fields("id", "email", "name")
  .where(sqlite.eq("active", true))
  .order_by("id ASC")
  .execute();
// activeUsers: Array<{ id: number; email: string; name: string }>

// UPDATE
await users.update(db)
  .set({ active: false })
  .where({ id: 2 })
  .execute();

// DELETE
await users.delete(db)
  .where({ id: 1 })
  .execute();

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

// Transaction
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

### ClickHouse Analytics

```ts
import { ch } from "@coderbuzz/sql/clickhouse";

const db = ch.connect({
  url: "http://localhost:8123",
  database: "analytics",
});

const events = ch.table("events", {
  id: ch.uuid(),
  tenant_id: ch.string().index(),
  event_type: ch.lowCardinality("String"),
  score: ch.float64(),
  created_at: ch.datetime64(3),
}, {
  engine: "MergeTree()",
  orderBy: ["tenant_id", "created_at"],
  partitionBy: "toYYYYMM(created_at)",
});

await db.migrate(events);

// High-throughput batch ingestion
const batcher = db.batchInsert("events", {
  wait: 25,
  max: 10_000,
  timeout: 1_000,
  settings: {
    async_insert: "1",
    wait_for_async_insert: "0",
  },
});

for (let i = 0; i < 100_000; i++) {
  batcher.write({
    id: crypto.randomUUID(),
    tenant_id: "acme",
    event_type: i % 2 === 0 ? "view" : "click",
    score: Math.random(),
    created_at: new Date(),
  });
}

await batcher.close();

// Query
const result = await db.select(
  "tenant_id",
  "COUNT(*) AS total",
  "AVG(score) AS avg_score",
)
  .from("events")
  .group_by("tenant_id")
  .order_by("total DESC")
  .execute();

console.log(result.data);
```

### Aggregate Query

```ts
import { sqlite } from "@coderbuzz/sql/sqlite";
import { avg, count, max, min, sum } from "@coderbuzz/sql";

const db = sqlite.connect({ path: ":memory:" });

const orders = sqlite.table("orders", {
  id: sqlite.integer().primaryKey(),
  customer_id: sqlite.integer().notNull(),
  total: sqlite.decimal(10, 2).notNull(),
  created_at: sqlite.datetime().notNull(),
});

await db.migrate(orders);

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
  .having("COUNT(*) > 2")
  .order_by("totalSpent DESC")
  .execute();
```

### Streaming

```ts
import { sqlite } from "@coderbuzz/sql/sqlite";

const db = sqlite.connect({ path: "./large.db" });

const rows_table = sqlite.table("rows", {
  id: sqlite.integer().primaryKey(),
  data: sqlite.text().notNull(),
});

// Stream millions of rows without loading all into memory
for await (const row of rows_table.from(db).stream()) {
  await processRow(row);
}
```

### Schema Migration

```ts
import { sqlite } from "@coderbuzz/sql/sqlite";
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
  updated_at: sqlite.datetime().nullable(), // new column
});

const live = await introspect(db);
const diffs = diff(live, [usersV2.toAst()]);
const stmts = applyDiff(diffs, sqliteCompiler);

if (stmts.length === 0) {
  console.log("Schema is up to date.");
} else {
  for (const stmt of stmts) {
    console.log("Executing:", stmt);
    await db.execute(stmt);
  }
}
```

### Middleware Pipeline

```ts
import { pg } from "@coderbuzz/sql/postgres";

const db = pg.connect({ connectionString: process.env.DATABASE_URL });

// Structured query logging
db.use(async (query, next) => {
  const start = performance.now();
  try {
    const result = await next();
    console.log({
      event: "sql.query",
      sql: query.sql,
      params: query.params,
      duration_ms: Math.round(performance.now() - start),
    });
    return result;
  } catch (e) {
    console.error({
      event: "sql.error",
      sql: query.sql,
      error: (e as Error).message,
    });
    throw e;
  }
});

// Safety guard
db.use(async (query, next) => {
  const sql = query.sql.trim().toLowerCase();
  if (
    (sql.startsWith("delete from") || sql.startsWith("update ")) &&
    !sql.includes(" where ")
  ) {
    throw new Error(`Unsafe query blocked: ${query.sql}`);
  }
  return next();
});
```

### MySQL with Enum

```ts
import { mysql } from "@coderbuzz/sql/mysql";

const db = mysql.connect({
  host: "localhost",
  database: "app",
  user: "root",
  password: "secret",
});

const products = mysql.table("products", {
  id: mysql.integer().primaryKey(),
  name: mysql.varchar(200).notNull(),
  status: mysql.enumType("active", "inactive", "archived").notNull(),
  price: mysql.decimal(10, 2).notNull(),
});

await db.migrate(products);

await products.insert(db)
  .values([{ id: 1, name: "Widget", status: "active", price: 9.99 }])
  .execute();

const active = await products.from(db)
  .where({ status: "active" })
  .execute();
```

### Compiled Query Inspection

```ts
import { sqlite } from "@coderbuzz/sql/sqlite";

const db = sqlite.connect({ path: ":memory:" });

const users = sqlite.table("users", {
  id: sqlite.integer().primaryKey(),
  name: sqlite.text().notNull(),
  active: sqlite.boolean().default(true),
});

// Inspect SELECT SQL before executing
const selectCompiled = users.from(db)
  .fields("id", "name")
  .where(sqlite.and(
    sqlite.eq("active", true),
    sqlite.gte("id", 10),
  ))
  .order_by("id ASC")
  .limit(20)
  .toSQL();

console.log(selectCompiled.sql);
// SELECT "id", "name" FROM users WHERE (active = ? AND id >= ?) ORDER BY id ASC LIMIT 20
console.log(selectCompiled.params);
// [true, 10]

// Inspect INSERT SQL
const insertCompiled = users.insert(db)
  .values([{ id: 1, name: "Alice", active: true }])
  .toSQL();

console.log(insertCompiled.sql);
// INSERT INTO users (id, name, active) VALUES (?, ?, ?)
console.log(insertCompiled.params);
// [1, "Alice", true]
```

## License

MIT © 2026 Indra Gunawan
