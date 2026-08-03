import {
  DEFAULT_SETTINGS,
  VERDICTS,
  buildSearchUrls,
  calculateMarketStats,
  calculateProfit,
  calculateTurnover,
  judgePurchase,
  normalizeSettings,
  toNonNegative,
} from "./calculator.js?v=7";
import { BarcodeScanner, PriceTagScanner, normalizeBarcode } from "./scanner.js?v=7";
import { StorageRepository, itemsToCsv } from "./storage.js?v=7";

const byId = (id) => document.getElementById(id);
const elements = {
  updateBanner: byId("updateBanner"),
  applyUpdateButton: byId("applyUpdateButton"),
  settingsOpenButton: byId("settingsOpenButton"),
  settingsCloseButton: byId("settingsCloseButton"),
  settingsPanel: byId("settingsPanel"),
  settingsForm: byId("settingsForm"),
  settingsResetButton: byId("settingsResetButton"),
  replayTutorialButton: byId("replayTutorialButton"),
  strongProfitInput: byId("strongProfitInput"),
  strongRoiInput: byId("strongRoiInput"),
  candidateProfitInput: byId("candidateProfitInput"),
  candidateRoiInput: byId("candidateRoiInput"),
  reviewProfitInput: byId("reviewProfitInput"),
  highProfitVibrationInput: byId("highProfitVibrationInput"),
  resultHero: byId("resultHero"),
  heroVerdict: byId("heroVerdict"),
  heroProfit: byId("heroProfit"),
  heroRoi: byId("heroRoi"),
  cameraFrame: byId("cameraFrame"),
  cameraVideo: byId("cameraVideo"),
  cameraStatus: byId("cameraStatus"),
  cameraError: byId("cameraError"),
  copyAppUrlButton: byId("copyAppUrlButton"),
  scanSuccess: byId("scanSuccess"),
  startScanButton: byId("startScanButton"),
  stopScanButton: byId("stopScanButton"),
  rescanButton: byId("rescanButton"),
  barcodeInput: byId("barcodeInput"),
  openPriceScannerButton: byId("openPriceScannerButton"),
  priceScannerPanel: byId("priceScannerPanel"),
  priceCameraVideo: byId("priceCameraVideo"),
  priceCaptureCanvas: byId("priceCaptureCanvas"),
  priceCameraStatus: byId("priceCameraStatus"),
  priceCameraError: byId("priceCameraError"),
  ocrProgress: byId("ocrProgress"),
  startPriceCameraButton: byId("startPriceCameraButton"),
  capturePriceButton: byId("capturePriceButton"),
  closePriceScannerButton: byId("closePriceScannerButton"),
  priceCandidates: byId("priceCandidates"),
  purchasePriceInput: byId("purchasePriceInput"),
  openPurchasePriceButton: byId("openPurchasePriceButton"),
  purchasePriceDisplay: byId("purchasePriceDisplay"),
  purchasePriceDialog: byId("purchasePriceDialog"),
  purchasePriceDialogForm: byId("purchasePriceDialogForm"),
  purchasePriceEditor: byId("purchasePriceEditor"),
  cancelPurchasePriceButton: byId("cancelPurchasePriceButton"),
  storeNameInput: byId("storeNameInput"),
  productNameInput: byId("productNameInput"),
  searchHint: byId("searchHint"),
  marketScreenshotButton: byId("marketScreenshotButton"),
  marketScreenshotInput: byId("marketScreenshotInput"),
  marketOcrCanvas: byId("marketOcrCanvas"),
  marketOcrProgress: byId("marketOcrProgress"),
  marketOcrStatus: byId("marketOcrStatus"),
  openMarketPriceButton: byId("openMarketPriceButton"),
  marketPriceButtonCount: byId("marketPriceButtonCount"),
  marketPriceList: byId("marketPriceList"),
  marketPriceDialog: byId("marketPriceDialog"),
  marketPriceDialogForm: byId("marketPriceDialogForm"),
  marketPriceDialogHeading: byId("marketPriceDialogHeading"),
  marketPriceDialogStatus: byId("marketPriceDialogStatus"),
  marketPriceEditor: byId("marketPriceEditor"),
  finishMarketPriceButton: byId("finishMarketPriceButton"),
  applyMarketPriceButton: byId("applyMarketPriceButton"),
  marketPriceInputs: [...document.querySelectorAll(".market-price-input")],
  medianResult: byId("medianResult"),
  averageResult: byId("averageResult"),
  minimumResult: byId("minimumResult"),
  maximumResult: byId("maximumResult"),
  marketCountResult: byId("marketCountResult"),
  salePriceInput: byId("salePriceInput"),
  soldCountInput: byId("soldCountInput"),
  activeCountInput: byId("activeCountInput"),
  recentSaleDateInput: byId("recentSaleDateInput"),
  checkedDateInput: byId("checkedDateInput"),
  turnoverResult: byId("turnoverResult"),
  profitForm: byId("profitForm"),
  feeRateInput: byId("feeRateInput"),
  shippingInput: byId("shippingInput"),
  packagingInput: byId("packagingInput"),
  otherCostsInput: byId("otherCostsInput"),
  noteInput: byId("noteInput"),
  feeResult: byId("feeResult"),
  netResult: byId("netResult"),
  profitResult: byId("profitResult"),
  marginResult: byId("marginResult"),
  roiResult: byId("roiResult"),
  breakEvenResult: byId("breakEvenResult"),
  saveItemButton: byId("saveItemButton"),
  cancelEditButton: byId("cancelEditButton"),
  savedSearchInput: byId("savedSearchInput"),
  savedCountBadge: byId("savedCountBadge"),
  savedSummary: byId("savedSummary"),
  savedItemsList: byId("savedItemsList"),
  exportCsvButton: byId("exportCsvButton"),
  backupJsonButton: byId("backupJsonButton"),
  restoreJsonButton: byId("restoreJsonButton"),
  restoreJsonInput: byId("restoreJsonInput"),
  tutorialOverlay: byId("tutorialOverlay"),
  tutorialStepText: byId("tutorialStepText"),
  tutorialNextButton: byId("tutorialNextButton"),
  tutorialSkipButton: byId("tutorialSkipButton"),
  tutorialSlides: [...document.querySelectorAll("[data-tutorial-slide]")],
  toast: byId("toast"),
};

const currencyFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

const repository = new StorageRepository();
let items = repository.loadItems();
let settings = repository.loadSettings();
let currentCalculation = calculateProfit({});
let currentVerdict = "skip";
let currentTurnover = calculateTurnover();
let currentSearchUrls = buildSearchUrls("");
let editingId = null;
let salePriceIsAutomatic = true;
let highProfitNotified = false;
let editingMarketPriceIndex = null;
let lastRestoredBarcode = "";
let tutorialStep = 0;
let toastTimer = 0;
let waitingWorker = null;

function setMessage(element, message) {
  element.textContent = message;
  element.hidden = !message;
}

function showToast(message, duration = 2400) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = window.setTimeout(() => { elements.toast.hidden = true; }, duration);
}

async function copyPublicUrl() {
  const publicUrl = "https://yamabookhub.github.io/barcode-profit-finder/";
  try {
    await navigator.clipboard.writeText(publicUrl);
    showToast("公開URLをコピーしました。Safariのアドレス欄に貼り付けてください。", 3600);
  } catch {
    window.prompt("このURLをコピーしてSafariで開いてください。", publicUrl);
  }
}

function formatCurrency(value) {
  return Number.isFinite(value) ? currencyFormatter.format(value) : "―";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "―";
}

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function valuesForCalculation() {
  return {
    purchasePrice: elements.purchasePriceInput.value,
    salePrice: elements.salePriceInput.value,
    feeRate: elements.feeRateInput.value,
    shipping: elements.shippingInput.value,
    packaging: elements.packagingInput.value,
    otherCosts: elements.otherCostsInput.value,
  };
}

function hasDecisionInputs() {
  return elements.purchasePriceInput.value !== "" && elements.salePriceInput.value !== "";
}

function renderCalculation() {
  currentCalculation = calculateProfit(valuesForCalculation());
  currentVerdict = judgePurchase(currentCalculation, settings);
  const verdict = VERDICTS[currentVerdict];

  elements.feeResult.textContent = formatCurrency(currentCalculation.fee);
  elements.netResult.textContent = formatCurrency(currentCalculation.net);
  elements.profitResult.textContent = formatCurrency(currentCalculation.profit);
  elements.marginResult.textContent = formatPercent(currentCalculation.margin);
  elements.roiResult.textContent = formatPercent(currentCalculation.roi);
  elements.breakEvenResult.textContent = formatCurrency(currentCalculation.breakEvenPrice);

  elements.resultHero.className = "result-hero";
  if (hasDecisionInputs()) {
    elements.resultHero.classList.add(`is-${verdict.tone}`);
    elements.heroVerdict.textContent = verdict.display;
    elements.heroProfit.textContent = formatCurrency(currentCalculation.profit);
    elements.heroRoi.textContent = formatPercent(currentCalculation.roi);
  } else {
    elements.resultHero.classList.add("is-empty");
    elements.heroVerdict.textContent = "価格を入力してください";
    elements.heroProfit.textContent = "―";
    elements.heroRoi.textContent = "―";
  }

  const shouldNotify = hasDecisionInputs()
    && currentCalculation.profit >= settings.highProfitVibration;
  if (shouldNotify && !highProfitNotified && navigator.vibrate) navigator.vibrate([80, 60, 80]);
  highProfitNotified = shouldNotify;
}

function renderMarketStats({ updateSalePrice = true } = {}) {
  const stats = calculateMarketStats(elements.marketPriceInputs.map((input) => input.value));
  elements.medianResult.textContent = formatCurrency(stats.median);
  elements.averageResult.textContent = formatCurrency(stats.average);
  elements.minimumResult.textContent = formatCurrency(stats.min);
  elements.maximumResult.textContent = formatCurrency(stats.max);
  elements.marketCountResult.textContent = `${stats.count}件`;
  renderMarketPriceList();
  if (updateSalePrice && salePriceIsAutomatic) {
    elements.salePriceInput.value = stats.median === null ? "" : String(Math.round(stats.median));
  }
  renderCalculation();
  return stats;
}

