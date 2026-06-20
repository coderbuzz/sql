<!-- docs: sync from coderbuzz/codex@cd4a13b -->

# @coderbuzz/sql — AI Expert Knowledge Reference

**Package:** `@coderbuzz/sql` v0.1.3\
**Purpose:** Comprehensive reference for AI agents generating application code
with the `@coderbuzz/sql` library.\
**Distribution:** ESM only (`dist/` folder). No source `.ts` files in the
package. Treat every rule here as authoritative.

---

## 1. Mental Model

```
Dialect Namespace (sqlite / pg / mysql / mssql / ch / oracle / snowflake / databricks)
  ├── connect(config)       → Engine instance (extends Sql<T>)
  ├── table(name, schema)   → SqlTable<S>
  ├── column factories      (integer, text, serial, uuid, ...)
  └── expression helpers    (eq, ne, gt, and, or, not, raw, ...)

Engine (Sql<T>)
  ├── execute(query)        → runs SQL via driver
  ├── transaction(fn)       → BEGIN / COMMIT / ROLLBACK
  ├── migrate(...tables)    → CREATE TABLE IF NOT EXISTS + indexes
  ├── use(middleware)       → wrap execute() calls
  ├── select / insert_into / update / delete_from / with / batchInsert
  └── sql`...`              → safe parameterised raw SQL

SqlTable<S>
  ├── createTable(dialect)  → DDL string
  ├── createIndexes(dialect)→ DDL strings[]
  ├── from(engine)          → TypedSelectQuery (type-safe)
  ├── insert(engine)        → InsertQuery
  ├── update(engine)        → UpdateQuery
  ├── delete(engine)        → DeleteQuery
  └── bind(engine)          → BoundTable (no-engine-repeat API)
```

---

## 2. Import Rules

### 2.1 Dialect Namespaces (primary usage)

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

### 2.2 Root package — shared helpers and types

```ts
import {
  and,
  avg,
  type BatchOptions,
  // Types
  type CompiledQuery,
  // Aggregate helpers
  count,
  DeleteQuery,
  // Expression helpers (also in each dialect namespace)
  eq,
  // Expression factory
  expr,
  gt,
  gte,
  ilike,
  type InferRow,
  type InferSelect,
  inList,
  InsertBatcher,
  type InsertOptions,
  InsertQuery,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  max,
  type Middleware,
  min,
  ne,
  not,
  type OnConflictClause,
  or,
  raw,
  SelectQuery,
  // Classes (for advanced use)
  Sql,
  SqlColumn,
  SqlTable,
  sum,
  UpdateQuery,
  type WhereClause,
} from "@coderbuzz/sql";
```

### 2.3 Type-only subpaths (column factories without engine)

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

---

## 3. Connecting to a Database

Each dialect namespace has a `connect()` factory. Always call `connect()` — do
not instantiate engine classes directly unless needed for testing.

```ts
// SQLite
const db = sqlite.connect({ path: ":memory:" }); // in-memory
const db = sqlite.connect({ path: "./app.db" }); // file
const db = sqlite.connect({ path: "./app.db", readonly: true });

// PostgreSQL
const db = pg.connect({ connectionString: process.env.DATABASE_URL });
const db = pg.connect({
  host: "localhost",
  port: 5432,
  database: "app",
  user: "app",
  password: "secret",
  max: 10,
});

// MySQL
const db = mysql.connect({
  host: "localhost",
  database: "app",
  user: "root",
  password: "secret",
  connectionLimit: 10,
});

// MSSQL
const db = mssql.connect({
  server: "localhost",
  database: "app",
  user: "sa",
  password: "Pass!",
  options: { trustServerCertificate: true },
});

// ClickHouse
const db = ch.connect({
  url: "http://localhost:8123",
  database: "default",
  username: "default",
  password: "",
});

// Oracle
const db = oracle.connect({
  user: "app",
  password: "secret",
  connectString: "localhost/XEPDB1",
  poolMax: 10,
});

// Snowflake
const db = snowflake.connect({
  account: "my-account",
  username: "APP_USER",
  password: "secret",
  database: "APP_DB",
  schema: "PUBLIC",
  warehouse: "COMPUTE_WH",
  role: "APP_ROLE",
});

// Databricks
const db = databricks.connect({
  host: "adb-xxxx.azuredatabricks.net",
  path: "/sql/1.0/warehouses/xxxx",
  token: "dapi...",
});
```

