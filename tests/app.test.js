import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SETTINGS,
  buildSearchUrls,
  calculateMarketStats,
  calculateProfit,
  calculateTurnover,
  judgePurchase,
} from "../calculator.js";
import { DuplicateGuard, cameraErrorMessage, extractPriceCandidates, normalizeBarcode } from "../scanner.js";
import { StorageRepository, csvEscape, itemsToCsv } from "../storage.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test("利益、利益率、ROI、損益分岐売価を正しく計算する", () => {
  const result = calculateProfit({
    purchasePrice: 5000,
    salePrice: 10000,
    feeRate: 10,
    shipping: 750,
    packaging: 100,
    otherCosts: 150,
  });
  assert.deepEqual(
    { fee: result.fee, net: result.net, profit: result.profit, margin: result.margin, roi: result.roi, breakEvenPrice: result.breakEvenPrice },
    { fee: 1000, net: 8000, profit: 3000, margin: 30, roi: 60, breakEvenPrice: 6666 },
  );
});

test("手数料を切り捨て、仕入価格0円のROIを算出不可にする", () => {
  assert.equal(calculateProfit({ salePrice: 999, feeRate: 10 }).fee, 99);
  const free = calculateProfit({ purchasePrice: 0, salePrice: 3000, feeRate: 10 });
  assert.equal(free.roi, null);
  assert.equal(judgePurchase(free, DEFAULT_SETTINGS), "review");
});

test("初期の5段階ルールを優先順どおり返す", () => {
  assert.equal(judgePurchase({ profit: 3000, roi: 50 }, DEFAULT_SETTINGS), "strong");
  assert.equal(judgePurchase({ profit: 2500, roi: 50 }, DEFAULT_SETTINGS), "candidate");
  assert.equal(judgePurchase({ profit: 2500, roi: 20 }, DEFAULT_SETTINGS), "review");
  assert.equal(judgePurchase({ profit: 500, roi: 80 }, DEFAULT_SETTINGS), "skip");
  assert.equal(judgePurchase({ profit: -1, roi: -0.1 }, DEFAULT_SETTINGS), "loss");
});

test("最大5件の相場から中央値・平均・最安・最高を計算する", () => {
  assert.deepEqual(calculateMarketStats([5000, "3000", 4000, "", 9000]), {
    count: 4,
    median: 4500,
    average: 5250,
    min: 3000,
    max: 9000,
    prices: [3000, 4000, 5000, 9000],
  });
});

test("販売済み件数と現在出品数から回転スコアを返す", () => {
  assert.equal(calculateTurnover({ soldCount: 10, activeCount: 5 }).key, "fast");
  assert.equal(calculateTurnover({ soldCount: 2, activeCount: 5 }).key, "normal");
  assert.equal(calculateTurnover({ soldCount: 1, activeCount: 10 }).key, "slow");
  assert.equal(calculateTurnover({ soldCount: "", activeCount: "" }).key, "insufficient");
});

test("検索URLにバーコードを埋め込みAmazonを含める", () => {
  const barcode = normalizeBarcode(" 490 123 ");
  const urls = buildSearchUrls(barcode);
  assert.match(urls.google, /490123/);
  assert.match(urls.mercariSold, /status=sold_out/);
  assert.match(urls.yahooAuction, /490123/);
  assert.match(urls.amazon, /490123/);
  assert.equal(barcode, "490123");
});

test("重複コードを3秒間抑止し、値札の金額候補を抽出する", () => {
  const guard = new DuplicateGuard(3000);
  assert.equal(guard.isDuplicate("490", 1000), false);
  assert.equal(guard.isDuplicate("490", 2500), true);
  assert.equal(guard.isDuplicate("490", 4100), false);
  assert.deepEqual(extractPriceCandidates("特価 ￥1,980 税込 2980円"), [1980, 2980]);
});

test("カメラ権限拒否時にSafariの対処方法を日本語で返す", () => {
  const message = cameraErrorMessage({ name: "NotAllowedError" });
  assert.match(message, /カメラの利用が許可されていません/);
  assert.match(message, /Webサイトの設定/);
});

test("商品・設定の保存、JSON復元、CSVエスケープが機能する", () => {
  const repository = new StorageRepository(new MemoryStorage());
  const item = {
    id: "1", productName: 'A,"B"', barcode: "490", purchasePrice: 1000,
    salePrice: 3000, profit: 1500, roi: 150, margin: 50, verdict: "review",
    verdictLabel: "要確認", savedAt: "2026-08-04T00:00:00.000Z",
  };
  assert.equal(repository.saveItems([item]), true);
  assert.equal(repository.loadItems()[0].barcode, "490");
  const backup = repository.createBackup([item], DEFAULT_SETTINGS);
  assert.equal(repository.parseBackup(backup).items.length, 1);
  assert.equal(csvEscape('A,"B"'), '"A,""B"""');
  assert.match(itemsToCsv([item]), /商品名,JANコード/);
});
