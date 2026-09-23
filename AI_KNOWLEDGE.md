<!-- docs: sync from coderbuzz/codex@30320de -->

# @coderbuzz/sql: AI Expert Knowledge Reference

**Package:** `@coderbuzz/sql` v0.1.3\
**Purpose:** Comprehensive reference for AI agents generating application code
with the `@coderbuzz/sql` library.\
**Distribution:** ESM only (`dist/` folder). No source `.ts` files in the
package. Treat every rule here as authoritative.

---

## 1. Mental Model

```
Dialect Namespace (sqlite / pg / mysql / mssql / ch)
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
import { pg } from "@coderbuzz/sql/postgres";       // driver: `pg` package
import { pg as pgBun } from "@coderbuzz/sql/postgres-bun"; // driver: Bun built-in, none to install
import { mysql } from "@coderbuzz/sql/mysql";
import { mysql as mysqlBun } from "@coderbuzz/sql/mysql-bun"; // driver: Bun built-in, none to install
import { mssql } from "@coderbuzz/sql/mssql";
import { ch } from "@coderbuzz/sql/clickhouse";
```

### 2.2 Root package: shared helpers and types

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
  // Exact decimal arithmetic (also at @coderbuzz/sql/decimal)
  add,
  subtract,
  multiply,
  divide,
  negate,
  absDecimal,
  sumDecimals,
  roundDecimal,
  normalizeDecimal,
  compareDecimals,
  equalsDecimal,
  lessThanDecimal,
  greaterThanDecimal,
  isZeroDecimal,
  isNegativeDecimal,
  maxDecimal,
  minDecimal,
  isDecimalString,
  toMinorUnits,
  fromMinorUnits,
  allocate,
  splitEvenly,
  DecimalError,
  type DecimalInput,
  type RoundingMode,
  type DecimalOpOptions,
} from "@coderbuzz/sql";
```

### 2.2b Decimal subpath (no engine, no dialect)

```ts
import { add, multiply, roundDecimal, allocate } from "@coderbuzz/sql/decimal";
```

### 2.3 Type-only subpaths (column factories without engine)

```ts
import * as pgTypes from "@coderbuzz/sql/postgres-types";
import * as sqliteTypes from "@coderbuzz/sql/sqlite-types";
import * as clickhouseTypes from "@coderbuzz/sql/clickhouse-types";
import * as mysqlTypes from "@coderbuzz/sql/mysql-types";
import * as mssqlTypes from "@coderbuzz/sql/mssql-types";
```

---

## 3. Connecting to a Database

Each dialect namespace has a `connect()` factory. Always call `connect()`. Do
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

// PostgreSQL on Bun: same namespace shape, no driver package
import { pg as pgBun } from "@coderbuzz/sql/postgres-bun";
const db = pgBun.connect({ connectionString: process.env.DATABASE_URL, max: 10 });
const db = pgBun.connect({
  host: "localhost",
  port: 5432,
  database: "app",
  user: "app",
  password: "secret",
  max: 10,
  // Bun-specific, all optional:
  bigint: false,          // true → int8 arrives as a JS bigint instead of a string
  prepare: true,          // false → required behind PgBouncer in transaction mode
  idleTimeout: 30,        // seconds
  connectionTimeout: 30,  // seconds
  maxLifetime: 0,         // seconds; 0 = unlimited
  sslMode: "prefer",      // 'disable' | 'prefer' | 'require' | 'verify-ca' | 'verify-full'
  streamBatchSize: 1000,  // rows per round trip in stream()
  tenantSetting: "app.tenant_id",
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
  score: pg.decimal(5, 2).default(0),   // → string (exact); use float() for approximate
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
`.INDEX()`, `.DEFAULT(v)` still work. Prefer camelCase in new code.

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

`applyDiff()` supports: RENAME COLUMN (all dialects), ADD COLUMN (all dialects),
DROP COLUMN (PG/MySQL/MSSQL), ALTER COLUMN (PG/MySQL/MSSQL). SQLite skips
DROP/ALTER with a `console.warn`.

**Renaming a column.** `diff()` cannot infer a rename: `memo` disappearing and
`keterangan` appearing is indistinguishable from a genuine drop-and-add, and
guessing means sometimes emitting `ALTER ... RENAME` for a column that should
have been dropped, keeping data that was meant to go under a name that now means
something else. Declare it on the schema:

```ts
new SqlTable('journal', { keterangan: pg.varchar(255).renamedFrom('memo') })
```

`diff()` then fills `TableDiff.renameColumns` instead of producing an add plus a
drop, and `applyDiff()` emits
`ALTER TABLE journal RENAME COLUMN memo TO keterangan` **before** any
`ADD COLUMN`, so the data moves with the name. A rename that also changes the
column's type emits both statements. The annotation is inert once the old name
is gone from the database, so it is safe to leave in place until every
environment has migrated. `renameColumns` is optional on `TableDiff`, so a
hand-built diff still compiles. The annotation survives the other column
modifiers (`.notNull()`, `.index()`, …).

---

## 7. SELECT Queries

### Pattern 1: Table-bound typed query

```ts
// .from(engine) returns TypedSelectQuery: use .fields() for type-narrowing
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
// 1. Plain column name (type: InferRow<S>[col])
.fields("id", "name")

// 2. Column with alias (type: { userEmail: string })
.fields(["email", "userEmail"])

// 3. Computed expression (type: { upperName: string })
.fields(expr<string>("UPPER(name)", "upperName"))