---

## 4. Defining Tables

Use the dialect namespace's `table()` function. Always define tables at module
scope (singleton pattern).

```ts
const users = pg.table("users", {
  id: pg.serial().primaryKey(),
  email: pg.text().notNull().unique().index(),
  name: pg.varchar(120).notNull(),
  role: pg.varchar(20).default("user"),
  score: pg.decimal(5, 2).default(0),
  bio: pg.text().nullable(),
  metadata: pg.jsonb<Record<string, unknown>>().nullable(),
  created_at: pg.timestamptz().defaultNow(),
  updated_at: pg.timestamptz().defaultNow(),
});
```

### Column Modifiers (prefer camelCase)

| Modifier          | Effect                                      |
| ----------------- | ------------------------------------------- |
| `.primaryKey()`   | PRIMARY KEY in DDL                          |
| `.notNull()`      | NOT NULL in DDL; TypeScript type is `T`     |
| `.nullable()`     | Allows NULL; TypeScript type is `T \| null` |
| `.unique()`       | UNIQUE constraint                           |
| `.index()`        | Separate CREATE INDEX statement             |
| `.default(value)` | DEFAULT value in DDL                        |
| `.defaultNow()`   | DEFAULT NOW() in DDL                        |

Legacy uppercase aliases: `.PRIMARY()`, `.NOT_NULL()`, `.ALLOW_NULL()`,
`.INDEX()`, `.DEFAULT(v)` — still work, prefer camelCase in new code.

### ClickHouse Table Options (third arg)

```ts
const events = ch.table("events", {
  id: ch.uuid(),
  tenant_id: ch.string(),
  created_at: ch.datetime64(3),
}, {
  engine: "MergeTree()",
  orderBy: ["tenant_id", "created_at"],
  partitionBy: "toYYYYMM(created_at)",
});
```

---

## 5. Type Inference

```ts
import type { InferRow, InferSelect } from "@coderbuzz/sql";

// Full row type
type UserRow = InferRow<typeof users.columns>;
// { id: number; email: string; name: string; role: string; bio: string | null; ... }

// Projected type (from .fields())
type UserPreview = InferSelect<typeof users.columns, ["id", "email", "name"]>;
// { id: number; email: string; name: string }
```

---

## 6. DDL and Migration

### Simple migration (idempotent startup)

```ts
await db.migrate(users, posts, comments);
// Runs CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS for each table
```

### Manual DDL

```ts
// CREATE TABLE
await db.execute(users.createTable(db.dialect));

// CREATE INDEX statements
for (const sql of users.createIndexes(db.dialect)) {
  await db.execute(sql);
}

// DROP TABLE
await db.execute(users.dropTable()); // "DROP TABLE IF EXISTS users;"
```

### Schema migration (introspect + diff + apply)

```ts
import { introspect } from "@coderbuzz/sql/dist/migration/introspect";
import { diff } from "@coderbuzz/sql/dist/migration/diff";
import { applyDiff } from "@coderbuzz/sql/dist/migration/apply";
import { sqliteCompiler } from "@coderbuzz/sql/dist/dialects/sqlite";

const live = await introspect(db); // query live schema
const diffs = diff(live, [usersV2.toAst()]); // compute diffs
const stmts = applyDiff(diffs, sqliteCompiler); // ALTER TABLE statements

for (const stmt of stmts) {
  await db.execute(stmt);
}
```

`applyDiff()` supports: ADD COLUMN (all dialects), DROP COLUMN (PG/MySQL/MSSQL),
ALTER COLUMN (PG/MySQL/MSSQL). SQLite skips DROP/ALTER with a `console.warn`.

---

## 7. SELECT Queries

### Pattern 1: Table-bound typed query

```ts
// .from(engine) returns TypedSelectQuery — use .fields() for type-narrowing
const rows = await users.from(db)
  .fields("id", "email", "name") // typed: { id, email, name }[]
  .where({ active: true })
  .order_by("created_at DESC")
  .limit(20)
  .execute();
```

### Pattern 2: Engine-level query (untyped)