function syncPurchasePriceDisplay() {
  const hasPrice = elements.purchasePriceInput.value !== "";
  elements.purchasePriceDisplay.textContent = hasPrice
    ? formatCurrency(toNonNegative(elements.purchasePriceInput.value))
    : "未入力";
  elements.openPurchasePriceButton.classList.toggle("has-value", hasPrice);
}

function openPurchasePriceEditor() {
  elements.purchasePriceEditor.value = elements.purchasePriceInput.value;
  if (typeof elements.purchasePriceDialog.showModal === "function") {
    elements.purchasePriceDialog.showModal();
  } else {
    elements.purchasePriceDialog.setAttribute("open", "");
  }
  window.setTimeout(() => {
    elements.purchasePriceEditor.focus();
    elements.purchasePriceEditor.select();
  }, 50);
}

function closePurchasePriceEditor() {
  if (typeof elements.purchasePriceDialog.close === "function") elements.purchasePriceDialog.close();
  else elements.purchasePriceDialog.removeAttribute("open");
}

function applyPurchasePrice() {
  if (!elements.purchasePriceEditor.reportValidity()) return false;
  elements.purchasePriceInput.value = String(Math.round(toNonNegative(elements.purchasePriceEditor.value)));
  syncPurchasePriceDisplay();
  renderCalculation();
  closePurchasePriceEditor();
  if (navigator.vibrate) navigator.vibrate(25);
  return true;
}

function marketPriceValues() {
  return elements.marketPriceInputs
    .map((input) => input.value)
    .filter((value) => value !== "");
}

function renderMarketPriceList() {
  const values = marketPriceValues();
  elements.marketPriceButtonCount.textContent = `${values.length}/5件`;
  elements.openMarketPriceButton.disabled = values.length >= elements.marketPriceInputs.length;
  elements.marketPriceList.replaceChildren();
  if (values.length === 0) {
    const empty = document.createElement("p");
    empty.className = "market-price-empty";
    empty.textContent = "まだ価格がありません。検索結果を見て、売れた価格を追加します。";
    elements.marketPriceList.append(empty);
    return;
  }
  values.forEach((value, index) => {
    const item = document.createElement("div");
    item.className = "market-price-chip";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.dataset.action = "edit-market-price";
    editButton.dataset.index = String(index);
    editButton.textContent = formatCurrency(toNonNegative(value));
    editButton.setAttribute("aria-label", `${formatCurrency(toNonNegative(value))}を修正`);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "market-price-remove";
    removeButton.dataset.action = "remove-market-price";
    removeButton.dataset.index = String(index);
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `${formatCurrency(toNonNegative(value))}を削除`);
    item.append(editButton, removeButton);
    elements.marketPriceList.append(item);
  });
}

function closeMarketPriceEditor() {
  editingMarketPriceIndex = null;
  if (typeof elements.marketPriceDialog.close === "function") elements.marketPriceDialog.close();
  else elements.marketPriceDialog.removeAttribute("open");
}

function openMarketPriceEditor(index = null) {
  const values = marketPriceValues();
  if (index === null && values.length >= elements.marketPriceInputs.length) {
    showToast("相場は最大5件です。価格をタップすると修正できます");
    return;
  }
  editingMarketPriceIndex = index;
  const editing = index !== null;
  elements.marketPriceDialogHeading.textContent = editing ? "売れた価格を修正" : "売れた価格を追加";
  elements.marketPriceDialogStatus.textContent = editing
    ? `${index + 1}件目を修正します`
    : `追加済み ${values.length}/5件。続けて入力できます。`;
  elements.applyMarketPriceButton.textContent = editing ? "変更する" : "追加して次へ";
  elements.marketPriceEditor.value = editing ? values[index] : "";
  if (typeof elements.marketPriceDialog.showModal === "function") elements.marketPriceDialog.showModal();
  else elements.marketPriceDialog.setAttribute("open", "");
  window.setTimeout(() => {
    elements.marketPriceEditor.focus();
    elements.marketPriceEditor.select();
  }, 50);
}

function applyMarketPrice() {
  if (!elements.marketPriceEditor.reportValidity()) return false;
  const value = String(Math.round(toNonNegative(elements.marketPriceEditor.value)));
  const values = marketPriceValues();
  if (editingMarketPriceIndex === null) values.push(value);
  else values[editingMarketPriceIndex] = value;
  elements.marketPriceInputs.forEach((input, index) => { input.value = values[index] ?? ""; });
  salePriceIsAutomatic = true;
  const wasEditing = editingMarketPriceIndex !== null;
  renderMarketStats();
  if (navigator.vibrate) navigator.vibrate(25);
  if (wasEditing || values.length >= elements.marketPriceInputs.length) {
    closeMarketPriceEditor();
    showToast(wasEditing ? "相場価格を変更しました" : "5件の相場を追加しました");
  } else {
    elements.marketPriceEditor.value = "";
    elements.marketPriceDialogStatus.textContent = `追加済み ${values.length}/5件。続けて入力できます。`;
    elements.marketPriceEditor.focus();
  }
  return true;
}