// 4. Aggregate helpers
.fields("customer_id", count("*", "orderCount"), sum("total", "totalSpent"))
```

### Joins

**Untyped**: raw strings, validated by the identifier check:

```ts
db.select("u.id", "p.title")
  .from("users u")
  .left_join("posts p", "p.user_id = u.id") // LEFT JOIN
  .inner_join("tags t", "t.post_id = p.id") // INNER JOIN
  .right_join("authors a", "a.id = p.author"); // RIGHT JOIN
// .full_join(): NOT supported by SQLite, MySQL, ClickHouse
```

**Typed**: from a `SqlTable`, stated as column pairs:

```ts
journalLines.from(db)
  .join(accounts, { left: 'account_id', right: 'id' })    // INNER
  .leftJoin(entries, { left: 'entry_id', right: 'id' })   // LEFT
  .rightJoin(table, on)                                    // RIGHT
  .fullJoin(table, on)                                     // FULL
```

```ts
type JoinOn<L, R> =
  | { left: keyof L & string; right: keyof R & string }
  | ReadonlyArray<{ left: keyof L & string; right: keyof R & string }>
```

`left` is a column of the query so far (the base table or anything already
joined), and `right` a column of the table being joined. Both are checked against
their schemas: a typo is a compile error, and there is no string left for
anything else to end up inside. An array of pairs joins them with `AND`.

**Result types track outer-join nullability**, which is the part worth having:

| | Result |
|---|---|
| `join` | `TResult & InferRow<S2>` |
| `leftJoin` | `TResult & Nullable<InferRow<S2>>` |
| `rightJoin` | `Nullable<TResult> & InferRow<S2>` |
| `fullJoin` | `Nullable<TResult> & Nullable<InferRow<S2>>` |

`order_by()` and `group_by()` on a typed query accept columns of the base table
**and** of everything joined; `order_by` also takes `[column, 'ASC' | 'DESC']`. A
raw string still works (the validator still runs on it), so nothing existing
breaks.

Why this exists: `SqlTable.from()` gave a typed query, but `TypedSelectQuery`
inherited `left_join`/`order_by`/`group_by` from `SelectQuery` unchanged, so the
first join dropped you back to raw strings and took the joined table's column
types with it. The identifier validator had already closed the injection surface;
this makes the safe path the convenient one.

Dialect limits still apply: SQLite, MySQL and ClickHouse reject `fullJoin` at
compile time, the same as `.full_join()`.

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

## 8. WHERE Conditions: Complete Reference

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

// Multiple fields: joined with AND
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

// Upsert: do nothing on conflict
await db.insert_into("users", {
  onConflict: { type: "do_nothing", columns: ["email"] },
}).values([{ email: "a@b.com", name: "Alice" }]).execute();

// Upsert: update on conflict
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
  maxInflight: 4, // concurrent flushes allowed before write() waits
  settings: { async_insert: "1" }, // engine-specific (ClickHouse)
  onError: (err, rows) => { /* REQUIRED: retry or dead-letter these rows */ },
});

// Write rows: write() returns a promise; awaiting it applies backpressure
await batcher.write({ id: 1, val: "a" });
await batcher.write([{ id: 2, val: "b" }, { id: 3, val: "c" }]);

// Inspect state
batcher.pendingCount; // rows waiting to flush
batcher.inflightCount; // in-progress flush requests

// Lifecycle
await batcher.flush(); // manual flush
await batcher.drain(); // wait for in-flight requests
await batcher.close(); // flush + drain + seal (throws if write() called after)
```

**Critical rules:**

- `onError` is REQUIRED. The constructor throws without it. Rows leave the
  pending queue before the insert runs, so a failed auto-flush has no other way
  to be observed.
- Always `await batcher.close()` at the end: never fire-and-forget.
- After `close()`, calling `write()` rejects.
- Every row in a batch must have the SAME keys: a batched INSERT has one
  column list. A differing row rejects. Pass `heterogeneousRows: "union"` to
  insert the union of all columns with NULL for absent ones.
- `await` each `write()` in a bulk import; that is what keeps memory flat.
- Auto-flushes are fire-and-forget internally but tracked: `drain()` waits for
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

