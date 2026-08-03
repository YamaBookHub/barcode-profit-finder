import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DEFAULT_SETTINGS,
  MARKETPLACES,
  buildSearchUrls,
  calculateMarketStats,
  calculateProfit,
  calculateTurnover,
  judgePurchase,
  normalizeMarketplace,
} from "../calculator.js";
import {
  CAMERA_CONSTRAINT_ATTEMPTS,
  DuplicateGuard,
  cameraErrorMessage,
  createBarcodeReader,
  extractPriceCandidates,
  normalizeBarcode,
  requestCameraStream,
} from "../scanner.js";
import { StorageRepository, csvEscape, itemsToCsv } from "../storage.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test("公開用モジュールの依存URLを同じキャッシュ版へ統一する", () => {
  const versions = new Set();
  ["app.js", "storage.js", "camera-test.js"].forEach((filename) => {
    const source = readFileSync(new URL(`../${filename}`, import.meta.url), "utf8");
    const imports = [...source.matchAll(/from\s+"\.\/[^"?]+\.js\?v=(\d+)"/g)];
    assert.ok(imports.length > 0, `${filename}にバージョン付き依存URLが必要です`);
    imports.forEach((match) => versions.add(match[1]));
    assert.doesNotMatch(source, /from\s+"\.\/[^"?]+\.js"/);
  });
  assert.equal(versions.size, 1);
});

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
  assert.equal(calculateTurnover({
    soldCount: 1,
    activeCount: 1,
    recentSaleDate: "2026-03-07",
    checkedDate: "2026-03-09",
  }).daysSinceSale, 2);
  assert.equal(calculateTurnover({
    recentSaleDate: "2026-08-04",
    checkedDate: "2026-08-03",
  }).daysSinceSale, 0);
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

test("商品名があればJANコードより商品名を検索語に使う", () => {
  const urls = buildSearchUrls("4901234567894", "ワイヤレスイヤホン");
  assert.equal(urls.term, "ワイヤレスイヤホン");
  assert.match(urls.mercari, /%E3%83%AF%E3%82%A4%E3%83%A4%E3%83%AC%E3%82%B9/);
  assert.doesNotMatch(urls.mercari, /4901234567894/);
});

test("販売先ごとの手数料と検索先を安全な初期値にする", () => {
  assert.equal(MARKETPLACES.mercari.feeRate, 10);
  assert.equal(MARKETPLACES.mercari.searchKey, "mercariSold");
  assert.equal(MARKETPLACES.yahooFlea.feeRate, 5);
  assert.equal(MARKETPLACES.amazon.feeRate, null);
  assert.equal(normalizeMarketplace("unknown"), "mercari");
});

test("重複コードを3秒間抑止し、値札の金額候補を抽出する", () => {
  const guard = new DuplicateGuard(3000);
  assert.equal(guard.isDuplicate("490", 1000), false);
  assert.equal(guard.isDuplicate("490", 2500), true);
  assert.equal(guard.isDuplicate("490", 4100), false);
  assert.deepEqual(extractPriceCandidates("特価 ￥1,980 税込 2980円"), [1980, 2980]);
  assert.deepEqual(
    extractPriceCandidates("￥3,980 ￥3,980 ￥4,200", 5, { deduplicate: false }),
    [3980, 3980, 4200],
  );
  assert.deepEqual(
    extractPriceCandidates("2026 08 04 12件 ￥3,980 50% 4,200円", 5, { deduplicate: false, requireCurrency: true }),
    [3980, 4200],
  );
});

test("カメラ権限拒否時にSafariの対処方法を日本語で返す", () => {
  const message = cameraErrorMessage({ name: "NotAllowedError" });
  assert.match(message, /カメラの利用が許可されていません/);
  assert.match(message, /Webサイトの設定/);
  assert.match(message, /NotAllowedError/);
});

test("DecodeHintTypeを公開しないZXingブラウザ版でも読取機能を初期化できる", () => {
  class MockReader {
    constructor(hints, options) {
      this.hints = hints;
      this.options = options;
    }

    set possibleFormats(formats) { this.formats = formats; }
  }
  const ZXing = {
    BrowserMultiFormatReader: MockReader,
    BarcodeFormat: { EAN_13: 7, EAN_8: 6, UPC_A: 14, UPC_E: 15, CODE_128: 4 },
  };
  const reader = createBarcodeReader(ZXing);
  assert.deepEqual(reader.formats, [7, 6, 14, 15, 4]);
  assert.equal(reader.options.tryPlayVideoTimeout, 5000);
  assert.equal("DecodeHintType" in ZXing, false);
});

test("iPhone向け背面カメラ制約に失敗したら単純なvideo指定へフォールバックする", async () => {
  const calls = [];
  const expectedStream = { getTracks: () => [] };
  const mediaDevices = {
    async getUserMedia(constraints) {
      calls.push(constraints);
      if (calls.length === 1) {
        const error = new Error("constraint failed");
        error.name = "OverconstrainedError";
        throw error;
      }
      return expectedStream;
    },
  };
  assert.equal(await requestCameraStream(mediaDevices), expectedStream);
  assert.deepEqual(calls, CAMERA_CONSTRAINT_ATTEMPTS);
});

test("カメラ権限拒否時は許可ダイアログを繰り返さない", async () => {
  let calls = 0;
  const mediaDevices = {
    async getUserMedia() {
      calls += 1;
      const error = new Error("denied");
      error.name = "NotAllowedError";
      throw error;
    },
  };
  await assert.rejects(() => requestCameraStream(mediaDevices), { name: "NotAllowedError" });
  assert.equal(calls, 1);
});

test("ホーム画面版のカメラ停止時はSafari本体で開く案内を表示する", () => {
  const message = cameraErrorMessage(
    { name: "TrackEndedError" },
    undefined,
    { standalone: true },
  );
  assert.match(message, /Safari本体/);
  assert.match(message, /TrackEndedError/);
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
  assert.equal(repository.loadItems()[0].shippingConfirmed, false);
  assert.equal(repository.saveItems([{ ...item, shipping: 0, shippingConfirmed: true }]), true);
  assert.equal(repository.loadItems()[0].shippingConfirmed, true);
  const backup = repository.createBackup([item], DEFAULT_SETTINGS);
  assert.equal(repository.parseBackup(backup).items.length, 1);
  assert.equal(csvEscape('A,"B"'), '"A,""B"""');
  assert.match(itemsToCsv([item]), /商品名,JANコード/);
});

test("検索画面へ移動する前の入力途中データを保存・復元・削除できる", () => {
  const repository = new StorageRepository(new MemoryStorage());
  const draft = {
    barcode: "4901234567894",
    productName: "テスト商品",
    purchasePrice: "1200",
    salePrice: "3500",
    marketPrices: ["3000", "3500", "4000", "", ""],
    marketplace: "mercari",
    shippingConfirmed: true,
    note: "棚の上段",
    marketSearchPending: true,
  };
  assert.equal(repository.saveDraft(draft), true);
  assert.deepEqual(
    Object.fromEntries(Object.entries(repository.loadDraft()).filter(([key]) => ["barcode", "productName", "purchasePrice", "salePrice", "marketPrices", "marketplace", "shippingConfirmed", "note", "marketSearchPending"].includes(key))),
    draft,
  );
  assert.equal(repository.clearDraft(), true);
  assert.equal(repository.loadDraft(), null);
});
