import {
  DEFAULT_SETTINGS,
  MARKETPLACES,
  VERDICTS,
  buildSearchUrls,
  calculateMarketStats,
  calculateProfit,
  calculateTurnover,
  judgePurchase,
  normalizeMarketplace,
  normalizeSettings,
  toNonNegative,
} from "./calculator.js?v=15";
import { BarcodeScanner, PriceTagScanner, normalizeBarcode } from "./scanner.js?v=15";
import { StorageRepository, itemsToCsv } from "./storage.js?v=15";
import { isBookIsbn, lookupBookByIsbn } from "./product-lookup.js?v=15";
import { parseSpokenNumber, speechErrorMessage, speechRecognitionConstructor } from "./voice-input.js?v=15";

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
  heroKicker: byId("heroKicker"),
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
  productLookupStatus: byId("productLookupStatus"),
  marketplaceInput: byId("marketplaceInput"),
  marketplaceOptions: byId("marketplaceOptions"),
  marketplaceStatus: byId("marketplaceStatus"),
  openFeeRateButton: byId("openFeeRateButton"),
  quickMarketSearch: byId("quickMarketSearch"),
  quickMarketSearchLabel: byId("quickMarketSearchLabel"),
  shippingOptions: byId("shippingOptions"),
  shippingStatus: byId("shippingStatus"),
  decisionEvidence: byId("decisionEvidence"),
  searchHint: byId("searchHint"),
  marketScreenshotButton: byId("marketScreenshotButton"),
  marketScreenshotInput: byId("marketScreenshotInput"),
  marketOcrCanvas: byId("marketOcrCanvas"),
  marketOcrProgress: byId("marketOcrProgress"),
  marketOcrStatus: byId("marketOcrStatus"),
  confirmMarketPricesButton: byId("confirmMarketPricesButton"),
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
  openSalePriceButton: byId("openSalePriceButton"),
  salePriceDisplay: byId("salePriceDisplay"),
  salePriceInput: byId("salePriceInput"),
  numberInputDialog: byId("numberInputDialog"),
  numberInputDialogForm: byId("numberInputDialogForm"),
  numberInputDialogHeading: byId("numberInputDialogHeading"),
  numberInputLabel: byId("numberInputLabel"),
  numberInputEditor: byId("numberInputEditor"),
  generalNumberKeypad: byId("generalNumberKeypad"),
  decimalKeyButton: byId("decimalKeyButton"),
  cancelNumberInputButton: byId("cancelNumberInputButton"),
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
let shippingConfirmed = false;
let marketPricesNeedConfirmation = false;
let highProfitNotified = false;
let editingMarketPriceIndex = null;
let lastRestoredBarcode = "";
let tutorialStep = 0;
let toastTimer = 0;
let waitingWorker = null;
let numberInputTarget = null;
let productLookupController = null;
let lastProductLookupBarcode = "";
let draftSaveTimer = 0;
let marketSearchPending = false;
let activeVoiceRecognition = null;
let activeVoiceButton = null;

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

function restoreVoiceButton(button) {
  if (!button) return;
  button.classList.remove("is-listening");
  button.innerHTML = button.dataset.idleHtml || '<span aria-hidden="true">🎤</span> 音声入力';
}