// WITHOUT .where() deletes ALL rows: guard with middleware
```

---

## 13. Raw SQL (Tagged Template)

Values are **always** bound parameters: never inlined into SQL text.

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
| Others     | `?`   | `... WHERE id = ?`   |

---

## 14. Transactions

`transaction()` holds ONE connection for the whole callback. Use `tx` for every
statement inside: `db` is a pool and would run the statement on a different
connection, outside the transaction.

```ts
await db.transaction(async (tx) => {
  await users.insert(tx).values([...]).execute();
  await posts.insert(tx).values([...]).execute();
  // Throws? → ROLLBACK
});
// Success → COMMIT
```

### Options

```ts
await db.transaction(fn, {
  isolation: "SERIALIZABLE",   // also READ COMMITTED / REPEATABLE READ / READ UNCOMMITTED
  readOnly: true,              // PostgreSQL / MySQL only
  setup: [                     // runs inside the transaction, on its connection
    { sql: `SELECT set_config('app.tenant_id', $1, true)`, params: [tenantId] },
  ],
});
```

`setup` is where `SET LOCAL` belongs: it is the mechanism PostgreSQL
row-level security depends on, and it is correct only inside a
single-connection transaction.

### Savepoints

```ts
await db.transaction(async (tx) => {
  await postHeader(tx);
  try {
    await tx.savepoint(async (sp) => reserveStock(sp));  // rolls back alone
  } catch { /* header survives */ }
});
```

`tx.transaction(...)` inside a transaction becomes a savepoint, not a second
`BEGIN`. `db.savepoint(...)` outside a transaction throws.

### Row locking

```ts
tx.select("last_no").from("nomor_faktur").where({ seri: "A" }).forUpdate()
// .forShare(), .forUpdate({ noWait: true }), .forUpdate({ skipLocked: true })
```

PostgreSQL / MySQL only. SQLite, MSSQL and ClickHouse throw.

### Errors

If the callback fails AND the `ROLLBACK` also fails, a
`TransactionRollbackError` is thrown carrying both `cause` and `rollbackError`.
The transaction's outcome is undetermined: reconcile, do not just retry.

---

## 15. Middleware

```ts
// Register in order: each calls next() to pass through
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
count(); // COUNT(*) AS count                  ComputedField<number>
count("id", "total"); // COUNT(id) AS total    ComputedField<number>
sum("amount", "total"); // SUM(amount) AS total ComputedField<string | null>
avg("score", "avgScore"); // AVG(score) AS avgScore ComputedField<string | null>
min<Date>("created_at", "oldest"); // MIN(created_at) AS oldest  (no parser)
max<number>("score", "topScore"); // MAX(score) AS topScore      (no parser)
```

Signatures:

```ts
count(field?: string /* '*' */, alias?: string /* 'count' */): ComputedField<number>
sum(field: string, alias?: string /* 'sum' */): ComputedField<string | null>
avg(field: string, alias?: string /* 'avg' */): ComputedField<string | null>
min<T = number>(field: string, alias?: string /* 'min' */): ComputedField<T>
max<T = number>(field: string, alias?: string /* 'max' */): ComputedField<T>
expr<T, A extends string>(rawSql: string, alias: A, parse?: (val: any) => T): ComputedField<T, A>
```

A `ComputedField` may carry `parse`. On the typed path
(`table.from(db).fields(...).execute()`) the result key `alias` is run through
it, exactly like a column parser, and `null` is never passed to it:

- `count()` parses with `Number`. PostgreSQL (`pg` and `Bun.SQL`) and MySQL
  return `COUNT(*)` as a 64-bit integer string (`'41'`); the typed path always
  gives `41`. A count never nears 2^53, so this is exact.
- `sum()`/`avg()` parse with `parseExactNumeric`, so the result is a decimal
  string on every engine (`'12345678901234577.98'`), or `null` over zero rows.
  `SUM(int)` on SQLite returns a number and becomes `'30'`.
- On MSSQL, `sum()`/`avg()` are compiled as `CONVERT(VARCHAR(40), SUM(x), 2)`
  so the driver never reads them as float64. Over a `FLOAT` column that text
  is in exponent form (`'3.000000000000000e-001'`); for float aggregates use
  `expr<number>('SUM(x)', 'total')` instead.
- On SQLite, `SUM()` over a `decimal()` column (stored as `TEXT`) is a float
  sum: `'0.1' + '0.2'` gives `'0.30000000000000004'`. Sum in JavaScript with
  `sumDecimals()` instead.
- `min`/`max` carry no parser: their type depends on the column.

Raw `db.execute()` / `db.select()` results are never parsed.

---

## 18. Column Types by Dialect

> **TypeScript type of exact numerics.** `decimal(p,s)`, `numeric(p,s)`,
> `bigint()`, `bigserial()` and MSSQL `money()` infer as **`string`**, not
> `number`: float64 cannot represent them exactly, and `pg`/`mysql2` return
> them as strings anyway. `integer`, `smallint`, `int`, `serial`, `float`,
> `real` and `doublePrecision` remain `number`.

#### Exact numerics per engine

Every engine's `decimal()` reads back as the exact decimal string on the typed
path. Each needs something different to get there, verified against live
databases in `tests/sql.decimal-engines.test.ts` with `'12345678901234567.89'`
(past float64's 15 significant digits), `'10.10'` (trailing zero) and
`'-0.01'`:

| Engine | Driver returns | What this package does | `bigint()` |
|---|---|---|---|
| `postgres` (`pg`) | `NUMERIC` as string | nothing needed | string (driver) |
| `postgres-bun` (`Bun.SQL`) | `NUMERIC` as string | nothing needed | string, or `bigint` with `bigint: true`; both parse to string |
| `mysql` (`mysql2`) | `DECIMAL` as string, `BIGINT` as float64 by default | pool created with `supportBigNumbers: true, bigNumberStrings: true` | string |
| `mysql-bun` (`Bun.SQL`) | `DECIMAL` as string; `BIGINT` as `number` when ≤ 2^53, `string` beyond | nothing needed | string (parser stringifies the `number`) |
| `mssql` (`tedious`) | `DECIMAL`/`NUMERIC`/`MONEY`/`SMALLMONEY` as float64, no option to change it | typed SELECT rewrites those columns to `CONVERT(VARCHAR(40), col, 2) AS col` | string (driver) |
| `sqlite-bun` / `sqlite-node` / `sqlite-deno` | whatever was stored | `decimal()`/`numeric()` emit DDL `TEXT`, so the string is stored untouched | `number` (unchanged) |
| `clickhouse` | JSON: `Decimal` as bare number, trailing zeros dropped | every request sends `output_format_json_quote_decimals=1&output_format_decimal_trailing_zeros=1`; `Decimal(p, s)` parses to string | n/a (`int64()` is `number`) |

Writes need nothing: every driver binds a decimal string and the server
converts it exactly (PostgreSQL `numeric`, MySQL `DECIMAL`, SQL Server
`NVARCHAR` → `DECIMAL`, ClickHouse quoted literal). `where({ amount: '10.10' })`
compares by value on all engines except SQLite, where it is a text comparison.

**MSSQL rewrite details** (`BaseCompiler.exactNumericSelect(expr, sqlType?)`,
which returns `undefined` on every other dialect, so their SQL is unchanged):

```sql
-- lines.from(db).execute() with amount DECIMAL(19,2), fee MONEY:
SELECT lines.id, CONVERT(VARCHAR(40), lines.amount, 2) AS amount,
       CONVERT(VARCHAR(40), lines.fee, 2) AS fee, lines.big FROM lines