```ts
const rows = await db.select("u.id", "u.name", "p.title")
  .from("users u")
  .left_join("posts p", "p.user_id = u.id")
  .where({ "u.active": true })
  .order_by("u.id ASC")
  .limit(50, 100)
  .execute();
```

### Fields variants in .fields()

```ts
// 1. Plain column name — type: InferRow<S>[col]
.fields("id", "name")

// 2. Column with alias — type: { userEmail: string }
.fields(["email", "userEmail"])

// 3. Computed expression — type: { upperName: string }
.fields(expr<string>("UPPER(name)", "upperName"))

// 4. Aggregate helpers
.fields("customer_id", count("*", "orderCount"), sum("total", "totalSpent"))
```

### Joins

```ts
db.select("u.id", "p.title")
  .from("users u")
  .left_join("posts p", "p.user_id = u.id") // LEFT JOIN
  .inner_join("tags t", "t.post_id = p.id") // INNER JOIN
  .right_join("authors a", "a.id = p.author"); // RIGHT JOIN
// .full_join() — NOT supported by SQLite, MySQL, ClickHouse
```

### CTE

```ts
const rows = await db
  .with(
    "active",
    (q) => q.select("id", "email").from("users").where({ active: true }),
  )
  .select("*")
  .from("active")
  .execute();
```

### UNION / INTERSECT / EXCEPT

```ts
const q1 = db.select("id").from("admins");
const q2 = db.select("user_id AS id").from("moderators");

await q1.union(q2).execute(); // UNION
await q1.union_all(q2).execute(); // UNION ALL
await q1.intersect(q2).execute(); // INTERSECT
await q1.except(q2).execute(); // EXCEPT
```

### Subquery as FROM source

```ts
const sub = db.select("user_id", "COUNT(*) AS cnt").from("orders").group_by(
  "user_id",
);
const rows = await db.select("*").from({ query: sub, alias: "counts" })
  .execute();
```

### Compile without executing

```ts
const { sql, params } = users.from(db)
  .fields("id", "email")
  .where({ active: true })
  .toSQL();
// sql: 'SELECT "id", "email" FROM users WHERE active = ?'
// params: [true]
```

### Explain

```ts
// Returns RawQuery<ExplainRow>, also destructurable as { sql, params }
const plan = await users.from(db).where({ id: 1 }).explain().execute();
const { sql } = users.from(db).where({ id: 1 }).explain();
// SQLite: "EXPLAIN QUERY PLAN ..."
// PostgreSQL: "EXPLAIN ANALYZE ..."
// Others: "EXPLAIN ..."
```

---

## 8. WHERE Conditions — Complete Reference

### Object form (parameterised)

```ts
// Equality (parameterised)
.where({ id: 5 })                   // WHERE id = ?   [5]
.where({ name: "Alice" })           // WHERE name = ?  ["Alice"]
.where({ active: true })            // WHERE active = ? [true]

// IN array (parameterised)
.where({ id: [1, 2, 3] })           // WHERE id IN (?, ?, ?)  [1,2,3]

// String operator prefix (inlined, NOT parameterised)
.where({ score: ">= 90" })          // WHERE score >= 90
.where({ deleted_at: "IS NULL" })   // WHERE deleted_at IS NULL
.where({ status: "IS NOT NULL" })   // WHERE status IS NOT NULL

// Multiple fields — joined with AND
.where({ active: true, role: "admin" })
// WHERE active = ? AND role = ?
```

### Logical groups

```ts
// OR
.where({ or: [{ role: "admin" }, { role: "owner" }] })
// WHERE (role = ? OR role = ?)

// AND
.where({ and: [{ active: true }, { score: ">= 50" }] })
// WHERE (active = ? AND score >= 50)

// NOT
.where({ not: { role: "banned" } })
// WHERE NOT (role = ?)

// Nested
.where({ and: [{ active: true }, { not: { deleted_at: "IS NULL" } }] })
```

### Expression helpers (preferred for complex conditions)

