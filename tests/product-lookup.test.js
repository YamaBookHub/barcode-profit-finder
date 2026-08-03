import test from "node:test";
import assert from "node:assert/strict";

import { isBookIsbn, lookupBookByIsbn } from "../product-lookup.js";

test("ISBN-13だけを書籍の商品名検索対象にする", () => {
  assert.equal(isBookIsbn("9784101010014"), true);
  assert.equal(isBookIsbn("4901234567894"), false);
  assert.equal(isBookIsbn("978410101001"), false);
});

test("openBD応答から本の商品名を取り出す", async () => {
  const result = await lookupBookByIsbn("9784101010014", {
    fetchImpl: async () => ({
      ok: true,
      json: async () => [{ summary: { title: "吾輩は猫である", publisher: "新潮社" } }],
    }),
  });
  assert.deepEqual(result, {
    title: "吾輩は猫である",
    publisher: "新潮社",
    isbn: "9784101010014",
  });
});