-- .fields('amount', ['fee', 'f'], sum('amount', 'total')):
SELECT CONVERT(VARCHAR(40), amount, 2) AS amount, CONVERT(VARCHAR(40), fee, 2) AS f,
       CONVERT(VARCHAR(40), SUM(amount), 2) AS total FROM lines
```

- Style `2` keeps all four `MONEY` places (style 0 rounds to two) and is
  ignored for `DECIMAL`/`NUMERIC`.
- A bare `SELECT *` is expanded to the schema's columns only when one of them
  is `DECIMAL`/`NUMERIC`/`MONEY`. With joins, the expansion lists each column
  name once, from the first table that has it (base table first), qualified
  as `table.col`. Columns in the database but not in the schema are not
  selected.
- Raw SQL is not rewritten: `db.execute('SELECT amount FROM lines')` on MSSQL
  returns a float. Write `CONVERT(VARCHAR(40), amount, 2) AS amount` yourself.

**SQLite details:** SQLite has no decimal type. `DECIMAL(p, s)` gets NUMERIC
affinity, which stores `'12345678901234567.89'` as the integer
`12345678901234568` and `'0.1'` as a float. `TEXT` affinity keeps the string.
Consequences: `ORDER BY`, `<`/`>` and `MIN`/`MAX` compare as text (`'9.00'` >
`'10.00'`), and `SUM`/`AVG` are float. `precision`/`scale` are accepted and
ignored. Tables created before this change keep `DECIMAL` columns (NUMERIC
affinity); the migration diff reports the type change but SQLite cannot
`ALTER COLUMN`, so rebuild the table. Old REAL values still read as strings
(`10.1` → `'10.1'`).

**Typed path parses joins and aliases.** `table.from(db).execute()` applies the
parsers of the base table, of every joined table's columns (first table wins
on a name clash), of `[column, alias]` fields under the alias, and of computed
fields that carry `parse`.

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

---

## 19. Dialect-Specific Behaviors

| Behavior                    | Details                                                                                                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Identifier quoting**      | `"id"` (PG, SQLite) · `` `id` `` (MySQL, CH) · `[id]` (MSSQL)                                          |
| **Placeholders**            | `?` (SQLite/MySQL/CH) · `$N` (PG) · `@pN` (MSSQL)                                                      |
| **RETURNING**               | PostgreSQL + SQLite only. Others throw `"RETURNING is not supported by this dialect"`                       |
| **FULL OUTER JOIN**         | PostgreSQL + ANSI only. SQLite/MySQL/ClickHouse throw at compile time                                       |
| **ClickHouse params**       | Values inlined into SQL (HTTP API has no native binding). Safe via `escapeClickHouseValue()`                |
| **ClickHouse CREATE INDEX** | Not emitted. Indexes are defined via the ENGINE / ORDER BY clause                                           |
| **ClickHouse UNIQUE**       | Not supported. Throws if `.unique()` is used in a ClickHouse table                                          |
| **MSSQL LIMIT**             | Renders as `OFFSET n ROWS FETCH NEXT m ROWS ONLY`. Injects `ORDER BY (SELECT NULL)` when no ORDER BY exists |
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

result.data; // Record<string, unknown>[]  : actual rows
result.meta; // { name: string; type: string }[]  : column metadata
result.rows; // number  : row count
result.statistics?.read_rows; // optional stats
```

---

## 23. Error Reference

| Error message                                                                        | When it occurs                                                                                    |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `"RETURNING is not supported by this dialect"`                                       | `.returning()` called on MySQL/MSSQL/ClickHouse and `.toSQL()` called                            |
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
// WRONG: SQL injection risk
const rows = await db.execute(`SELECT * FROM users WHERE name = '${name}'`);

// CORRECT: use parameterised query or tagged template
const rows = await db.sql`SELECT * FROM users WHERE name = ${name}`.execute();
```

**DO NOT** call `.stream()` or `.prepare()` on MySQL, MSSQL, or ClickHouse
engines: they throw.

**DO NOT** use `.returning()` on MySQL, MSSQL, or ClickHouse: throws `"RETURNING is not supported by this dialect"`.

**DO NOT** use `.full_join()` with SQLite, MySQL, or ClickHouse: throws at
compile time.

**DO NOT** call `batcher.write()` after `batcher.close()`: rejects.

**DO NOT** forget `await batcher.close()`: rows may be left unwritten.

**DO NOT** use the pooled engine inside a transaction callback. Use `tx`:

```ts
// WRONG: this INSERT runs on a different connection, outside the transaction
await db.transaction(async (tx) => { await db.execute(insertSql); });

// CORRECT
await db.transaction(async (tx) => { await tx.execute(insertSql); });
```

**DO NOT** pass user input to `.order_by()`, `.group_by()`, `.select()`,
`.from()`, or a join `ON` condition. These cannot be bound parameters, so they
are interpolated. They are validated and will throw `UnsafeIdentifierError` on
anything dangerous, but that is a guard, not a licence: map a sort parameter
through a fixed allow-list of column names:

```ts
// WRONG
query.order_by(req.query.sort);