```ts
import { eq, ne, gt, gte, lt, lte, like, ilike, inList, isNull, isNotNull, and, or, not, raw } from "@coderbuzz/sql";

.where(eq("id", 5))
.where(gte("score", 90))
.where(like("email", "%@example.com"))
.where(ilike("name", "%alice%"))      // case-insensitive, PostgreSQL
.where(inList("id", [1, 2, 3]))
.where(isNull("deleted_at"))
.where(isNotNull("email"))

// Compound
.where(and(eq("active", true), gte("score", 90), not(isNull("email"))))
.where(or(eq("role", "admin"), eq("role", "owner")))

// Raw fragment with params
.where(raw("created_at > NOW() - INTERVAL ? DAY", [7]))

// Raw fragment (no params)
.where("score > 0 AND created_at IS NOT NULL")
```

---

## 9. INSERT Queries

```ts
// Basic insert
await users.insert(db)
  .values([
    { id: 1, email: "a@b.com", name: "Alice" },
    { id: 2, email: "b@b.com", name: "Bob" },
  ])
  .execute();

// With explicit columns
await users.insert(db)
  .columns("email", "name")
  .values([{ email: "a@b.com", name: "Alice" }])
  .execute();

// RETURNING (PostgreSQL + SQLite only)
const [row] = await users.insert(db)
  .values([{ email: "a@b.com", name: "Alice" }])
  .returning("id", "email")
  .execute() as { id: number; email: string }[];

// Upsert — do nothing on conflict
await db.insert_into("users", {
  onConflict: { type: "do_nothing", columns: ["email"] },
}).values([{ email: "a@b.com", name: "Alice" }]).execute();

// Upsert — update on conflict
await db.insert_into("users", {
  onConflict: { type: "do_update", columns: ["email"], set: { name: "Alice Updated" } },
}).values([{ email: "a@b.com", name: "Alice" }]).execute();

// Manual batch accumulation
const q = users.insert(db);
q.values([{ id: 10, name: "X" }]);
q.values([{ id: 11, name: "Y" }]);
await q.flush();  // one INSERT with both rows

// ClickHouse SETTINGS
await events.insert(db)
  .options({ settings: { async_insert: "1", wait_for_async_insert: "0" } })
  .values([...])
  .execute();
```

### RETURNING support matrix

| Dialect    | INSERT RETURNING | UPDATE RETURNING |
| ---------- | ---------------- | ---------------- |
| PostgreSQL | ✓                | ✓                |
| SQLite     | ✓                | ✓                |
| MySQL      | ✗ (throws)       | ✗ (throws)       |
| MSSQL      | ✗ (throws)       | ✗ (throws)       |
| Oracle     | ✗ (throws)       | ✗ (throws)       |
| Snowflake  | ✗ (throws)       | ✗ (throws)       |
| Databricks | ✗ (throws)       | ✗ (throws)       |
| ClickHouse | ✗ (throws)       | ✗ (throws)       |

---

## 10. Batch Insert (InsertBatcher)

Use `db.batchInsert()` for high-throughput ingestion. Auto-flushes using
debounce + max-rows + timeout strategies. Always `await batcher.close()` when
done.

```ts
const batcher = db.batchInsert("events", {
  wait: 50, // ms of inactivity before flush (REQUIRED)
  max: 5_000, // flush when pending reaches this count
  timeout: 2_000, // force flush after this many ms from first write
  settings: { async_insert: "1" }, // engine-specific (ClickHouse)
});

// Write rows
batcher.write({ id: 1, val: "a" });
batcher.write([{ id: 2, val: "b" }, { id: 3, val: "c" }]);

// Inspect state
batcher.pendingCount; // rows waiting to flush
batcher.inflightCount; // in-progress flush requests

// Lifecycle
await batcher.flush(); // manual flush
await batcher.drain(); // wait for in-flight requests
await batcher.close(); // flush + drain + seal (throws if write() called after)
```

**Critical rules:**

- Always `await batcher.close()` at the end — never fire-and-forget.
- After `close()`, calling `write()` throws.
- Auto-flushes are fire-and-forget internally but tracked — `drain()` waits for
  them.

---

## 11. UPDATE Queries

```ts
await users.update(db)
  .set({ score: 100, updated_at: new Date() })
  .where({ id: 1 })
  .execute();

// RETURNING (PostgreSQL + SQLite)
const updated = await users.update(db)
  .set({ name: "New Name" })
  .where({ id: 1 })
  .returning("id", "name")
  .execute();
```

---

## 12. DELETE Queries