function removeMarketPrice(index) {
  const values = marketPriceValues();
  values.splice(index, 1);
  elements.marketPriceInputs.forEach((input, inputIndex) => { input.value = values[inputIndex] ?? ""; });
  salePriceIsAutomatic = true;
  renderMarketStats();
  showToast("相場価格を削除しました");
}

function renderTurnover() {
  currentTurnover = calculateTurnover({
    soldCount: elements.soldCountInput.value,
    activeCount: elements.activeCountInput.value,
    recentSaleDate: elements.recentSaleDateInput.value,
    checkedDate: elements.checkedDateInput.value,
  });
  elements.turnoverResult.className = `turnover-result is-${currentTurnover.key}`;
  elements.turnoverResult.querySelector("strong").textContent = currentTurnover.label;
  const details = [];
  if (currentTurnover.score !== null) details.push(`スコア ${currentTurnover.score.toFixed(2)}`);
  if (currentTurnover.daysSinceSale !== null) details.push(`直近売却から${currentTurnover.daysSinceSale}日`);
  if (!details.length) details.push("販売済み件数と現在出品数を入力してください");
  elements.turnoverResult.querySelector("span").textContent = details.join("・");
}

function updateSearchLinks() {
  currentSearchUrls = buildSearchUrls(normalizeBarcode(elements.barcodeInput.value), elements.productNameInput.value);
  document.querySelectorAll("[data-search]").forEach((link) => {
    const enabled = Boolean(currentSearchUrls.term);
    link.setAttribute("aria-disabled", String(!enabled));
    link.href = enabled ? currentSearchUrls[link.dataset.search] : "#";
  });
  elements.searchHint.textContent = currentSearchUrls.term
    ? `「${currentSearchUrls.term}」で検索します。`
    : "先にJANコードまたは商品名を入力してください。";
}

function restoreSavedMarket(code) {
  const normalized = normalizeBarcode(code);
  if (!normalized || normalized === lastRestoredBarcode || editingId) return false;
  const previous = items.find((item) => (
    normalizeBarcode(item.barcode) === normalized
    && ((item.marketPrices?.length ?? 0) > 0 || toNonNegative(item.salePrice) > 0)
  ));
  if (!previous) return false;
  lastRestoredBarcode = normalized;
  if (!elements.productNameInput.value && previous.productName) elements.productNameInput.value = previous.productName;
  elements.feeRateInput.value = previous.feeRate ?? elements.feeRateInput.value;
  elements.shippingInput.value = previous.shipping ?? elements.shippingInput.value;
  elements.packagingInput.value = previous.packaging ?? elements.packagingInput.value;
  elements.otherCostsInput.value = previous.otherCosts ?? elements.otherCostsInput.value;
  const previousPrices = previous.marketPrices ?? [];
  elements.marketPriceInputs.forEach((input, index) => { input.value = previousPrices[index] ?? ""; });
  if (previousPrices.length > 0) {
    salePriceIsAutomatic = true;
    renderMarketStats();
  } else {
    salePriceIsAutomatic = false;
    elements.salePriceInput.value = String(previous.salePrice);
    renderMarketStats({ updateSalePrice: false });
  }
  updateSearchLinks();
  const savedAt = new Date(previous.updatedAt || previous.savedAt);
  const savedLabel = Number.isNaN(savedAt.getTime()) ? "保存済み" : dateTimeFormatter.format(savedAt);
  setMessage(elements.marketOcrStatus, `${savedLabel}の相場を復元しました。現在の相場と大きく違わないか確認してください。`);
  showToast("このJANの過去相場を自動で復元しました", 3600);
  return true;
}

function setScannerState(scanning) {
  elements.cameraFrame.classList.toggle("is-scanning", scanning);
  elements.startScanButton.disabled = scanning;
  elements.stopScanButton.disabled = !scanning;
}

const barcodeScanner = new BarcodeScanner({
  video: elements.cameraVideo,
  onStatus: (message) => setMessage(elements.cameraStatus, message),
  onError: (message) => setMessage(elements.cameraError, message),
  onStateChange: setScannerState,
  onSuccess: (code) => {
    elements.barcodeInput.value = code;
    updateSearchLinks();
    restoreSavedMarket(code);
    elements.scanSuccess.hidden = false;
    window.setTimeout(() => { elements.scanSuccess.hidden = true; }, 900);
    showToast(`バーコード ${code} を読み取りました`);
    document.getElementById("purchase-section").scrollIntoView({ behavior: "smooth", block: "start" });
  },
});

function setPriceScannerState(scanning) {
  elements.startPriceCameraButton.disabled = scanning;
  elements.capturePriceButton.disabled = !scanning;
  elements.priceCameraVideo.closest(".camera-frame").classList.toggle("is-scanning", scanning);
}