// CORRECT
const SORTS = { date: "created_at DESC", amount: "total DESC" } as const;
query.order_by(SORTS[req.query.sort as keyof typeof SORTS] ?? SORTS.date);
```

**DO NOT** treat `decimal`/`numeric`/`bigint`/`bigserial` values as numbers.
They are typed `string` because float64 cannot hold them exactly. `Number(x)`
on a money column loses cents:

```ts
// WRONG: reintroduces the precision loss the string type exists to prevent
const total = rows.reduce((a, r) => a + Number(r.debit), 0);

// CORRECT: sum in SQL...
const [{ total }] = await db.sql`SELECT SUM(debit)::text AS total FROM jurnal`.execute();

// ...or with the exact helpers this package ships (BigInt, no dependency)
import { sumDecimals } from "@coderbuzz/sql/decimal";
const total = sumDecimals(rows.map(r => r.debit));
```

**DO validate incoming amounts with `decimal()` from `@coderbuzz/veta`**, not
`number()`. It takes and returns the same normalized string this package uses,
so there is no conversion at the HTTP boundary, and conversions are where
precision goes:

```ts
import { decimal, object } from "@coderbuzz/veta";

const postJournal = object({
  ref: string(),
  amount: decimal({ precision: 18, scale: 2 }), // "1234.5" → "1234.50"
});
```

`number()` would accept `1234.5` as a float64 and hand it on looking exact.

**DO NOT** read `DECIMAL` through raw SQL on MSSQL and trust it: `tedious`
returns a float64. Only the typed path rewrites it. In raw SQL, select
`CONVERT(VARCHAR(40), col, 2)`.

**DO NOT** rely on `SUM`, `ORDER BY` or range comparisons over a `decimal()`
column on SQLite; they run on text or floats. Fetch and use
`@coderbuzz/sql/decimal` (`sumDecimals`, `compareDecimals`).

**Expect `BIGINT` and `COUNT(*)` as strings in raw MySQL results.** The engine
enables `bigNumberStrings`, matching PostgreSQL. `count()` on the typed path
still returns a number.

**DO NOT** use `DELETE` or `UPDATE` without `.where()` unless you intend to
affect all rows. Add a middleware guard in production code.

**DO NOT** use `.unique()` on ClickHouse table columns: throws.

---

## 25. Exact Decimal Arithmetic (`@coderbuzz/sql/decimal`)

Every function takes and returns **decimal strings**, the same representation
`NUMERIC`/`DECIMAL`/`BIGINT` columns produce and `decimal()` from
`@coderbuzz/veta` validates. Internally each value parses to a scaled `BigInt`
(`'12.34'` → `1234n` at scale 2), so no float64 is ever involved. Zero
dependencies: there is no `decimal.js` or `big.js` under this.

### Input types

```ts
type DecimalInput = string | bigint | number;
```

- `string`: the normal case. Must match `/^-?\d+(\.\d+)?$/`. No exponents, no
  thousands separators, no currency symbols, at least one integer digit
  (`'.5'` and `'1.'` are rejected).
- `bigint`: accepted at scale 0.
- `number`: accepted **only** when `Number.isSafeInteger(n)`. `12.34` throws;
  it has already lost precision before the call.

Anything else throws `DecimalError`.

### Rounding modes

```ts
type RoundingMode =
  | "half-up"    // default; ties away from zero: 0.125 → 0.13, -0.125 → -0.13
  | "half-even"  // banker's; ties to even: 0.125 → 0.12, 0.135 → 0.14
  | "half-down"  // ties toward zero
  | "up"         // always away from zero
  | "down"       // always toward zero (truncate)
  | "ceil"       // toward +Infinity
  | "floor";     // toward -Infinity