```ts
await users.delete(db)
  .where({ id: 1 })
  .execute();

// Via engine
await db.delete_from("users")
  .where(lt("created_at", new Date("2024-01-01")))
  .execute();

// WITHOUT .where() deletes ALL rows — guard with middleware
```

---

## 13. Raw SQL (Tagged Template)

Values are **always** bound parameters — never inlined into SQL text.

```ts
const email = "ada@example.com";
const rows = await db.sql`SELECT * FROM users WHERE email = ${email}`.execute();

// Typed result
const rows2 = await db.sql<
  UserRow[]
>`SELECT id, name FROM users WHERE active = ${true}`.execute();

// Inspect without executing
const query = db.sql`SELECT * FROM users WHERE id = ${1}`;
// query.sql    → "SELECT * FROM users WHERE id = ?"
// query.params → [1]
await query.execute();
```

Placeholder styles per dialect:

| Dialect    | Style | Example              |
| ---------- | ----- | -------------------- |
| SQLite     | `?`   | `... WHERE id = ?`   |
| PostgreSQL | `$N`  | `... WHERE id = $1`  |
| MySQL      | `?`   | `... WHERE id = ?`   |
| MSSQL      | `@pN` | `... WHERE id = @p1` |
| Oracle     | `:N`  | `... WHERE id = :1`  |
| Others     | `?`   | `... WHERE id = ?`   |

---

## 14. Transactions

```ts
await db.transaction(async (tx) => {
  // Use `tx` exactly like `db` inside the transaction
  await users.insert(tx).values([...]).execute();
  await posts.insert(tx).values([...]).execute();
  // Throws? → auto ROLLBACK
});
// Success → auto COMMIT
```

---

## 15. Middleware

```ts
// Register in order — each calls next() to pass through
db.use(async (query, next) => {
  console.log("[sql]", query.sql, query.params);
  return next();
});

// Abort by throwing instead of calling next()
db.use(async (query, next) => {
  if (isDangerous(query.sql)) throw new Error("Blocked");
  return next();
});

// Middleware chain: query → mw1 → mw2 → ... → _raw()
```

---

## 16. Streaming and Prepared Queries

### Streaming (SQLite + PostgreSQL only)

```ts
for await (const row of users.from(db).where({ active: true }).stream()) {
  await processRow(row);
}
// Throws on unsupported dialects: "Streaming is not supported by this dialect."
```

### Prepared queries (SQLite + PostgreSQL only)

```ts
const prepared = users.from(db).where({ id: 1 }).prepare();
const rows = await prepared.execute();
prepared.close();
// Throws on unsupported dialects: "Prepared statements are not supported by this dialect."
```

---

## 17. Aggregate Helpers

```ts
import { avg, count, max, min, sum } from "@coderbuzz/sql";

// All return ComputedField<T> for use in .fields()
count(); // COUNT(*) AS count
count("id", "total"); // COUNT(id) AS total
sum("amount", "total"); // SUM(amount) AS total
avg("score", "avgScore"); // AVG(score) AS avgScore
min<Date>("created_at", "oldest"); // MIN(created_at) AS oldest
max<number>("score", "topScore"); // MAX(score) AS topScore
```

---

## 18. Column Types by Dialect

### SQLite

```ts
sqlite.char(n)      sqlite.varchar(n)   sqlite.text()      sqlite.clob()
sqlite.integer()    sqlite.int()        sqlite.smallint()  sqlite.bigint()
sqlite.real()       sqlite.float()      sqlite.double()    sqlite.numeric(p,s)
sqlite.decimal(p,s) sqlite.boolean()    sqlite.date()      sqlite.time()
sqlite.datetime()
```

### PostgreSQL

ANSI types plus:

```ts
pg.serial()    pg.bigserial()   pg.uuid()          pg.jsonb<T>()
pg.json<T>()   pg.text_array()  pg.inet()          pg.timestamptz()
pg.bytea()     pg.citext()
```

### MySQL

ANSI types plus:

```ts
mysql.tinyint()    mysql.mediumint()    mysql.mediumtext()   mysql.longtext()
mysql.json<T>()    mysql.year()         mysql.enumType("a", "b", "c")
```

### MSSQL

ANSI types plus:

