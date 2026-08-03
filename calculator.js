export const DEFAULT_SETTINGS = Object.freeze({
  strongProfit: 3000,
  strongRoi: 50,
  candidateProfit: 2000,
  candidateRoi: 40,
  reviewProfit: 1000,
  highProfitVibration: 5000,
});

export const VERDICTS = Object.freeze({
  strong: { label: "強く仕入れ候補", display: "🟢 買い（強）", tone: "strong" },
  candidate: { label: "仕入候補", display: "🟢 買い", tone: "candidate" },
  review: { label: "要確認", display: "🟡 要確認", tone: "review" },
  loss: { label: "赤字", display: "🔴 見送り（赤字）", tone: "loss" },
  skip: { label: "見送り", display: "🔴 見送り", tone: "skip" },
});

export function toFiniteNumber(value, fallback = 0) {
  const normalized = typeof value === "string" ? value.replaceAll(",", "").trim() : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

export function toNonNegative(value) {
  return Math.max(0, toFiniteNumber(value));
}

export function normalizeSettings(settings = {}) {
  return {
    strongProfit: toNonNegative(settings.strongProfit ?? DEFAULT_SETTINGS.strongProfit),
    strongRoi: toNonNegative(settings.strongRoi ?? DEFAULT_SETTINGS.strongRoi),
    candidateProfit: toNonNegative(settings.candidateProfit ?? DEFAULT_SETTINGS.candidateProfit),
    candidateRoi: toNonNegative(settings.candidateRoi ?? DEFAULT_SETTINGS.candidateRoi),
    reviewProfit: toNonNegative(settings.reviewProfit ?? DEFAULT_SETTINGS.reviewProfit),
    highProfitVibration: toNonNegative(settings.highProfitVibration ?? DEFAULT_SETTINGS.highProfitVibration),
  };
}

export function calculateProfit(values = {}) {
  const purchasePrice = toNonNegative(values.purchasePrice);
  const salePrice = toNonNegative(values.salePrice);
  const feeRate = Math.min(100, toNonNegative(values.feeRate));
  const shipping = toNonNegative(values.shipping);
  const packaging = toNonNegative(values.packaging);
  const otherCosts = toNonNegative(values.otherCosts);

  const fee = Math.floor((salePrice * feeRate) / 100);
  const net = salePrice - fee - shipping - packaging - otherCosts;
  const profit = net - purchasePrice;
  const margin = salePrice > 0 ? (profit / salePrice) * 100 : null;
  const roi = purchasePrice > 0 ? (profit / purchasePrice) * 100 : null;
  const fixedCosts = purchasePrice + shipping + packaging + otherCosts;

  let breakEvenPrice = null;
  if (feeRate < 100) {
    breakEvenPrice = Math.max(0, Math.ceil(fixedCosts / (1 - feeRate / 100)));
    const profitAt = (price) => price - Math.floor((price * feeRate) / 100) - fixedCosts;
    while (profitAt(breakEvenPrice) < 0) breakEvenPrice += 1;
    while (breakEvenPrice > 0 && profitAt(breakEvenPrice - 1) >= 0) breakEvenPrice -= 1;
  }

  return {
    purchasePrice,
    salePrice,
    feeRate,
    shipping,
    packaging,
    otherCosts,
    fee,
    net,
    profit,
    margin,
    roi,
    breakEvenPrice,
  };
}

export function judgePurchase(calculation, settings = DEFAULT_SETTINGS) {
  const rules = normalizeSettings(settings);
  if (calculation.profit < 0) return "loss";
  if (
    calculation.profit >= rules.strongProfit
    && calculation.roi !== null
    && calculation.roi >= rules.strongRoi
  ) return "strong";
  if (
    calculation.profit >= rules.candidateProfit
    && calculation.roi !== null
    && calculation.roi >= rules.candidateRoi
  ) return "candidate";
  if (calculation.profit >= rules.reviewProfit) return "review";
  return "skip";
}

export function calculateMarketStats(values = []) {
  const prices = values
    .map((value) => toFiniteNumber(value, Number.NaN))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return { count: 0, median: null, average: null, min: null, max: null, prices: [] };
  }

  const middle = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 0
    ? (prices[middle - 1] + prices[middle]) / 2
    : prices[middle];
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;

  return {
    count: prices.length,
    median,
    average,
    min: prices[0],
    max: prices[prices.length - 1],
    prices,
  };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateTurnover(values = {}) {
  const hasSold = values.soldCount !== "" && values.soldCount !== null && values.soldCount !== undefined;
  const hasActive = values.activeCount !== "" && values.activeCount !== null && values.activeCount !== undefined;
  const soldCount = toNonNegative(values.soldCount);
  const activeCount = toNonNegative(values.activeCount);
  const recentSaleDate = parseDate(values.recentSaleDate);
  const checkedDate = parseDate(values.checkedDate) ?? new Date();
  const daysSinceSale = recentSaleDate
    ? Math.max(0, Math.floor((checkedDate.getTime() - recentSaleDate.getTime()) / 86400000))
    : null;

  if (!hasSold || !hasActive || activeCount === 0) {
    return { key: "insufficient", label: "データ不足", score: null, daysSinceSale };
  }

  const score = soldCount / activeCount;
  if (score >= 1) return { key: "fast", label: "回転が速い", score, daysSinceSale };
  if (score >= 0.3) return { key: "normal", label: "普通", score, daysSinceSale };
  return { key: "slow", label: "回転が遅い", score, daysSinceSale };
}

function normalizeSearchTerm(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildSearchUrls(barcode, productName = "") {
  const term = normalizeSearchTerm(productName) || normalizeSearchTerm(barcode);
  const query = encodeURIComponent(term);
  return {
    term,
    google: `https://www.google.com/search?tbm=shop&q=${query}`,
    mercari: `https://jp.mercari.com/search?keyword=${query}`,
    mercariSold: `https://jp.mercari.com/search?keyword=${query}&status=sold_out`,
    yahooFlea: `https://paypayfleamarket.yahoo.co.jp/search/${query}`,
    yahooAuction: `https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=${query}`,
    surugaya: `https://www.suruga-ya.jp/search?search_word=${query}`,
    amazon: `https://www.amazon.co.jp/s?k=${query}`,
  };
}