```

### Full signatures

| Function | Signature | Result scale |
| --- | --- | --- |
| `add` | `(a: DecimalInput, b: DecimalInput, options?: DecimalOpOptions) => string` | `max(scaleA, scaleB)` |
| `subtract` | `(a, b, options?) => string` | `max(scaleA, scaleB)` |
| `multiply` | `(a, b, options?) => string` | `scaleA + scaleB` (exact product) |
| `divide` | `(a, b, options: DecimalOpOptions & { scale: number }) => string` | `options.scale` (required) |
| `negate` | `(value: DecimalInput) => string` | unchanged |
| `absDecimal` | `(value: DecimalInput) => string` | unchanged |
| `sumDecimals` | `(values: readonly DecimalInput[], options?) => string` | largest input scale; `'0'` for `[]` |
| `roundDecimal` | `(value, scale: number, rounding?: RoundingMode) => string` | `scale` |
| `normalizeDecimal` | `(value, scale?: number, rounding?: RoundingMode) => string` | `scale`, or unchanged |
| `compareDecimals` | `(a, b) => -1 \| 0 \| 1` | n/a |
| `equalsDecimal` | `(a, b) => boolean` | n/a |
| `lessThanDecimal` | `(a, b) => boolean` | n/a |
| `greaterThanDecimal` | `(a, b) => boolean` | n/a |
| `isZeroDecimal` | `(value) => boolean` | n/a |
| `isNegativeDecimal` | `(value) => boolean` | `'-0.00'` is **not** negative |
| `maxDecimal` / `minDecimal` | `(a, b) => string` | n/a |
| `isDecimalString` | `(value: unknown) => value is string` | n/a |
| `toMinorUnits` | `(value, scale: number, rounding?: RoundingMode) => bigint` | n/a |
| `fromMinorUnits` | `(units: bigint \| number, scale: number) => string` | `scale` |
| `allocate` | `(total, weights: readonly DecimalInput[], options: { scale: number }) => string[]` | `scale` |
| `splitEvenly` | `(total, parts: number, options: { scale: number }) => string[]` | `scale` |

```ts
type DecimalOpOptions = {
  scale?: number;              // 0..100; omitted = keep the exact scale
  rounding?: RoundingMode;     // default 'half-up'
};
```

### Behavioural notes

- **Nothing rounds implicitly.** `add`, `subtract` and `multiply` return the
  exact result and let the scale grow; pass `{ scale }` to round. `divide`
  requires `scale` because no default is honest.
- **Normalisation is canonical.** Leading zeros are dropped, `-0` becomes `0`,
  and `{ scale }` pads with zeros. Two equal amounts are therefore equal
  strings, usable as map keys and with `===`.
- **Comparison is by value, not by string order.** `compareDecimals('2.00',
  '10.00')` is `-1`; `'2.00' < '10.00'` as strings is `false`.
- **`sumDecimals` is order-independent**, which is what makes a
  `debit === credit` check meaningful.
- **`toMinorUnits` refuses to lose a digit** unless a rounding mode is passed:
  `toMinorUnits('1234.565', 2)` throws, `toMinorUnits('1234.565', 2, 'half-up')`
  is `123457n`. Trailing zeros do not count as a lost digit.
- **`allocate` always sums to the total.** It floors each share, then hands out
  the leftover minor units to the largest discarded fractions, ties to the
  earlier index (so it is deterministic). Negative totals allocate their
  magnitude and carry the sign. Weights must be non-negative and must not all
  be zero; an empty weight list throws.
- **`splitEvenly(total, n, { scale })`** is `allocate` with equal weights: the
  earliest parts absorb the odd minor units, the instalment convention.
- **Errors** are always `DecimalError`, never a silent `NaN`. Division by zero
  throws rather than returning `Infinity`.

### Worked ERP line

```ts
import { multiply, subtract, add, allocate, sumDecimals } from "@coderbuzz/sql/decimal";

const gross    = multiply(row.price, row.qty);              // '139.93' exactly
const discount = multiply(gross, "0.15", { scale: 2 });     // 20.9895 → '20.99'
const net      = subtract(gross, discount);                 // '118.94'
const tax      = multiply(net, "0.11", { scale: 2 });       // 13.0834 → '13.08'
const total    = add(net, tax);                             // '132.02'

const perCentre = allocate(tax, ["1", "1", "1"], { scale: 2 });
sumDecimals(perCentre) === tax;                             // true, always
```

---

## 26. PostgreSQL on Bun (`@coderbuzz/sql/postgres-bun`)

`BunPostgresEngine` drives PostgreSQL through Bun's built-in SQL client
(`Bun.SQL`, Bun 1.2+; the suite is run on Bun 1.3 and 1.4). No peer dependency:
the protocol is in the runtime.
Everything `PostgresEngine` does, this does, with the same semantics. Only the
import path differs.

```ts
import { pg } from "@coderbuzz/sql/postgres-bun";
const db = pg.connect({ connectionString: process.env.DATABASE_URL, max: 10 });
```

On a runtime without `Bun.SQL` the constructor throws with a message pointing at
`@coderbuzz/sql/postgres`; it does not fail at import time.

### Parity with the `pg` engine

| Capability | `@coderbuzz/sql/postgres` | `@coderbuzz/sql/postgres-bun` |
| --- | --- | --- |
| `transaction(fn, { isolation, readOnly, setup })` | one pooled client | one reserved connection |
| `tx.savepoint()` | yes | yes |
| `forTenant(tenantId)` + RLS binding lock | yes | yes |
| `unsafeCrossTenant(reason, fn)` | yes (separate BYPASSRLS pool) | yes (separate BYPASSRLS client) |
| `stream()` | `DECLARE CURSOR` + `FETCH FORWARD` | same |
| `prepare()` | named statement + `DEALLOCATE` | statement cached on a held connection |
| `withAdvisoryLock(key, fn, wait?)` | yes | yes |
| Middleware sees `BEGIN`/`COMMIT`/`ROLLBACK` | yes | yes |
| Connection destroyed after a failed `ROLLBACK` | `release(true)` | `connection.close()` |
| Driver | `pg` peer dependency | none |

### Config (`BunPostgresConfig`)

| Option | Default | Meaning |
| --- | --- | --- |
| `connectionString` | none | `postgres://user:pass@host:port/db`; an explicit `user`/`password` overrides the credentials inside it (this is what lets `unsafeCrossTenant` swap in the BYPASSRLS role) |
| `host` / `port` / `database` / `user` / `password` | `localhost` / `5432` / none / none / none | connection parts |
| `max` | `10` | pool size |
| `idleTimeout` | driver default | seconds a pooled connection may idle |
| `connectionTimeout` | driver default | seconds to wait for a connection |
| `maxLifetime` | driver default | seconds before a connection is recycled |
| `bigint` | `false` | `true` → `int8` arrives as a JS `bigint` |
| `prepare` | `true` | `false` for PgBouncer in transaction mode |
| `tls` / `sslMode` | none | passed through to `Bun.SQL` |
| `streamBatchSize` | `1000` | rows per `FETCH FORWARD` in `stream()` |
| `tenantSetting` | `'app.tenant_id'` | run-time parameter RLS policies read |
| `crossTenant` | none | `{ user, password, max? }` for a `BYPASSRLS` role |
| `onCrossTenantAccess` | none | called with the reason on every `unsafeCrossTenant()` |