```ts
mssql.nvarchar(n); // nvarchar(n) or nvarchar("MAX")
mssql.datetime2(); // DATETIME2
mssql.uniqueidentifier(); // UNIQUEIDENTIFIER
mssql.money(); // MONEY
mssql.bit(); // BIT
```

### ClickHouse

```ts
ch.string()         ch.fixedString(n)
ch.int8()    ch.int16()    ch.int32()    ch.int64()
ch.uint8()   ch.uint16()   ch.uint32()   ch.uint64()
ch.float32()  ch.float64()   ch.decimal(p,s)
ch.boolean()  ch.date()  ch.date32()  ch.datetime()  ch.datetime64(precision)
ch.uuid()  ch.ipv4()  ch.ipv6()  ch.lowCardinality(type)
```

### Oracle

ANSI types plus:

```ts
oracle.number(p?, s?)   oracle.varchar2(n)   oracle.clob()
oracle.blob()           oracle.date()        oracle.timestamp_tz(precision)
// Note: oracle.date() is exported as `oracleDate` from the namespace
//       to avoid collision with ANSI `date`
```

### Snowflake

ANSI types plus:

```ts
snowflake.variant<T>()        snowflake.timestamp_ntz(precision)
snowflake.timestamp_ltz(precision)   snowflake.array_type<T>()
snowflake.object_type<T>()
```

### Databricks

```ts
databricks.string()   databricks.long()   databricks.double()
databricks.struct<T>(fields)  databricks.map_type<K, V>()  databricks.array_type<T>()
```

---

## 19. Dialect-Specific Behaviors

| Behavior                    | Details                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Identifier quoting**      | `"id"` (PG, SQLite, Oracle, Snowflake) · `` `id` `` (MySQL, CH, Databricks) · `[id]` (MSSQL)                |
| **Placeholders**            | `?` (SQLite/MySQL/CH/Snowflake/Databricks) · `$N` (PG) · `@pN` (MSSQL) · `:N` (Oracle)                      |
| **RETURNING**               | PostgreSQL + SQLite only. Others throw `"RETURNING is not supported by this dialect"`                       |
| **FULL OUTER JOIN**         | PostgreSQL + ANSI only. SQLite/MySQL/ClickHouse throw at compile time                                       |
| **ClickHouse params**       | Values inlined into SQL (HTTP API has no native binding). Safe via `escapeClickHouseValue()`                |
| **ClickHouse CREATE INDEX** | Not emitted. Indexes are defined via the ENGINE / ORDER BY clause                                           |
| **ClickHouse UNIQUE**       | Not supported. Throws if `.unique()` is used in a ClickHouse table                                          |
| **MSSQL LIMIT**             | Renders as `OFFSET n ROWS FETCH NEXT m ROWS ONLY`. Injects `ORDER BY (SELECT NULL)` when no ORDER BY exists |
| **Oracle LIMIT**            | Same `OFFSET/FETCH` syntax as MSSQL                                                                         |
| **MySQL SERIAL**            | `SERIAL` primary key becomes `INT AUTO_INCREMENT` in DDL                                                    |
| **SQLite WAL**              | `PRAGMA journal_mode = WAL` applied automatically for file-based DB                                         |
| **SQLite streaming**        | Uses `bun:sqlite` synchronous `stmt.iterate()`                                                              |
| **SQLite prepared**         | Uses `bun:sqlite` statement caching via `db.query()`                                                        |

---

## 20. BoundTable Pattern

Use when one module owns a table+engine pair. Avoids repeating the engine
argument.

```ts
const db = sqlite.connect({ path: "./app.db" });
const users = sqlite.table("users", {
  id: sqlite.integer().primaryKey(),
  name: sqlite.text().notNull(),
});

const bound = users.bind(db);

await bound.create(); // CREATE TABLE IF NOT EXISTS users (...)
await bound.insert().values([{ id: 1, name: "Alice" }]).execute();
const rows = await bound.from().where({ id: 1 }).execute();
await bound.drop(); // DROP TABLE IF EXISTS users
```

---

## 21. CompiledQuery Inspection Pattern

All builders expose `.toSQL()` that returns
`{ sql: string; params: readonly unknown[] }`. Use this for logging, debugging,
or passing to custom executors.