function startVoiceInput(button) {
  const Recognition = speechRecognitionConstructor(window);
  if (!Recognition) {
    showToast("このSafariでは音声入力を利用できません。画面キーパッドをお使いください。", 4200);
    return;
  }
  if (activeVoiceRecognition && activeVoiceButton === button) {
    activeVoiceRecognition.stop();
    return;
  }
  activeVoiceRecognition?.abort();
  barcodeScanner.stop("音声入力のためカメラを停止しました");
  priceScanner.stop();

  const target = byId(button.dataset.voiceTarget);
  if (!target) return;
  const recognition = new Recognition();
  const mode = button.dataset.voiceMode;
  button.dataset.idleHtml ||= button.innerHTML;
  recognition.lang = "ja-JP";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    activeVoiceRecognition = recognition;
    activeVoiceButton = button;
    button.classList.add("is-listening");
    button.innerHTML = '<span aria-hidden="true">●</span> 聞いています…タップで終了';
    if (navigator.vibrate) navigator.vibrate(20);
  };
  recognition.onresult = (event) => {
    const transcript = String(event.results?.[0]?.[0]?.transcript ?? "").trim();
    if (!transcript) return;
    if (mode === "text") {
      target.value = transcript;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      showToast(`「${transcript}」と入力しました`, 3200);
      return;
    }
    const allowDecimal = target === elements.numberInputEditor
      && numberInputTarget
      && (String(numberInputTarget.step).includes(".") || numberInputTarget.getAttribute("inputmode") === "decimal");
    const parsed = parseSpokenNumber(transcript, { allowDecimal });
    if (parsed === null) {
      showToast(`「${transcript}」から数字を読み取れませんでした`, 3800);
      return;
    }
    target.value = parsed;
    showToast(`${numberFormatter.format(Number(parsed))} と入力しました。金額を確認してください`, 3200);
  };
  recognition.onerror = (event) => showToast(speechErrorMessage(event.error), 4400);
  recognition.onend = () => {
    restoreVoiceButton(button);
    if (activeVoiceRecognition === recognition) {
      activeVoiceRecognition = null;
      activeVoiceButton = null;
    }
  };
  try {
    recognition.start();
  } catch (error) {
    restoreVoiceButton(button);
    activeVoiceRecognition = null;
    activeVoiceButton = null;
    showToast(error?.message || "音声入力を開始できませんでした。", 4200);
  }
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

function marketplaceProfile() {
  return MARKETPLACES[normalizeMarketplace(elements.marketplaceInput.value)];
}