const priceScanner = new PriceTagScanner({
  video: elements.priceCameraVideo,
  canvas: elements.priceCaptureCanvas,
  onStatus: (message) => setMessage(elements.priceCameraStatus, message),
  onError: (message) => setMessage(elements.priceCameraError, message),
  onStateChange: setPriceScannerState,
  onProgress: (progress, label) => {
    elements.ocrProgress.hidden = false;
    elements.ocrProgress.value = progress;
    setMessage(elements.priceCameraStatus, `${label} ${Math.round(progress * 100)}%`);
  },
});

const marketImageReader = new PriceTagScanner({
  canvas: elements.marketOcrCanvas,
  onStatus: (message) => setMessage(elements.marketOcrStatus, message),
  onError: (message) => setMessage(elements.marketOcrStatus, message),
  onProgress: (progress, label) => {
    elements.marketOcrProgress.hidden = false;
    elements.marketOcrProgress.value = progress;
    setMessage(elements.marketOcrStatus, `${label} ${Math.round(progress * 100)}%`);
  },
});

async function readMarketScreenshot(file) {
  barcodeScanner.stop("相場画像の解析中です");
  priceScanner.stop();
  elements.marketScreenshotButton.disabled = true;
  elements.marketOcrProgress.hidden = false;
  setMessage(elements.marketOcrStatus, "スクリーンショットを端末内で解析しています…");
  const result = await marketImageReader.recognizeImage(file);
  elements.marketScreenshotButton.disabled = false;
  elements.marketOcrProgress.hidden = true;
  if (result.candidates.length === 0) {
    setMessage(elements.marketOcrStatus, "価格を見つけられませんでした。価格が大きく表示されたスクリーンショットを選んでください。");
    return;
  }
  elements.marketPriceInputs.forEach((input, index) => {
    input.value = result.candidates[index] ?? "";
  });
  salePriceIsAutomatic = true;
  const stats = renderMarketStats();
  setMessage(elements.marketOcrStatus, `${stats.count}件を読み取りました。金額を確認し、違う候補は×で削除してください。`);
  showToast(`相場${stats.count}件と中央値を自動入力しました`, 3600);
}

function openPriceScanner() {
  barcodeScanner.stop("値札読取のためバーコードカメラを停止しました");
  elements.priceScannerPanel.hidden = false;
  elements.priceScannerPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closePriceScanner() {
  priceScanner.stop();
  priceScanner.clearFrame();
  elements.ocrProgress.hidden = true;
  elements.priceScannerPanel.hidden = true;
}

function renderPriceCandidates(candidates) {
  elements.priceCandidates.replaceChildren();
  if (!candidates.length) {
    const message = document.createElement("p");
    message.className = "error-message";
    message.textContent = "金額候補を見つけられませんでした。値札を大きく写して再試行するか、仕入価格を手入力してください。";
    elements.priceCandidates.append(message);
    return;
  }
  candidates.forEach((price) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = formatCurrency(price);
    button.addEventListener("click", () => {
      elements.purchasePriceInput.value = String(price);
      syncPurchasePriceDisplay();
      renderCalculation();
      showToast(`${formatCurrency(price)}を仕入価格に設定しました`);
      closePriceScanner();
    });
    elements.priceCandidates.append(button);
  });
}

function settingsToForm(source = settings) {
  elements.strongProfitInput.value = source.strongProfit;
  elements.strongRoiInput.value = source.strongRoi;
  elements.candidateProfitInput.value = source.candidateProfit;
  elements.candidateRoiInput.value = source.candidateRoi;
  elements.reviewProfitInput.value = source.reviewProfit;
  elements.highProfitVibrationInput.value = source.highProfitVibration;
}

function settingsFromForm() {
  return normalizeSettings({
    strongProfit: elements.strongProfitInput.value,
    strongRoi: elements.strongRoiInput.value,
    candidateProfit: elements.candidateProfitInput.value,
    candidateRoi: elements.candidateRoiInput.value,
    reviewProfit: elements.reviewProfitInput.value,
    highProfitVibration: elements.highProfitVibrationInput.value,
  });
}

