import {
  DEFAULT_SETTINGS,
  normalizeMarketplace,
  normalizeSettings,
  toFiniteNumber,
  toNonNegative,
} from "./calculator.js?v=15";

export const STORAGE_KEYS = Object.freeze({
  items: "barcodeProfitFinder.items.v2",
  settings: "barcodeProfitFinder.settings.v2",
  draft: "barcodeProfitFinder.draft.v1",
  tutorialSeen: "barcodeProfitFinder.tutorialSeen.v1",
  legacyItems: "barcodeProfitFinder.items.v1",
  legacySettings: "barcodeProfitFinder.settings.v1",
});

const ITEM_STRING_FIELDS = [
  "id", "productName", "barcode", "verdict", "verdictLabel", "storeName", "note",
  "savedAt", "updatedAt", "productSearchUrl", "recentSaleDate", "checkedDate", "marketplace",
];

const ITEM_NUMBER_FIELDS = [
  "purchasePrice", "salePrice", "feeRate", "shipping", "packaging", "otherCosts",
  "fee", "net", "profit", "margin", "roi", "breakEvenPrice", "soldCount", "activeCount",
];

const DRAFT_STRING_FIELDS = [
  "editingId", "barcode", "productName", "purchasePrice", "salePrice", "feeRate",
  "shipping", "packaging", "otherCosts", "storeName", "note", "soldCount",
  "activeCount", "recentSaleDate", "checkedDate", "updatedAt", "marketplace",
];

function safeString(value, maxLength = 5000) {
  return String(value ?? "").slice(0, maxLength);
}

export function normalizeStoredItem(item = {}) {
  const normalized = {};
  ITEM_STRING_FIELDS.forEach((field) => {
    normalized[field] = safeString(item[field], field === "note" ? 5000 : 1000);
  });
  ITEM_NUMBER_FIELDS.forEach((field) => {
    const raw = item[field];
    normalized[field] = raw === null || raw === "" || raw === undefined
      ? null
      : toFiniteNumber(raw, 0);
  });
  normalized.marketPrices = Array.isArray(item.marketPrices)
    ? item.marketPrices.slice(0, 5).map((value) => toNonNegative(value)).filter((value) => value > 0)
    : [];
  normalized.turnoverScore = item.turnoverScore === null || item.turnoverScore === undefined
    ? null
    : toFiniteNumber(item.turnoverScore, 0);
  normalized.turnoverLabel = safeString(item.turnoverLabel, 100);
  normalized.marketplace = normalizeMarketplace(item.marketplace);
  // 旧データの送料0円は「確認済み」か既定値か判別できないため、
  // 明示的にtrueで保存された商品だけを確認済みとして扱う。
  normalized.shippingConfirmed = item.shippingConfirmed === true;
  return normalized;
}

export function normalizeDraft(draft = {}) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return null;
  const normalized = {};
  DRAFT_STRING_FIELDS.forEach((field) => {
    const maxLength = field === "note" ? 5000 : 1000;
    normalized[field] = safeString(draft[field], maxLength);
  });
  normalized.marketPrices = Array.isArray(draft.marketPrices)
    ? draft.marketPrices.slice(0, 5).map((value) => safeString(value, 20))
    : [];
  normalized.salePriceIsAutomatic = Boolean(draft.salePriceIsAutomatic);
  normalized.marketSearchPending = Boolean(draft.marketSearchPending);
  normalized.marketplace = normalizeMarketplace(draft.marketplace);
  normalized.shippingConfirmed = Boolean(draft.shippingConfirmed);
  normalized.marketPricesNeedConfirmation = Boolean(draft.marketPricesNeedConfirmation);
  return normalized;
}