### Type mapping (verified against PostgreSQL 16 via Bun)

| PostgreSQL type | JS value from the driver | Column factory | Declared TS type |
| --- | --- | --- | --- |
| `numeric` / `decimal` | `string` (exact, any precision) | `pg.numeric(p,s)` / `pg.decimal(p,s)` | `string` |
| `bigint` / `int8` | `string`, or `bigint` with `{ bigint: true }` | `pg.bigint()` | `string` |
| `bigserial` | `string` | `pg.bigserial()` | `string` |
| `count(*)`, any `int8` aggregate | `string` | n/a | n/a |
| `integer` / `smallint` / `serial` | `number` | `pg.integer()` … | `number` |
| `double precision` / `real` | `number` | `pg.doublePrecision()` | `number` |
| `boolean` | `boolean` | `pg.boolean()` | `boolean` |
| `timestamptz` / `timestamp` / `date` | `Date` | `pg.timestamptz()` … | `Date` |
| `json` / `jsonb` | parsed object | `pg.jsonb()` | `object` |
| `bytea` | `Buffer` | `pg.bytea()` | n/a |
| `uuid` / `text` / `varchar` | `string` | `pg.uuid()` … | `string` |
| `money` | `string`, **locale-formatted** (`'$1,234.56'`) | none offered | n/a |

Gotchas that follow from the table:

- `count(*)` is `int8`, so `rows[0].n` is `'41'`, not `41`. Cast in SQL
  (`count(*)::int`) or read it as a decimal string.
- `money` is not a decimal string under any driver. Use `numeric(p, s)`.
- Binding a JS `number` to a `numeric` column silently goes through float64:
  `${0.1 + 0.2}` lands as `0.30`. Bind the string.
- `{ bigint: true }` changes what the driver returns, not what a column
  promises: the typed path still yields `string` for `bigint()` columns.

### Methods beyond the shared `Sql` surface

```ts
db.tenantSetting;                                  // string
db.client;                                         // the raw Bun.SQL object (LISTEN/NOTIFY, file(), beginDistributed)
db.forTenant(tenantId(id));                        // TenantScopedSql
db.unsafeCrossTenant(reason, async admin => ...);  // needs config.crossTenant
db.withAdvisoryLock(key, fn, wait?);               // Promise<R | undefined>
db.stream(compiledQuery);                          // AsyncIterable<row>
db.prepare(compiledQuery);                         // { execute(params?), close() }
await db.close();                                  // closes both clients
```

`db.client` bypasses middleware and is not part of any transaction the engine
opened. Use it for Bun features this engine does not wrap, not for queries.

---

## 27. MySQL on Bun (`@coderbuzz/sql/mysql-bun`)

`BunMySQLEngine` drives MySQL and MariaDB through Bun's built-in SQL client
(`Bun.SQL` with `adapter: 'mysql'`; verified on Bun 1.4.2 against MySQL 8.4).
No peer dependency. The exported `mysql` namespace has exactly the members of
the one from `@coderbuzz/sql/mysql` (a test asserts it), and `mysqlBun` is an
alias for files that import both.

```ts
import { mysql } from "@coderbuzz/sql/mysql-bun";
const db = mysql.connect({ host: "localhost", database: "app", user: "app", password: "secret" });
```

On a runtime without `Bun.SQL` the constructor throws with a message pointing at
`@coderbuzz/sql/mysql`; it does not fail at import time. Connecting is lazy:
`connect()` never throws for an unreachable server, the first query does.

### Parity with the `mysql2` engine

`tests/sql.mysql.test.ts` runs its whole suite (DDL, CRUD, joins, CTE, UNION,
transactions, savepoints, SERIALIZABLE locking, middleware, migrate, batch
insert) once per engine. Both pass the same assertions.

| Capability | `@coderbuzz/sql/mysql` | `@coderbuzz/sql/mysql-bun` |
| --- | --- | --- |
| `transaction(fn, { isolation, readOnly, setup })` | one pooled connection | one reserved connection |
| `tx.savepoint()` | yes | yes |
| Middleware sees `START TRANSACTION`/`COMMIT`/`ROLLBACK` | yes | yes |
| Connection destroyed after a failed `ROLLBACK` | `conn.destroy()` | `connection.close()` |
| `stream()` / `prepare()` | throws (not supported) | throws (not supported) |
| Driver | `mysql2` peer dependency | none |

Why the failed-ROLLBACK rule matters here: Bun's `release()` does **not** roll
back. Measured with a pool of one connection: after `START TRANSACTION`, an
`INSERT` and `release()`, the next query ran on the same `CONNECTION_ID()` with
the transaction still open and the uncommitted row visible. The engine only
releases after a clean `COMMIT`/`ROLLBACK`; otherwise it destroys the
connection. A test forces `ROLLBACK` to fail and checks that the next query
gets a different connection and cannot see the row.

### Config (`BunMySQLConfig`)

| Option | Default | Meaning |
| --- | --- | --- |
| `host` / `port` | `localhost` / `3306` | pinned, so `MYSQL_HOST`/`DATABASE_URL` cannot redirect the engine |
| `database` / `user` / `password` | **from the environment** | see the warning below |
| `connectionString` | none | `mysql://user:pass@host:port/db`; explicit fields win |
| `connectionLimit` | `10` | pool size, same name as the `mysql2` engine |
| `idleTimeout` / `connectionTimeout` / `maxLifetime` | driver default | seconds |
| `tls` | none | passed through to `Bun.SQL` |
| `allowPublicKeyRetrieval` | `false` | allow RSA key retrieval for `caching_sha2_password` without TLS |

