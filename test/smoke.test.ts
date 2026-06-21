import { test, expect } from "bun:test";
import { Sql, count, sum } from "@coderbuzz/sql";

test("Sql builder produces SQL", () => {
  const db = new Sql();
  const result = db.select("name").from("users").where("id = ?", [1]).toSQL();
  expect(result.sql).toContain("SELECT");
  expect(result.sql).toContain("users");
});

test("aggregate functions", () => {
  expect(count().sql).toContain("COUNT");
  expect(sum("score").sql).toContain("SUM");
});