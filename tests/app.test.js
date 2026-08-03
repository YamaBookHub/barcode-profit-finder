import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_SETTINGS,
  buildSearchUrls,
  calculateProfit,
  csvEscape,
  judgePurchase,
  normalizeBarcode,
} from "../app.js";

test("利益、利益率、ROI、損益分岐売価を計算する", () => {
  const result = calculateProfit({
    purchasePrice: 5000,
    salePrice: 10000,
    feeRate: 10,
    shipping: 750,
    packaging: 100,
    otherCosts: 150,
  });

  assert.equal(result.fee, 1000);
  assert.equal(result.net, 8000);
  assert.equal(result.profit, 3000);
  assert.equal(result.margin, 30);
  assert.equal(result.roi, 60);
  assert.equal(result.breakEvenPrice, 6666);
});

test("販売手数料は1円未満を切り捨てる", () => {
  const result = calculateProfit({ purchasePrice: 0, salePrice: 999, feeRate: 10 });
  assert.equal(result.fee, 99);
  assert.equal(result.net, 900);
});

test("仕入価格0円のROIは算出不可にする", () => {
  const result = calculateProfit({ purchasePrice: 0, salePrice: 3000, feeRate: 10 });
  assert.equal(result.roi, null);
  assert.equal(judgePurchase(result, DEFAULT_SETTINGS), "review");
});

test("初期ルールで仕入判定を優先順どおり返す", () => {
  assert.equal(judgePurchase({ profit: 2500, roi: 50 }, DEFAULT_SETTINGS), "candidate");
  assert.equal(judgePurchase({ profit: 2500, roi: 20 }, DEFAULT_SETTINGS), "review");
  assert.equal(judgePurchase({ profit: 1200, roi: 10 }, DEFAULT_SETTINGS), "review");
  assert.equal(judgePurchase({ profit: 500, roi: 80 }, DEFAULT_SETTINGS), "skip");
  assert.equal(judgePurchase({ profit: -1, roi: -0.1 }, DEFAULT_SETTINGS), "loss");
});

test("検索URLに正規化済みバーコードを埋め込む", () => {
  const urls = buildSearchUrls(" 490 123 ");
  assert.match(urls.google, /490123/);
  assert.match(urls.mercariSold, /status=sold_out/);
  assert.match(urls.yahooAuction, /490123/);
  assert.equal(normalizeBarcode(" ab 12 "), "AB12");
});

test("CSV用の値を安全にエスケープする", () => {
  assert.equal(csvEscape("通常"), "通常");
  assert.equal(csvEscape('A,"B"'), '"A,""B"""');
  assert.equal(csvEscape("1\n2"), '"1\n2"');
});