function syncMarketplaceDisplay() {
  const key = normalizeMarketplace(elements.marketplaceInput.value);
  const profile = MARKETPLACES[key];
  elements.marketplaceInput.value = key;
  elements.marketplaceOptions.querySelectorAll("[data-marketplace]").forEach((button) => {
    const selected = button.dataset.marketplace === key;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const feeRate = elements.feeRateInput.value;
  elements.marketplaceStatus.textContent = feeRate === ""
    ? `${profile.label}・販売手数料率を入力してください`
    : `${profile.label}・販売手数料${feeRate}%（変更可）`;
  elements.marketplaceStatus.classList.toggle("is-missing", feeRate === "");
  elements.openFeeRateButton.hidden = false;
  elements.openFeeRateButton.textContent = feeRate === ""
    ? "販売手数料率を入力"
    : `手数料${feeRate}%を変更`;
  elements.quickMarketSearch.dataset.search = profile.searchKey;
  elements.quickMarketSearchLabel.textContent = profile.searchLabel;
}

function selectMarketplace(key, { applyPreset = true } = {}) {
  const normalized = normalizeMarketplace(key);
  const profile = MARKETPLACES[normalized];
  elements.marketplaceInput.value = normalized;
  if (applyPreset) elements.feeRateInput.value = profile.feeRate === null ? "" : String(profile.feeRate);
  syncMarketplaceDisplay();
  updateSearchLinks();
  renderCalculation();
  scheduleDraftSave();
}

function syncShippingDisplay() {
  const value = elements.shippingInput.value;
  elements.shippingOptions.querySelectorAll("[data-shipping]").forEach((button) => {
    const preset = button.dataset.shipping;
    const selected = shippingConfirmed && (preset === value || (
      preset === "custom" && !["0", "210", "450", "750", "1050"].includes(value)
    ));
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  elements.shippingStatus.classList.toggle("is-missing", !shippingConfirmed);
  elements.shippingStatus.textContent = shippingConfirmed
    ? `送料 ${formatCurrency(toNonNegative(value))} を計算に使用`
    : "送料を選んでください";
}

function selectShipping(value) {
  if (value === "custom") {
    openNumberInputEditor(elements.shippingInput);
    return;
  }
  elements.shippingInput.value = String(value);
  shippingConfirmed = true;
  syncShippingDisplay();
  renderCalculation();
  scheduleDraftSave();
  if (navigator.vibrate) navigator.vibrate(20);
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
  return elements.purchasePriceInput.value !== ""
    && elements.salePriceInput.value !== ""
    && elements.feeRateInput.value !== ""
    && shippingConfirmed
    && !marketPricesNeedConfirmation;
}

function missingDecisionInputs() {
  const missing = [];
  if (elements.purchasePriceInput.value === "") missing.push("仕入価格");
  if (elements.salePriceInput.value === "") missing.push("売却価格");
  if (elements.feeRateInput.value === "") missing.push("手数料");
  if (!shippingConfirmed) missing.push("送料");
  if (marketPricesNeedConfirmation) missing.push("OCR価格確認");
  return missing;
}

function renderDecisionEvidence(marketStats) {
  const missing = missingDecisionInputs();
  elements.decisionEvidence.replaceChildren();
  const title = document.createElement("strong");
  const formula = document.createElement("span");
  const confidence = document.createElement("small");
  if (missing.length > 0) {
    elements.decisionEvidence.className = "decision-evidence is-incomplete";
    title.textContent = `あと${missing.length}つで判定`;
    formula.textContent = missing.join("・");
    confidence.textContent = "未入力の費用を0円として判定することはありません。";
  } else {
    const extraCosts = currentCalculation.packaging + currentCalculation.otherCosts;
    const profile = marketplaceProfile();
    elements.decisionEvidence.className = marketStats.count > 0
      ? "decision-evidence is-supported"
      : "decision-evidence is-warning";
    title.textContent = `${profile.label}で ${VERDICTS[currentVerdict].display}`;
    formula.textContent = `${formatCurrency(currentCalculation.salePrice)} − 手数料${formatCurrency(currentCalculation.fee)} − 送料${formatCurrency(currentCalculation.shipping)} − その他${formatCurrency(extraCosts)} − 仕入${formatCurrency(currentCalculation.purchasePrice)} ＝ 利益${formatCurrency(currentCalculation.profit)}`;
    confidence.textContent = marketStats.count > 0
      ? `売れた価格${marketStats.count}件の中央値を使用しています。`
      : "相場価格0件の暫定判定です。SOLD相場を確認してください。";
  }
  elements.decisionEvidence.append(title, formula, confidence);
}

function renderCalculation() {
  syncPurchasePriceDisplay();
  syncSalePriceDisplay();
  syncMarketplaceDisplay();
  syncShippingDisplay();
  currentCalculation = calculateProfit(valuesForCalculation());
  currentVerdict = judgePurchase(currentCalculation, settings);
  const verdict = VERDICTS[currentVerdict];
  const marketStats = calculateMarketStats(elements.marketPriceInputs.map((input) => input.value));

  elements.feeResult.textContent = formatCurrency(currentCalculation.fee);
  elements.netResult.textContent = formatCurrency(currentCalculation.net);
  elements.profitResult.textContent = formatCurrency(currentCalculation.profit);
  elements.marginResult.textContent = formatPercent(currentCalculation.margin);
  elements.roiResult.textContent = formatPercent(currentCalculation.roi);
  elements.breakEvenResult.textContent = formatCurrency(currentCalculation.breakEvenPrice);

  elements.resultHero.className = "result-hero";
  if (hasDecisionInputs()) {
    elements.resultHero.classList.add(`is-${verdict.tone}`);
    elements.heroKicker.textContent = marketStats.count > 0
      ? `仕入判定・相場${marketStats.count}件`
      : "暫定判定・相場根拠なし";
    elements.heroVerdict.textContent = verdict.display;
    elements.heroProfit.textContent = formatCurrency(currentCalculation.profit);
    elements.heroRoi.textContent = formatPercent(currentCalculation.roi);
  } else {
    const missing = missingDecisionInputs();
    elements.resultHero.classList.add("is-empty");
    elements.heroKicker.textContent = `必須：${missing.join("・")}`;
    elements.heroVerdict.textContent = `あと${missing.length}つ入力`;
    elements.heroProfit.textContent = "―";
    elements.heroRoi.textContent = "―";
  }

  renderDecisionEvidence(marketStats);

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
  elements.openPurchasePriceButton.classList.toggle("is-required-missing", !hasPrice);
}

function syncSalePriceDisplay() {
  const hasPrice = elements.salePriceInput.value !== "";
  elements.salePriceDisplay.textContent = hasPrice
    ? formatCurrency(toNonNegative(elements.salePriceInput.value))
    : "未入力";
  elements.openSalePriceButton.classList.toggle("has-value", hasPrice);
  elements.openSalePriceButton.classList.toggle("is-required-missing", !hasPrice);
}

function openPurchasePriceEditor() {
  elements.purchasePriceEditor.value = elements.purchasePriceInput.value;
  if (typeof elements.purchasePriceDialog.showModal === "function") {
    elements.purchasePriceDialog.showModal();
  } else {
    elements.purchasePriceDialog.setAttribute("open", "");
  }
  window.setTimeout(() => elements.purchasePriceDialog.querySelector("[data-number-key]")?.focus(), 50);
}

function closePurchasePriceEditor() {
  if (typeof elements.purchasePriceDialog.close === "function") elements.purchasePriceDialog.close();
  else elements.purchasePriceDialog.removeAttribute("open");
}

function applyPurchasePrice() {
  if (elements.purchasePriceEditor.value === "") {
    showToast("画面の数字ボタンで仕入価格を入力してください");
    return false;
  }
  elements.purchasePriceInput.value = String(Math.round(toNonNegative(elements.purchasePriceEditor.value)));
  syncPurchasePriceDisplay();
  renderCalculation();
  scheduleDraftSave();
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
  marketSearchPending = false;
  if (typeof elements.marketPriceDialog.close === "function") elements.marketPriceDialog.close();
  else elements.marketPriceDialog.removeAttribute("open");
  scheduleDraftSave();
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
  window.setTimeout(() => elements.marketPriceDialog.querySelector("[data-number-key]")?.focus(), 50);
}

function applyMarketPrice() {
  if (toNonNegative(elements.marketPriceEditor.value) <= 0) {
    showToast("画面の数字ボタンで売れた価格を入力してください");
    return false;
  }
  const value = String(Math.round(toNonNegative(elements.marketPriceEditor.value)));
  const values = marketPriceValues();
  if (editingMarketPriceIndex === null) values.push(value);
  else values[editingMarketPriceIndex] = value;
  elements.marketPriceInputs.forEach((input, index) => { input.value = values[index] ?? ""; });
  salePriceIsAutomatic = true;
  const wasEditing = editingMarketPriceIndex !== null;
  renderMarketStats();
  scheduleDraftSave();
  if (navigator.vibrate) navigator.vibrate(25);
  if (wasEditing || values.length >= elements.marketPriceInputs.length) {
    closeMarketPriceEditor();
    showToast(wasEditing ? "相場価格を変更しました" : "5件の相場を追加しました");
  } else {
    elements.marketPriceEditor.value = "";
    elements.marketPriceDialogStatus.textContent = `追加済み ${values.length}/5件。続けて入力できます。`;
    elements.marketPriceDialog.querySelector("[data-number-key]")?.focus();
  }
  return true;
}

function updateNumberEditor(editor, key) {
  const current = editor.value;
  if (key === "clear") editor.value = "";
  else if (key === "backspace") editor.value = current.slice(0, -1);
  else if (key === "decimal") {
    if (editor.dataset.allowDecimal === "true" && !current.includes(".")) editor.value = current ? `${current}.` : "0.";
  } else if (/^\d$/.test(key)) {
    const digitCount = current.replace(/\D/g, "").length;
    if (digitCount >= 9) return;
    editor.value = current === "0" ? key : `${current}${key}`;
  }
}

function inputDisplayName(input) {
  return input.closest("label")?.querySelector("span")?.textContent?.replace(/必須/g, "").trim()
    || input.getAttribute("aria-label")
    || "数字";
}

function closeNumberInputEditor() {
  numberInputTarget = null;
  if (typeof elements.numberInputDialog.close === "function") elements.numberInputDialog.close();
  else elements.numberInputDialog.removeAttribute("open");
}

function openNumberInputEditor(input) {
  numberInputTarget = input;
  const allowDecimal = String(input.step).includes(".") || input.inputMode === "decimal";
  elements.numberInputDialogHeading.textContent = inputDisplayName(input);
  elements.numberInputLabel.textContent = "下の数字ボタンで入力";
  elements.numberInputEditor.value = input.value;
  elements.numberInputEditor.dataset.allowDecimal = String(allowDecimal);
  elements.decimalKeyButton.hidden = !allowDecimal;
  if (typeof elements.numberInputDialog.showModal === "function") elements.numberInputDialog.showModal();
  else elements.numberInputDialog.setAttribute("open", "");
  window.setTimeout(() => elements.generalNumberKeypad.querySelector("[data-number-key]")?.focus(), 50);
}

function applyNumberInput() {
  if (!numberInputTarget) return false;
  const raw = elements.numberInputEditor.value;
  let value = raw;
  if (raw !== "") {
    let numeric = Number(raw);
    if (!Number.isFinite(numeric)) return false;
    const minimum = Number(numberInputTarget.min);
    const maximum = Number(numberInputTarget.max);
    if (numberInputTarget.min !== "" && Number.isFinite(minimum)) numeric = Math.max(minimum, numeric);
    if (numberInputTarget.max !== "" && Number.isFinite(maximum)) numeric = Math.min(maximum, numeric);
    const allowDecimal = String(numberInputTarget.step).includes(".") || numberInputTarget.inputMode === "decimal";
    value = String(allowDecimal ? numeric : Math.round(numeric));
  }
  const target = numberInputTarget;
  target.value = value;
  closeNumberInputEditor();
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.dispatchEvent(new Event("change", { bubbles: true }));
  if (navigator.vibrate) navigator.vibrate(20);
  return true;
}

function enableScreenNumberInputs() {
  document.querySelectorAll('input[type="number"]').forEach((input) => {
    input.readOnly = true;
    input.inputMode = "none";
    input.dataset.screenNumber = "true";
    input.setAttribute("aria-haspopup", "dialog");
    input.addEventListener("click", () => openNumberInputEditor(input));
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openNumberInputEditor(input);
    });
  });
}

function removeMarketPrice(index) {
  const values = marketPriceValues();
  values.splice(index, 1);
  elements.marketPriceInputs.forEach((input, inputIndex) => { input.value = values[inputIndex] ?? ""; });
  salePriceIsAutomatic = true;
  renderMarketStats();
  scheduleDraftSave();
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

async function fillProductNameFromBarcode(code) {
  const normalized = normalizeBarcode(code);
  if (!isBookIsbn(normalized)) {
    if (normalized.length >= 8 && !elements.productNameInput.value) {
      setMessage(elements.productLookupStatus, "一般商品は商品名を入力してください。検索では商品名を優先します。");
    }
    return false;
  }
  if (elements.productNameInput.value) {
    setMessage(elements.productLookupStatus, "入力済みの商品名を検索に使います。");
    return false;
  }
  if (normalized === lastProductLookupBarcode) return false;
  lastProductLookupBarcode = normalized;
  productLookupController?.abort();
  productLookupController = new AbortController();
  setMessage(elements.productLookupStatus, "本の商品名を取得しています…");
  try {
    const book = await lookupBookByIsbn(normalized, { signal: productLookupController.signal });
    if (normalizeBarcode(elements.barcodeInput.value) !== normalized || elements.productNameInput.value) return false;
    if (!book) {
      setMessage(elements.productLookupStatus, "このISBNの商品名は見つかりませんでした。手入力してください。");
      return false;
    }
    elements.productNameInput.value = book.title;
    updateSearchLinks();
    scheduleDraftSave();
    setMessage(elements.productLookupStatus, `商品名を自動入力しました：${book.title}`);
    showToast("本の商品名を自動入力しました");
    return true;
  } catch (error) {
    if (error?.name !== "AbortError") {
      lastProductLookupBarcode = "";
      setMessage(elements.productLookupStatus, "商品名を取得できませんでした。手入力はそのまま使えます。");
    }
    return false;
  }
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
  marketPricesNeedConfirmation = false;
  elements.confirmMarketPricesButton.hidden = true;
  if (!elements.productNameInput.value && previous.productName) elements.productNameInput.value = previous.productName;
  elements.marketplaceInput.value = normalizeMarketplace(previous.marketplace);
  elements.feeRateInput.value = previous.feeRate ?? elements.feeRateInput.value;
  elements.shippingInput.value = previous.shipping ?? elements.shippingInput.value;
  shippingConfirmed = previous.shippingConfirmed !== false;
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
  scheduleDraftSave();
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
    void fillProductNameFromBarcode(code);
    scheduleDraftSave();
    elements.scanSuccess.hidden = false;
    window.setTimeout(() => { elements.scanSuccess.hidden = true; }, 900);
    showToast(`バーコード ${code} を読み取りました`);
    document.getElementById("quick-section").scrollIntoView({ behavior: "smooth", block: "start" });
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
    marketPricesNeedConfirmation = false;
    elements.confirmMarketPricesButton.hidden = true;
    setMessage(elements.marketOcrStatus, "￥または円付きの価格を見つけられませんでした。誤判定防止のため、ほかの数字は採用していません。手入力も利用できます。");
    return;
  }
  elements.marketPriceInputs.forEach((input, index) => {
    input.value = result.candidates[index] ?? "";
  });
  salePriceIsAutomatic = true;
  marketPricesNeedConfirmation = true;
  elements.confirmMarketPricesButton.hidden = false;
  const stats = renderMarketStats();
  scheduleDraftSave();
  setMessage(elements.marketOcrStatus, `${stats.count}件を読み取りました。誤った金額は×で削除し、確認ボタンを押してください。`);
  showToast(`相場${stats.count}件を抽出しました。金額確認が必要です`, 3600);
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
      scheduleDraftSave();
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

function draftValues() {
  return {
    editingId: editingId ?? "",
    barcode: normalizeBarcode(elements.barcodeInput.value),
    productName: elements.productNameInput.value,
    purchasePrice: elements.purchasePriceInput.value,
    salePrice: elements.salePriceInput.value,
    feeRate: elements.feeRateInput.value,
    shipping: elements.shippingInput.value,
    packaging: elements.packagingInput.value,
    otherCosts: elements.otherCostsInput.value,
    storeName: elements.storeNameInput.value,
    note: elements.noteInput.value,
    marketPrices: elements.marketPriceInputs.map((input) => input.value),
    soldCount: elements.soldCountInput.value,
    activeCount: elements.activeCountInput.value,
    recentSaleDate: elements.recentSaleDateInput.value,
    checkedDate: elements.checkedDateInput.value,
    marketplace: normalizeMarketplace(elements.marketplaceInput.value),
    shippingConfirmed,
    marketPricesNeedConfirmation,
    salePriceIsAutomatic,
    marketSearchPending,
  };
}

function hasDraftContent(draft) {
  return Boolean(
    draft.editingId
    || draft.barcode
    || draft.productName.trim()
    || draft.purchasePrice
    || draft.salePrice
    || draft.note.trim()
    || draft.marketPrices.some(Boolean),
  );
}

function saveDraftNow() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = 0;
  const draft = draftValues();
  return hasDraftContent(draft) ? repository.saveDraft(draft) : repository.clearDraft();
}

function scheduleDraftSave() {
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = window.setTimeout(saveDraftNow, 180);
}

function restoreDraft() {
  const draft = repository.loadDraft();
  if (!draft || !hasDraftContent(draft)) return false;
  editingId = draft.editingId && items.some((item) => item.id === draft.editingId)
    ? draft.editingId
    : null;
  elements.barcodeInput.value = draft.barcode;
  elements.productNameInput.value = draft.productName;
  elements.purchasePriceInput.value = draft.purchasePrice;
  elements.salePriceInput.value = draft.salePrice;
  elements.marketplaceInput.value = normalizeMarketplace(draft.marketplace);
  elements.feeRateInput.value = draft.feeRate;
  elements.shippingInput.value = draft.shipping;
  elements.packagingInput.value = draft.packaging || "0";
  elements.otherCostsInput.value = draft.otherCosts || "0";
  elements.storeNameInput.value = draft.storeName;
  elements.noteInput.value = draft.note;
  elements.marketPriceInputs.forEach((input, index) => { input.value = draft.marketPrices[index] ?? ""; });
  elements.soldCountInput.value = draft.soldCount;
  elements.activeCountInput.value = draft.activeCount;
  elements.recentSaleDateInput.value = draft.recentSaleDate;
  elements.checkedDateInput.value = draft.checkedDate || localDateValue();
  salePriceIsAutomatic = draft.salePriceIsAutomatic;
  shippingConfirmed = draft.shippingConfirmed;
  marketPricesNeedConfirmation = draft.marketPricesNeedConfirmation;
  elements.confirmMarketPricesButton.hidden = !marketPricesNeedConfirmation;
  marketSearchPending = draft.marketSearchPending;
  lastRestoredBarcode = draft.barcode;
  lastProductLookupBarcode = draft.productName ? draft.barcode : "";
  elements.saveItemButton.textContent = editingId ? "変更を保存" : "この商品を保存";
  elements.cancelEditButton.hidden = !editingId;
  setMessage(elements.productLookupStatus, draft.productName
    ? "入力途中の商品名を復元しました。この商品名を優先して検索します。"
    : "入力途中の内容を復元しました。");
  syncPurchasePriceDisplay();
  syncMarketplaceDisplay();
  updateSearchLinks();
  renderMarketStats({ updateSalePrice: false });
  renderTurnover();
  return true;
}

function currentItem(existing) {
  const now = new Date().toISOString();
  const marketStats = calculateMarketStats(elements.marketPriceInputs.map((input) => input.value));
  return {
    id: existing?.id ?? makeId(),
    productName: elements.productNameInput.value.trim(),
    barcode: normalizeBarcode(elements.barcodeInput.value),
    marketplace: normalizeMarketplace(elements.marketplaceInput.value),
    purchasePrice: currentCalculation.purchasePrice,
    salePrice: currentCalculation.salePrice,
    feeRate: currentCalculation.feeRate,
    shipping: currentCalculation.shipping,
    shippingConfirmed,
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
  window.clearTimeout(draftSaveTimer);
  draftSaveTimer = 0;
  repository.clearDraft();
  editingId = null;
  marketSearchPending = false;
  elements.barcodeInput.value = "";
  elements.productNameInput.value = "";
  elements.purchasePriceInput.value = "";
  syncPurchasePriceDisplay();
  elements.salePriceInput.value = "";
  elements.marketplaceInput.value = "mercari";
  elements.feeRateInput.value = String(MARKETPLACES.mercari.feeRate);
  elements.shippingInput.value = "";
  shippingConfirmed = false;
  marketPricesNeedConfirmation = false;
  elements.confirmMarketPricesButton.hidden = true;
  lastRestoredBarcode = "";
  lastProductLookupBarcode = "";
  productLookupController?.abort();
  setMessage(elements.productLookupStatus, "本のISBNはスキャン後に商品名を自動取得します。");
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
  syncMarketplaceDisplay();
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
  if (toNonNegative(elements.salePriceInput.value) <= 0) {
    showToast("想定売却価格を入力してください");
    openNumberInputEditor(elements.salePriceInput);
    return;
  }
  if (elements.feeRateInput.value === "") {
    showToast("販売手数料率を入力してください");
    openNumberInputEditor(elements.feeRateInput);
    return;
  }
  if (!shippingConfirmed) {
    showToast("送料を選んでください");
    document.getElementById("quick-section").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (marketPricesNeedConfirmation) {
    showToast("OCRで読み取った相場価格を確認してください", 3600);
    document.getElementById("market-section").scrollIntoView({ behavior: "smooth", block: "start" });
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
  elements.marketplaceInput.value = normalizeMarketplace(item.marketplace);
  elements.feeRateInput.value = item.feeRate ?? 10;
  elements.shippingInput.value = item.shipping ?? 0;
  shippingConfirmed = item.shippingConfirmed !== false;
  marketPricesNeedConfirmation = false;
  elements.confirmMarketPricesButton.hidden = true;
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
  syncMarketplaceDisplay();
  syncShippingDisplay();
  updateSearchLinks();
  renderMarketStats({ updateSalePrice: false });
  renderTurnover();
  scheduleDraftSave();
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
      createMetric("販売先", MARKETPLACES[normalizeMarketplace(item.marketplace)].label),
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
  enableScreenNumberInputs();
  document.querySelectorAll("[data-voice-target]").forEach((button) => {
    button.addEventListener("click", () => startVoiceInput(button));
  });
  document.addEventListener("input", scheduleDraftSave);
  document.addEventListener("change", scheduleDraftSave);
  document.addEventListener("click", (event) => {
    const keyButton = event.target.closest("[data-number-key]");
    if (!keyButton) return;
    const keypad = keyButton.closest("[data-keypad-for]");
    const editor = keypad ? byId(keypad.dataset.keypadFor) : null;
    if (editor) updateNumberEditor(editor, keyButton.dataset.numberKey);
  });
  elements.cancelNumberInputButton.addEventListener("click", closeNumberInputEditor);
  elements.numberInputDialogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    applyNumberInput();
  });
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
    void fillProductNameFromBarcode(elements.barcodeInput.value);
  });
  elements.productNameInput.addEventListener("input", () => {
    updateSearchLinks();
    setMessage(elements.productLookupStatus, elements.productNameInput.value
      ? "この商品名を優先して検索します。"
      : "本のISBNはスキャン後に商品名を自動取得します。");
  });
  elements.marketplaceOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-marketplace]");
    if (button) selectMarketplace(button.dataset.marketplace);
  });
  elements.shippingOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-shipping]");
    if (button) selectShipping(button.dataset.shipping);
  });
  elements.openFeeRateButton.addEventListener("click", () => openNumberInputEditor(elements.feeRateInput));
  document.querySelectorAll("[data-search]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (link.getAttribute("aria-disabled") === "true") {
        event.preventDefault();
        return;
      }
      barcodeScanner.stop("相場検索のためカメラを停止しました");
      priceScanner.stop();
      event.preventDefault();
      marketSearchPending = true;
      saveDraftNow();
      const searchTab = window.open("about:blank", "barcodeProfitMarketSearch");
      if (searchTab) {
        try { searchTab.opener = null; } catch { /* Safariでは設定できない場合があります */ }
        searchTab.location.href = link.href;
        openMarketPriceEditor();
        elements.marketPriceDialogStatus.textContent = "検索タブから戻ったら、確認した売却価格を入力してください。";
      } else {
        marketSearchPending = false;
        saveDraftNow();
        showToast("検索タブを開けません。Safariのポップアップを許可してください", 4200);
      }
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
  elements.openSalePriceButton.addEventListener("click", () => openNumberInputEditor(elements.salePriceInput));
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
  elements.confirmMarketPricesButton.addEventListener("click", () => {
    marketPricesNeedConfirmation = false;
    elements.confirmMarketPricesButton.hidden = true;
    renderCalculation();
    scheduleDraftSave();
    showToast("OCRの相場価格を確定しました");
  });
  elements.openMarketPriceButton.addEventListener("click", () => openMarketPriceEditor());
  elements.finishMarketPriceButton.addEventListener("click", closeMarketPriceEditor);
  elements.marketPriceDialog.addEventListener("cancel", () => {
    marketSearchPending = false;
    scheduleDraftSave();
  });
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
    marketPricesNeedConfirmation = false;
    elements.confirmMarketPricesButton.hidden = true;
    renderCalculation();
  });
  elements.feeRateInput.addEventListener("input", renderCalculation);
  elements.shippingInput.addEventListener("input", () => {
    shippingConfirmed = elements.shippingInput.value !== "";
    renderCalculation();
  });
  [elements.packagingInput, elements.otherCostsInput].forEach((input) => input.addEventListener("input", renderCalculation));
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
    document.getElementById("quick-section").scrollIntoView({ behavior: "smooth", block: "start" });
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
    saveDraftNow();
    activeVoiceRecognition?.abort();
    barcodeScanner.stop();
    priceScanner.terminate();
    marketImageReader.terminate();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      saveDraftNow();
      barcodeScanner.stop();
      priceScanner.stop();
    } else if (marketSearchPending && !elements.marketPriceDialog.open) {
      openMarketPriceEditor();
      elements.marketPriceDialogStatus.textContent = "検索結果で確認した売却価格を入力してください。";
    }
  });
  window.addEventListener("pageshow", () => {
    if (!hasDraftContent(draftValues()) && restoreDraft()) {
      showToast("入力途中の内容を復元しました");
    }
    if (marketSearchPending && !elements.marketPriceDialog.open) {
      openMarketPriceEditor();
      elements.marketPriceDialogStatus.textContent = "検索結果で確認した売却価格を入力してください。";
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
  elements.marketplaceInput.value = "mercari";
  elements.feeRateInput.value = String(MARKETPLACES.mercari.feeRate);
  elements.shippingInput.value = "";
  shippingConfirmed = false;
  settingsToForm();
  syncMarketplaceDisplay();
  registerEvents();
  const draftRestored = restoreDraft();
  if (!draftRestored) {
    updateSearchLinks();
    renderMarketStats();
    renderTurnover();
  } else if (!elements.productNameInput.value) {
    void fillProductNameFromBarcode(elements.barcodeInput.value);
  }
  renderSavedItems();
  registerServiceWorker();
  if (marketSearchPending) window.setTimeout(() => {
    if (!elements.marketPriceDialog.open) openMarketPriceEditor();
    elements.marketPriceDialogStatus.textContent = "検索結果で確認した売却価格を入力してください。";
  }, 350);
  if (draftRestored) window.setTimeout(() => showToast("検索前の入力内容を復元しました"), 300);
}

initialize();