function toggleSettings(open) {
  elements.settingsPanel.hidden = !open;
  elements.settingsOpenButton.setAttribute("aria-expanded", String(open));
  if (open) elements.settingsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function currentItem(existing) {
  const now = new Date().toISOString();
  const marketStats = calculateMarketStats(elements.marketPriceInputs.map((input) => input.value));
  return {
    id: existing?.id ?? makeId(),
    productName: elements.productNameInput.value.trim(),
    barcode: normalizeBarcode(elements.barcodeInput.value),
    purchasePrice: currentCalculation.purchasePrice,
    salePrice: currentCalculation.salePrice,
    feeRate: currentCalculation.feeRate,
    shipping: currentCalculation.shipping,
    packaging: currentCalculation.packaging,
    otherCosts: currentCalculation.otherCosts,
    fee: currentCalculation.fee,
    net: currentCalculation.net,
    profit: currentCalculation.profit,
    margin: currentCalculation.margin,
    roi: currentCalculation.roi,
    breakEvenPrice: currentCalculation.breakEvenPrice,
    verdict: currentVerdict,
    verdictLabel: VERDICTS[currentVerdict].label,
    storeName: elements.storeNameInput.value.trim(),
    note: elements.noteInput.value.trim(),
    savedAt: existing?.savedAt || now,
    updatedAt: now,
    productSearchUrl: currentSearchUrls.term ? currentSearchUrls.google : "",
    marketPrices: marketStats.prices,
    soldCount: elements.soldCountInput.value === "" ? null : toNonNegative(elements.soldCountInput.value),
    activeCount: elements.activeCountInput.value === "" ? null : toNonNegative(elements.activeCountInput.value),
    turnoverScore: currentTurnover.score,
    turnoverLabel: currentTurnover.label,
    recentSaleDate: elements.recentSaleDateInput.value,
    checkedDate: elements.checkedDateInput.value,
  };
}

function clearProductForm() {
  editingId = null;
  elements.barcodeInput.value = "";
  elements.productNameInput.value = "";
  elements.purchasePriceInput.value = "";
  syncPurchasePriceDisplay();
  elements.salePriceInput.value = "";
  lastRestoredBarcode = "";
  elements.marketPriceInputs.forEach((input) => { input.value = ""; });
  elements.soldCountInput.value = "";
  elements.activeCountInput.value = "";
  elements.recentSaleDateInput.value = "";
  elements.checkedDateInput.value = localDateValue();
  elements.noteInput.value = "";
  elements.saveItemButton.textContent = "この商品を保存";
  elements.cancelEditButton.hidden = true;
  salePriceIsAutomatic = true;
  highProfitNotified = false;
  updateSearchLinks();
  renderMarketStats();
  renderTurnover();
}

function saveCurrentItem() {
  renderCalculation();
  renderTurnover();
  if (elements.purchasePriceInput.value === "") {
    showToast("仕入価格を入力してください");
    openPurchasePriceEditor();
    return;
  }
  if (!elements.salePriceInput.reportValidity() || toNonNegative(elements.salePriceInput.value) <= 0) {
    showToast("想定売却価格を入力してください");
    elements.salePriceInput.focus();
    return;
  }

  const index = items.findIndex((item) => item.id === editingId);
  const record = currentItem(index >= 0 ? items[index] : null);
  if (index >= 0) items[index] = record;
  else items.unshift(record);
  if (!repository.saveItems(items)) {
    showToast("保存容量が不足しています。バックアップ後に不要な商品を削除してください。", 4200);
    return;
  }
  renderSavedItems();
  showToast(index >= 0 ? "商品を更新しました" : "商品を保存しました");
  clearProductForm();
  document.getElementById("scan-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function fillItemForm(item) {
  barcodeScanner.stop();
  priceScanner.stop();
  editingId = item.id;
  elements.barcodeInput.value = item.barcode;
  elements.productNameInput.value = item.productName;
  elements.purchasePriceInput.value = item.purchasePrice ?? "";
  syncPurchasePriceDisplay();
  elements.salePriceInput.value = item.salePrice ?? "";
  elements.feeRateInput.value = item.feeRate ?? 10;
  elements.shippingInput.value = item.shipping ?? 0;
  elements.packagingInput.value = item.packaging ?? 0;
  elements.otherCostsInput.value = item.otherCosts ?? 0;
  elements.storeNameInput.value = item.storeName;
  elements.noteInput.value = item.note;
  elements.marketPriceInputs.forEach((input, index) => { input.value = item.marketPrices?.[index] ?? ""; });
  elements.soldCountInput.value = item.soldCount ?? "";
  elements.activeCountInput.value = item.activeCount ?? "";
  elements.recentSaleDateInput.value = item.recentSaleDate || "";
  elements.checkedDateInput.value = item.checkedDate || localDateValue();
  elements.saveItemButton.textContent = "変更を保存";
  elements.cancelEditButton.hidden = false;
  salePriceIsAutomatic = false;
  highProfitNotified = false;
  updateSearchLinks();
  renderMarketStats({ updateSalePrice: false });
  renderTurnover();
}

function createMetric(label, value) {
  const wrapper = document.createElement("div");
  const labelElement = document.createElement("span");
  const valueElement = document.createElement("strong");
  labelElement.textContent = label;
  valueElement.textContent = value;
  wrapper.append(labelElement, valueElement);
  return wrapper;
}

function renderSavedItems() {
  const query = elements.savedSearchInput.value.trim().toLocaleLowerCase("ja");
  const visibleItems = items.filter((item) => [item.productName, item.barcode, item.storeName, item.note]
    .join(" ").toLocaleLowerCase("ja").includes(query));
  elements.savedItemsList.replaceChildren();
  elements.savedCountBadge.textContent = `${items.length}件`;
  elements.savedSummary.textContent = items.length === 0
    ? "保存した商品はありません。"
    : query ? `${items.length}件中 ${visibleItems.length}件を表示` : `${items.length}件を新しい順に表示しています。`;
  elements.exportCsvButton.disabled = items.length === 0;
  elements.backupJsonButton.disabled = items.length === 0;

  visibleItems.forEach((item) => {
    const card = document.createElement("article");
    card.className = "saved-item";
    const head = document.createElement("div");
    head.className = "saved-item-head";
    const titleGroup = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = item.productName || "商品名なし";
    const code = document.createElement("p");
    code.className = "saved-item-code";
    code.textContent = item.barcode ? `JAN：${item.barcode}` : "JAN：未入力";
    titleGroup.append(title, code);
    const badge = document.createElement("span");
    badge.className = `verdict-badge is-${VERDICTS[item.verdict]?.tone ?? "skip"}`;
    badge.textContent = VERDICTS[item.verdict]?.display ?? item.verdictLabel ?? "見送り";
    head.append(titleGroup, badge);

    const metrics = document.createElement("div");
    metrics.className = "saved-metrics";
    metrics.append(
      createMetric("仕入", formatCurrency(item.purchasePrice)),
      createMetric("売価", formatCurrency(item.salePrice)),
      createMetric("利益", formatCurrency(item.profit)),
      createMetric("ROI", formatPercent(item.roi)),
      createMetric("利益率", formatPercent(item.margin)),
      createMetric("回転", item.turnoverLabel || "未入力"),
    );

    const date = document.createElement("p");
    date.className = "saved-item-date";
    const parsedDate = new Date(item.savedAt);
    date.textContent = `${item.storeName ? `${item.storeName}・` : ""}${Number.isNaN(parsedDate.getTime()) ? "日時不明" : dateTimeFormatter.format(parsedDate)}`;

    const actions = document.createElement("div");
    actions.className = "saved-actions";
    [
      ["編集", "edit"],
      ["再計算", "recalculate"],
      ["削除", "delete"],
    ].forEach(([label, action]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action === "delete" ? "danger-button" : "secondary-button";
      button.dataset.action = action;
      button.dataset.id = item.id;
      button.textContent = label;
      actions.append(button);
    });
    card.append(head, metrics, date, actions);
    elements.savedItemsList.append(card);
  });
}

function showTutorial(step = 0) {
  tutorialStep = Math.max(0, Math.min(elements.tutorialSlides.length - 1, step));
  elements.tutorialSlides.forEach((slide, index) => { slide.hidden = index !== tutorialStep; });
  elements.tutorialStepText.textContent = `${tutorialStep + 1} / ${elements.tutorialSlides.length}`;
  elements.tutorialNextButton.textContent = tutorialStep === elements.tutorialSlides.length - 1 ? "使い始める" : "次へ";
  elements.tutorialOverlay.hidden = false;
  document.body.classList.add("has-modal");
  elements.tutorialNextButton.focus();
}

function closeTutorial() {
  repository.setTutorialSeen(true);
  elements.tutorialOverlay.hidden = true;
  document.body.classList.remove("has-modal");
  elements.startScanButton.focus();
}

function registerEvents() {
  elements.copyAppUrlButton.addEventListener("click", copyPublicUrl);
  elements.startScanButton.addEventListener("click", async () => {
    closePriceScanner();
    await barcodeScanner.start();
  });
  elements.stopScanButton.addEventListener("click", () => barcodeScanner.stop());
  elements.rescanButton.addEventListener("click", async () => {
    elements.barcodeInput.value = "";
    lastRestoredBarcode = "";
    updateSearchLinks();
    barcodeScanner.allowImmediateRescan();
    await barcodeScanner.start();
  });
  elements.barcodeInput.addEventListener("input", () => {
    elements.barcodeInput.value = normalizeBarcode(elements.barcodeInput.value);
    updateSearchLinks();
    restoreSavedMarket(elements.barcodeInput.value);
  });
  elements.productNameInput.addEventListener("input", updateSearchLinks);
  document.querySelectorAll("[data-search]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (link.getAttribute("aria-disabled") === "true") event.preventDefault();
    });
  });

  elements.openPriceScannerButton.addEventListener("click", openPriceScanner);
  elements.startPriceCameraButton.addEventListener("click", async () => {
    barcodeScanner.stop("値札読取のためバーコードカメラを停止しました");
    await priceScanner.start();
  });
  elements.capturePriceButton.addEventListener("click", async () => {
    elements.capturePriceButton.disabled = true;
    elements.priceCandidates.replaceChildren();
    const result = await priceScanner.recognize();
    renderPriceCandidates(result.candidates);
    elements.ocrProgress.hidden = true;
    elements.startPriceCameraButton.disabled = false;
  });
  elements.closePriceScannerButton.addEventListener("click", closePriceScanner);

  elements.openPurchasePriceButton.addEventListener("click", openPurchasePriceEditor);
  elements.cancelPurchasePriceButton.addEventListener("click", closePurchasePriceEditor);
  elements.purchasePriceDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyPurchasePrice();
  });
  elements.marketScreenshotButton.addEventListener("click", () => elements.marketScreenshotInput.click());
  elements.marketScreenshotInput.addEventListener("change", async () => {
    const file = elements.marketScreenshotInput.files?.[0];
    elements.marketScreenshotInput.value = "";
    if (file) await readMarketScreenshot(file);
  });
  elements.openMarketPriceButton.addEventListener("click", () => openMarketPriceEditor());
  elements.finishMarketPriceButton.addEventListener("click", closeMarketPriceEditor);
  elements.marketPriceDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyMarketPrice();
  });
  elements.marketPriceList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.action === "edit-market-price") openMarketPriceEditor(index);
    else if (button.dataset.action === "remove-market-price") removeMarketPrice(index);
  });
  elements.salePriceInput.addEventListener("input", () => {
    salePriceIsAutomatic = false;
    renderCalculation();
  });
  [elements.feeRateInput, elements.shippingInput,
    elements.packagingInput, elements.otherCostsInput].forEach((input) => input.addEventListener("input", renderCalculation));
  [elements.soldCountInput, elements.activeCountInput, elements.recentSaleDateInput,
    elements.checkedDateInput].forEach((input) => input.addEventListener("input", renderTurnover));

  elements.saveItemButton.addEventListener("click", saveCurrentItem);
  elements.cancelEditButton.addEventListener("click", () => {
    clearProductForm();
    showToast("編集をキャンセルしました");
  });
  elements.savedSearchInput.addEventListener("input", renderSavedItems);
  elements.savedItemsList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const item = items.find((candidate) => candidate.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === "delete") {
      if (!window.confirm(`「${item.productName || item.barcode || "この商品"}」を削除しますか？`)) return;
      items = items.filter((candidate) => candidate.id !== item.id);
      repository.saveItems(items);
      if (editingId === item.id) clearProductForm();
      renderSavedItems();
      showToast("商品を削除しました");
      return;
    }
    fillItemForm(item);
    document.getElementById("verdict-section").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(button.dataset.action === "recalculate" ? "最新条件で再計算できます" : "商品を編集中です");
  });

  elements.exportCsvButton.addEventListener("click", () => {
    downloadFile(`barcode-profit-finder-${localDateValue()}.csv`, "text/csv;charset=utf-8", `\uFEFF${itemsToCsv(items)}`);
    showToast("CSVを出力しました");
  });
  elements.backupJsonButton.addEventListener("click", () => {
    downloadFile(`barcode-profit-finder-backup-${localDateValue()}.json`, "application/json", repository.createBackup(items, settings));
    showToast("JSONバックアップを保存しました");
  });
  elements.restoreJsonButton.addEventListener("click", () => elements.restoreJsonInput.click());
  elements.restoreJsonInput.addEventListener("change", async () => {
    const file = elements.restoreJsonInput.files?.[0];
    elements.restoreJsonInput.value = "";
    if (!file) return;
    try {
      const restored = repository.parseBackup(await file.text());
      if (!window.confirm(`${restored.items.length}件の商品と判定設定を復元し、現在のデータを置き換えますか？`)) return;
      items = restored.items;
      settings = restored.settings;
      repository.saveItems(items);
      repository.saveSettings(settings);
      settingsToForm();
      renderCalculation();
      renderSavedItems();
      showToast("バックアップを復元しました");
    } catch (error) {
      showToast(error.message, 4200);
    }
  });

  elements.settingsOpenButton.addEventListener("click", () => toggleSettings(elements.settingsPanel.hidden));
  elements.settingsCloseButton.addEventListener("click", () => toggleSettings(false));
  elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    settings = settingsFromForm();
    repository.saveSettings(settings);
    renderCalculation();
    toggleSettings(false);
    showToast("判定基準を保存しました");
  });
  elements.settingsResetButton.addEventListener("click", () => settingsToForm(DEFAULT_SETTINGS));
  elements.replayTutorialButton.addEventListener("click", () => showTutorial(0));

  document.querySelectorAll(".term-help").forEach((button) => {
    button.addEventListener("click", () => showToast(button.dataset.help, 4200));
  });
  elements.tutorialSkipButton.addEventListener("click", closeTutorial);
  elements.tutorialNextButton.addEventListener("click", () => {
    if (tutorialStep >= elements.tutorialSlides.length - 1) closeTutorial();
    else showTutorial(tutorialStep + 1);
  });

  window.addEventListener("pagehide", () => {
    barcodeScanner.stop();
    priceScanner.terminate();
    marketImageReader.terminate();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      barcodeScanner.stop();
      priceScanner.stop();
    }
  });
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js");
    const offerUpdate = (worker) => {
      waitingWorker = worker;
      elements.updateBanner.hidden = false;
    };
    if (registration.waiting) offerUpdate(registration.waiting);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) offerUpdate(worker);
      });
    });
    elements.applyUpdateButton.addEventListener("click", () => waitingWorker?.postMessage({ type: "SKIP_WAITING" }));
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  } catch {
    showToast("オフライン機能を開始できませんでした。オンラインではそのまま利用できます。", 4000);
  }
}

function initialize() {
  elements.checkedDateInput.value = localDateValue();
  settingsToForm();
  registerEvents();
  updateSearchLinks();
  renderMarketStats();
  renderTurnover();
  renderSavedItems();
  registerServiceWorker();
  if (!repository.hasSeenTutorial()) window.setTimeout(() => showTutorial(0), 250);
}

initialize();