**Environment fallback (measured on Bun 1.4.2).** `Bun.SQL` fills every
connection field left out from the environment, and an empty string counts as
left out. `database`, `user` and `password` resolve from `DATABASE_URL` first,
then `MYSQL_DATABASE` / `MYSQL_USER` / `MYSQL_PASSWORD`. With
`DATABASE_URL=postgres://app:pgsecret@pg-host/app` in the environment,
`mysql.connect({ host: 'mysql-host', user: 'root' })` logs in to `mysql-host`
with password `pgsecret`, handing the PostgreSQL password to the MySQL server.
There is no option to turn this off. Always pass `database`, `user` and
`password` explicitly, or a full `connectionString`. The `mysql2` engine reads
no environment variables.

**Date values move between engines.** `mysql2` writes and reads `DATETIME` in
the process's local time zone; `Bun.SQL` uses UTC. Measured on a `+07:00`
machine, the same `Date('2024-01-02T03:04:05.678Z')` is stored as
`2024-01-02 10:04:05.678` by `mysql2` and `2024-01-02 03:04:05.678` by Bun.
Each engine round-trips its own writes, but switching an existing database
from `mysql2` to this engine shifts every `DATETIME` by the offset, unless the
application ran with `TZ=UTC`. Check `TZ` before switching.

MySQL 8 without TLS and without `allowPublicKeyRetrieval: true` fails the first
query with `ERR_MYSQL_PUBLIC_KEY_RETRIEVAL_NOT_ALLOWED`. The default is `false`
because without TLS a man in the middle can supply its own key and read the
password. `mysql2` allows it without asking, so moving from `mysql2` to this
engine against a non-TLS MySQL 8 needs either `tls` or this flag.

### Type mapping (verified against MySQL 8.4, raw `db.execute()` rows)

| MySQL type | `mysql2` engine | `Bun.SQL` engine |
| --- | --- | --- |
| `DECIMAL(p,s)` | `string`, exact | `string`, exact |
| `SUM`/`AVG` over `DECIMAL` or `INT` | `string` | `string` |
| `BIGINT` | `string` (`bigNumberStrings`) | `number` if ≤ 2^53, else `string` |
| `COUNT(*)` | `string` | `number` |
| `INT` / `TINYINT(1)` / `YEAR` / `INT UNSIGNED` | `number` | `number` |
| `FLOAT` / `DOUBLE` | `number` | `number` |
| `DATETIME` / `DATE` | `Date`, **local** time zone | `Date`, **UTC** |
| `TIME` | `string` | `string` |
| `JSON` | parsed object | parsed object |
| `BLOB` / `VARBINARY` | `Buffer` | `Buffer` |
| `ENUM` | `string` | `string` |

On the typed path (`table.from(db).execute()`) `bigint()` columns and `count()`
parse to the same `string` / `number` on both engines, so only raw results and
dates differ. Parameters: `true`/`false` bind as `1`/`0`, a decimal string binds
exactly, a `Date` is written as its UTC wall-clock time (`mysql2`: local).

Errors are `MySQLError` with `code: 'ERR_MYSQL_SERVER_ERROR'` for every server
error. `errno` (`1062` duplicate key, `1054` unknown column) and `sqlState`
(`'23000'`, `'42S22'`) match `mysql2`, so branch on those, never on `code`.

### Methods beyond the shared `Sql` surface

```ts
db.client;        // the raw Bun.SQL object; bypasses middleware and transactions
await db.close();
```

---

## 28. Quick Code Patterns

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

// Read: typed result
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

## 29. Package Metadata

```
Package: @coderbuzz/sql
Version: 0.1.3
License: MIT
Type:    ESM only (type: "module")
Peer deps (all optional): pg, mysql2, mssql, better-sqlite3, @db/sqlite
Runtime dep: @coderbuzz/veta (internal, schema coercion)
```

**Export map summary:**

| Import path                       | Contents                            |
| --------------------------------- | ----------------------------------- |
| `@coderbuzz/sql`                  | Core classes, helpers, ANSI types   |
| `@coderbuzz/sql/sqlite`           | `sqlite` namespace + `SQLiteEngine` |
| `@coderbuzz/sql/postgres`         | `pg` namespace + `PostgresEngine`   |
| `@coderbuzz/sql/postgres-bun`     | `pg` namespace + `BunPostgresEngine` |
| `@coderbuzz/sql/decimal`          | Exact decimal arithmetic helpers    |
| `@coderbuzz/sql/mysql`            | `mysql` namespace + `MySQLEngine`   |
| `@coderbuzz/sql/mysql-bun`        | `mysql` namespace + `BunMySQLEngine` |
| `@coderbuzz/sql/mssql`            | `mssql` namespace + `MSSQLEngine`   |
| `@coderbuzz/sql/clickhouse`       | `ch` namespace + `ClickHouseEngine` |
| `@coderbuzz/sql/sqlite-types`     | SQLite column factories only        |
| `@coderbuzz/sql/postgres-types`   | PostgreSQL column factories only    |
| `@coderbuzz/sql/mysql-types`      | MySQL column factories only         |
| `@coderbuzz/sql/mssql-types`      | MSSQL column factories only         |
| `@coderbuzz/sql/clickhouse-types` | ClickHouse column factories only    |
| `@coderbuzz/sql/ansi`             | ANSI column factories only          |