```ts
const compiled = users.from(db)
  .fields("id", "name")
  .where(and(eq("active", true), gte("score", 90)))
  .order_by("id ASC")
  .limit(10)
  .toSQL();

console.log(compiled.sql);
// SELECT "id", "name" FROM users WHERE (active = ? AND score >= ?) ORDER BY id ASC LIMIT 10
console.log(compiled.params);
// [true, 90]
```

---

## 22. ClickHouse Return Type

ClickHouse execute() returns `ClickHouseDataset`, not a plain row array:

```ts
const result: ClickHouseDataset = await db.select(
  "tenant_id",
  "COUNT(*) AS cnt",
)
  .from("events")
  .group_by("tenant_id")
  .execute();

result.data; // Record<string, unknown>[]  — actual rows
result.meta; // { name: string; type: string }[]  — column metadata
result.rows; // number  — row count
result.statistics?.read_rows; // optional stats
```

---

## 23. Error Reference

| Error message                                                                        | When it occurs                                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `"RETURNING is not supported by this dialect"`                                       | `.returning()` called on MySQL/MSSQL/Oracle/Snowflake/Databricks/ClickHouse and `.toSQL()` called |
| `"SQLite does not support FULL OUTER JOIN"`                                          | `.full_join()` used with SQLite compiler                                                          |
| `"MySQL does not support FULL OUTER JOIN"`                                           | `.full_join()` used with MySQL compiler                                                           |
| `"ClickHouse does not support FULL OUTER JOIN"`                                      | `.full_join()` used with ClickHouse compiler                                                      |
| `"ClickHouse does not support UNIQUE constraints (column: ...)"`                     | `.unique()` used on a ClickHouse table column                                                     |
| `"Streaming is not supported by this dialect. Use SQLite or PostgreSQL."`            | `.stream()` called on non-SQLite/PostgreSQL engine                                                |
| `"Prepared statements are not supported by this dialect. Use SQLite or PostgreSQL."` | `.prepare()` called on non-SQLite/PostgreSQL engine                                               |
| `"InsertBatcher is already closed"`                                                  | `.write()` called after `batcher.close()`                                                         |
| `"ClickHouse error (500): ..."`                                                      | ClickHouse HTTP response was not OK                                                               |

---

## 24. Common Anti-Patterns to Avoid

**DO NOT** construct queries by string concatenation:

```ts
// WRONG — SQL injection risk
const rows = await db.execute(`SELECT * FROM users WHERE name = '${name}'`);

// CORRECT — use parameterised query or tagged template
const rows = await db.sql`SELECT * FROM users WHERE name = ${name}`.execute();
```

**DO NOT** call `.stream()` or `.prepare()` on MySQL, MSSQL, Oracle, Snowflake,
Databricks, or ClickHouse engines — they throw.

**DO NOT** use `.returning()` on MySQL, MSSQL, Oracle, Snowflake, Databricks, or
ClickHouse — throws `"RETURNING is not supported by this dialect"`.

**DO NOT** use `.full_join()` with SQLite, MySQL, or ClickHouse — throws at
compile time.

**DO NOT** call `batcher.write()` after `batcher.close()` — throws.

**DO NOT** forget `await batcher.close()` — rows may be silently lost.

**DO NOT** use `DELETE` or `UPDATE` without `.where()` unless you intend to
affect all rows. Add a middleware guard in production code.

**DO NOT** use `.unique()` on ClickHouse table columns — throws.

---

## 25. Quick Code Patterns

### Full CRUD (SQLite)

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

// Create
await users.insert(db).values([{
  id: 1,
  email: "a@b.com",
  name: "Alice",
  active: true,
}]).execute();

// Read — typed result
const all = await users.from(db).fields("id", "name").where({ active: true })
  .execute();

// Update
await users.update(db).set({ name: "Alice 2" }).where({ id: 1 }).execute();

// Delete
await users.delete(db).where({ id: 1 }).execute();

db.close();
```

### Typed projected select with aliases + computed fields

```ts
import { expr } from "@coderbuzz/sql";

const rows = await users.from(db)
  .fields(
    "id",
    ["email", "userEmail"],
    expr<string>("UPPER(name)", "displayName"),
    count("*", "postCount"),
  )
  .where(and(eq("active", true), isNotNull("email")))
  .order_by("id ASC")
  .limit(50)
  .execute();