export class StorageRepository {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  read(key, fallback) {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  write(key, value) {
    try {
      this.storage?.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  loadItems() {
    const current = this.read(STORAGE_KEYS.items, null);
    if (Array.isArray(current)) return current.map(normalizeStoredItem);

    const legacy = this.read(STORAGE_KEYS.legacyItems, []);
    const migrated = Array.isArray(legacy) ? legacy.map(normalizeStoredItem) : [];
    if (migrated.length > 0) this.saveItems(migrated);
    return migrated;
  }

  saveItems(items) {
    return this.write(STORAGE_KEYS.items, items.map(normalizeStoredItem));
  }

  loadSettings() {
    const current = this.read(STORAGE_KEYS.settings, null);
    if (current && typeof current === "object") return normalizeSettings(current);
    const legacy = this.read(STORAGE_KEYS.legacySettings, DEFAULT_SETTINGS);
    const migrated = normalizeSettings(legacy);
    this.saveSettings(migrated);
    return migrated;
  }

  saveSettings(settings) {
    return this.write(STORAGE_KEYS.settings, normalizeSettings(settings));
  }

  loadDraft(maxAgeMs = 24 * 60 * 60 * 1000) {
    const normalized = normalizeDraft(this.read(STORAGE_KEYS.draft, null));
    if (!normalized) return null;
    const updatedAt = Date.parse(normalized.updatedAt);
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > maxAgeMs) {
      this.clearDraft();
      return null;
    }
    return normalized;
  }

  saveDraft(draft) {
    const normalized = normalizeDraft({ ...draft, updatedAt: new Date().toISOString() });
    return normalized ? this.write(STORAGE_KEYS.draft, normalized) : false;
  }

  clearDraft() {
    try {
      this.storage?.removeItem(STORAGE_KEYS.draft);
      return true;
    } catch {
      return false;
    }
  }

  hasSeenTutorial() {
    try {
      return this.storage?.getItem(STORAGE_KEYS.tutorialSeen) === "true";
    } catch {
      return false;
    }
  }

  setTutorialSeen(seen = true) {
    try {
      this.storage?.setItem(STORAGE_KEYS.tutorialSeen, String(Boolean(seen)));
      return true;
    } catch {
      return false;
    }
  }

  createBackup(items, settings) {
    return JSON.stringify({
      app: "barcode-profit-finder",
      version: 2,
      exportedAt: new Date().toISOString(),
      settings: normalizeSettings(settings),
      items: items.map(normalizeStoredItem),
    }, null, 2);
  }

  parseBackup(text) {
    if (typeof text !== "string" || text.length > 5_000_000) {
      throw new Error("バックアップファイルが大きすぎます。");
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("JSONファイルを読み取れませんでした。");
    }
    if (!parsed || parsed.app !== "barcode-profit-finder" || !Array.isArray(parsed.items)) {
      throw new Error("このアプリのバックアップ形式ではありません。");
    }
    if (parsed.items.length > 5000) {
      throw new Error("復元できる商品は5,000件までです。");
    }
    return {
      settings: normalizeSettings(parsed.settings ?? DEFAULT_SETTINGS),
      items: parsed.items.map(normalizeStoredItem),
    };
  }
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function itemsToCsv(items) {
  const headers = [
    "商品名", "JANコード", "販売先", "仕入価格", "想定売価", "販売手数料率", "販売手数料",
    "送料", "梱包費", "その他経費", "手取り額", "利益", "利益率", "ROI", "判定",
    "店舗名", "メモ", "販売済み件数", "現在出品数", "回転スコア", "回転判定",
    "直近売却日", "相場確認日", "商品検索URL", "登録日時", "更新日時",
  ];
  const rows = items.map((item) => [
    item.productName,
    item.barcode,
    item.marketplace,
    item.purchasePrice,
    item.salePrice,
    item.feeRate,
    item.fee,
    item.shipping,
    item.packaging,
    item.otherCosts,
    item.net,
    item.profit,
    item.margin === null ? "" : Number(item.margin).toFixed(1),
    item.roi === null ? "" : Number(item.roi).toFixed(1),
    item.verdictLabel,
    item.storeName,
    item.note,
    item.soldCount,
    item.activeCount,
    item.turnoverScore === null ? "" : Number(item.turnoverScore).toFixed(2),
    item.turnoverLabel,
    item.recentSaleDate,
    item.checkedDate,
    item.productSearchUrl,
    item.savedAt,
    item.updatedAt,
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}