// rows: Array<{ id: number; userEmail: string; displayName: string; postCount: number }>
```

### PostgreSQL RETURNING + serial PK

```ts
const [row] = await users.insert(db)
  .values([{ email: "a@b.com", name: "Alice" }])
  .returning("id", "email")
  .execute() as { id: number; email: string }[];
console.log(row.id); // auto-generated serial ID
```

### Safe raw SQL

```ts
const userId = 42;
const rows = await db.sql<{ id: number; name: string }[]>`
  SELECT id, name
  FROM users
  WHERE id = ${userId}
    AND active = ${true}
`.execute();
```

### Batch write + close

```ts
const batcher = db.batchInsert("logs", { wait: 100, max: 1000 });
for (const log of logBuffer) {
  batcher.write(log);
}
await batcher.close();
```

### Transaction with error handling

```ts
try {
  await db.transaction(async (tx) => {
    await accounts.update(tx).set({ balance: db.sql`balance - ${amount}` })
      .where({ id: fromId }).execute();
    await accounts.update(tx).set({ balance: db.sql`balance + ${amount}` })
      .where({ id: toId }).execute();
  });
} catch (e) {
  // transaction was rolled back automatically
  console.error("Transfer failed:", e);
}
```

### Middleware safety guard

```ts
db.use(async (query, next) => {
  const sql = query.sql.trim().toLowerCase();
  if (
    (sql.startsWith("delete") || sql.startsWith("update")) &&
    !sql.includes(" where ")
  ) {
    throw new Error(`Blocked unsafe query: ${query.sql}`);
  }
  return next();
});
```

### CTE + subquery aggregation

```ts
const rows = await db
  .with("top_buyers", (q) =>
    q.select("user_id", "SUM(total) AS total_spent")
      .from("orders")
      .group_by("user_id")
      .having("SUM(total) > 1000"))
  .select("u.name", "t.total_spent")
  .from("users u")
  .inner_join("top_buyers t", "t.user_id = u.id")
  .order_by("t.total_spent DESC")
  .execute();
```

---

## 26. Package Metadata

```
Package: @coderbuzz/sql
Version: 0.1.3
License: MIT
Type:    ESM only (type: "module")
Peer deps (all optional): pg, mysql2, mssql, better-sqlite3, @db/sqlite, oracledb, snowflake-sdk, @databricks/sql
Runtime dep: @coderbuzz/veta (internal — schema coercion)
```

**Export map summary:**

| Import path                       | Contents                            |
| --------------------------------- | ----------------------------------- |
| `@coderbuzz/sql`                  | Core classes, helpers, ANSI types   |
| `@coderbuzz/sql/sqlite`           | `sqlite` namespace + `SQLiteEngine` |
| `@coderbuzz/sql/postgres`         | `pg` namespace + `PostgresEngine`   |
| `@coderbuzz/sql/mysql`            | `mysql` namespace + `MySQLEngine`   |
| `@coderbuzz/sql/mssql`            | `mssql` namespace + `MSSQLEngine`   |
| `@coderbuzz/sql/clickhouse`       | `ch` namespace + `ClickHouseEngine` |
| `@coderbuzz/sql/oracle`           | `oracle` namespace + `OracleEngine` |
| `@coderbuzz/sql/snowflake`        | `snowflake` + `SnowflakeEngine`     |
| `@coderbuzz/sql/databricks`       | `databricks` + `DatabricksEngine`   |
| `@coderbuzz/sql/sqlite-types`     | SQLite column factories only        |
| `@coderbuzz/sql/postgres-types`   | PostgreSQL column factories only    |
| `@coderbuzz/sql/mysql-types`      | MySQL column factories only         |
| `@coderbuzz/sql/mssql-types`      | MSSQL column factories only         |
| `@coderbuzz/sql/clickhouse-types` | ClickHouse column factories only    |
| `@coderbuzz/sql/oracle-types`     | Oracle column factories only        |
| `@coderbuzz/sql/snowflake-types`  | Snowflake column factories only     |
| `@coderbuzz/sql/databricks-types` | Databricks column factories only    |
| `@coderbuzz/sql/ansi`             | ANSI column factories only          |
