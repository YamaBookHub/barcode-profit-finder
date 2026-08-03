const STORAGE_KEYS = Object.freeze({
  items: "barcodeProfitFinder.items.v1",
  settings: "barcodeProfitFinder.settings.v1",
});

export const DEFAULT_SETTINGS = Object.freeze({
  candidateProfit: 2000,
  candidateRoi: 40,
  reviewProfit: 1000,
});

const VERDICTS = Object.freeze({
  candidate: { label: "仕入候補", icon: "◎" },
  review: { label: "要確認", icon: "△" },
  loss: { label: "赤字", icon: "×" },
  skip: { label: "見送り", icon: "―" },
});

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function toFiniteNumber(value, fallback = 0) {
  const normalized = typeof value === "string" ? value.replaceAll(",", "").trim() : value;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : fallback;
}

function toNonNegative(value) {
  return Math.max(0, toFiniteNumber(value));
}

function normalizeSettings(settings = {}) {
  return {
    candidateProfit: toNonNegative(settings.candidateProfit ?? DEFAULT_SETTINGS.candidateProfit),
    candidateRoi: toNonNegative(settings.candidateRoi ?? DEFAULT_SETTINGS.candidateRoi),
    reviewProfit: toNonNegative(settings.reviewProfit ?? DEFAULT_SETTINGS.reviewProfit),
  };
}

export function normalizeBarcode(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
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
    calculation.profit >= rules.candidateProfit
    && calculation.roi !== null
    && calculation.roi >= rules.candidateRoi
  ) {
    return "candidate";
  }
  if (calculation.profit >= rules.reviewProfit) return "review";
  return "skip";
}

export function buildSearchUrls(barcode) {
  const normalized = normalizeBarcode(barcode);
  const query = encodeURIComponent(normalized);
  return {
    google: `https://www.google.com/search?tbm=shop&q=${query}`,
    mercari: `https://jp.mercari.com/search?keyword=${query}`,
    mercariSold: `https://jp.mercari.com/search?keyword=${query}&status=sold_out`,
    surugaya: `https://www.suruga-ya.jp/search?search_word=${query}`,
    yahooFlea: `https://paypayfleamarket.yahoo.co.jp/search/${query}`,
    yahooAuction: `https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=${query}`,
  };
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function formatYen(value) {
  return yenFormatter.format(Math.round(toFiniteNumber(value)));
}

function formatPercent(value) {
  return value === null || !Number.isFinite(value) ? "―" : `${value.toFixed(1)}%`;
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readJsonStorage(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function initApp() {
  const byId = (id) => document.getElementById(id);
  const elements = {
    resultHero: byId("resultHero"),
    heroVerdict: byId("heroVerdict"),
    heroProfit: byId("heroProfit"),
    heroRoi: byId("heroRoi"),
    settingsPanel: byId("settingsPanel"),
    settingsOpenButton: byId("settingsOpenButton"),
    settingsCloseButton: byId("settingsCloseButton"),
    settingsForm: byId("settingsForm"),
    candidateProfitInput: byId("candidateProfitInput"),
    candidateRoiInput: byId("candidateRoiInput"),
    reviewProfitInput: byId("reviewProfitInput"),
    settingsResetButton: byId("settingsResetButton"),
    cameraFrame: byId("cameraFrame"),
    cameraVideo: byId("cameraVideo"),
    cameraPlaceholder: byId("cameraPlaceholder"),
    cameraStatus: byId("cameraStatus"),
    cameraError: byId("cameraError"),
    scanSuccess: byId("scanSuccess"),
    startScanButton: byId("startScanButton"),
    stopScanButton: byId("stopScanButton"),
    rescanButton: byId("rescanButton"),
    barcodeInput: byId("barcodeInput"),
    searchLinks: byId("searchLinks"),
    searchHint: byId("searchHint"),
    profitForm: byId("profitForm"),
    productNameInput: byId("productNameInput"),
    purchasePriceInput: byId("purchasePriceInput"),
    salePriceInput: byId("salePriceInput"),
    feeRateInput: byId("feeRateInput"),
    shippingInput: byId("shippingInput"),
    packagingInput: byId("packagingInput"),
    otherCostsInput: byId("otherCostsInput"),
    feeResult: byId("feeResult"),
    netResult: byId("netResult"),
    profitResult: byId("profitResult"),
    marginResult: byId("marginResult"),
    roiResult: byId("roiResult"),
    breakEvenResult: byId("breakEvenResult"),
    calculationSection: byId("calculationSection"),
    saveItemButton: byId("saveItemButton"),
    cancelEditButton: byId("cancelEditButton"),
    savedSummary: byId("savedSummary"),
    savedItemsList: byId("savedItemsList"),
    exportCsvButton: byId("exportCsvButton"),
    toast: byId("toast"),
  };

  let settings = normalizeSettings(readJsonStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
  let savedItems = readJsonStorage(STORAGE_KEYS.items, []);
  if (!Array.isArray(savedItems)) savedItems = [];

  let scannerControls = null;
  let codeReader = null;
  let editingId = null;
  let toastTimer = null;
  let scanFeedbackTimer = null;

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 2600);
  }

  function setCameraError(message = "") {
    elements.cameraError.textContent = message;
    elements.cameraError.hidden = !message;
  }

  function setScanningState(isScanning) {
    elements.cameraFrame.classList.toggle("is-scanning", isScanning);
    elements.startScanButton.disabled = isScanning;
    elements.stopScanButton.disabled = !isScanning;
  }

  function getFormValues() {
    return {
      productName: elements.productNameInput.value.trim(),
      barcode: normalizeBarcode(elements.barcodeInput.value),
      purchasePrice: elements.purchasePriceInput.value,
      salePrice: elements.salePriceInput.value,
      feeRate: elements.feeRateInput.value,
      shipping: elements.shippingInput.value,
      packaging: elements.packagingInput.value,
      otherCosts: elements.otherCostsInput.value,
    };
  }

  function hasRequiredPrices() {
    return elements.purchasePriceInput.value !== "" && elements.salePriceInput.value !== "";
  }

  function currentCalculation() {
    return calculateProfit(getFormValues());
  }

  function updateSearchLinks() {
    const barcode = normalizeBarcode(elements.barcodeInput.value);
    const urls = buildSearchUrls(barcode);
    elements.searchLinks.querySelectorAll("a[data-search]").forEach((link) => {
      const enabled = barcode.length > 0;
      link.href = enabled ? urls[link.dataset.search] : "#";
      link.setAttribute("aria-disabled", String(!enabled));
    });
    elements.searchHint.hidden = barcode.length > 0;
  }

  function updateCalculation() {
    const calculation = currentCalculation();
    const verdictKey = judgePurchase(calculation, settings);
    const verdict = VERDICTS[verdictKey];

    elements.feeResult.textContent = formatYen(calculation.fee);
    elements.netResult.textContent = formatYen(calculation.net);
    elements.profitResult.textContent = formatYen(calculation.profit);
    elements.marginResult.textContent = formatPercent(calculation.margin);
    elements.roiResult.textContent = formatPercent(calculation.roi);
    elements.breakEvenResult.textContent = calculation.breakEvenPrice === null
      ? "計算不可"
      : formatYen(calculation.breakEvenPrice);

    elements.resultHero.className = "result-hero";
    if (!hasRequiredPrices()) {
      elements.resultHero.classList.add("is-empty");
      elements.heroVerdict.textContent = "価格を入力してください";
      elements.heroProfit.textContent = "―";
      elements.heroRoi.textContent = "―";
      return;
    }

    elements.resultHero.classList.add(`is-${verdictKey}`);
    elements.heroVerdict.textContent = `${verdict.icon} ${verdict.label}`;
    elements.heroProfit.textContent = formatYen(calculation.profit);
    elements.heroRoi.textContent = formatPercent(calculation.roi);
  }

  function updateAll() {
    updateSearchLinks();
    updateCalculation();
  }

  function populateSettingsForm() {
    elements.candidateProfitInput.value = String(settings.candidateProfit);
    elements.candidateRoiInput.value = String(settings.candidateRoi);
    elements.reviewProfitInput.value = String(settings.reviewProfit);
  }

  function toggleSettings(open) {
    elements.settingsPanel.hidden = !open;
    elements.settingsOpenButton.setAttribute("aria-expanded", String(open));
    if (open) {
      populateSettingsForm();
      elements.settingsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function permissionMessage(error) {
    const name = error?.name ?? "";
    if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
      return "カメラの利用が許可されていません。\nSafariのアドレスバー左側のメニュー → Webサイトの設定 → カメラ → 許可 に変更して再読み込みしてください。\niPhoneの設定アプリ → アプリ → Safari → カメラ でも確認できます。";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return "利用できるカメラが見つかりません。JANコードを手入力してください。";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "カメラを開始できませんでした。他のカメラアプリを閉じてから、もう一度お試しください。";
    }
    if (name === "OverconstrainedError") {
      return "この端末のカメラ設定に対応できませんでした。ページを再読み込みして、もう一度お試しください。";
    }
    return "カメラを開始できませんでした。Safariを再読み込みするか、JANコードを手入力してください。";
  }

  function releaseVideoTracks() {
    const stream = elements.cameraVideo.srcObject;
    if (stream?.getTracks) stream.getTracks().forEach((track) => track.stop());
    elements.cameraVideo.srcObject = null;
  }

  function stopScanner(status = "カメラを停止しました") {
    try {
      scannerControls?.stop();
    } catch {
      // ZXing側ですでに停止済みの場合は何もしません。
    }
    scannerControls = null;
    releaseVideoTracks();
    setScanningState(false);
    elements.cameraStatus.textContent = status;
  }

  function handleScanSuccess(result, controls) {
    const rawText = typeof result?.getText === "function" ? result.getText() : result?.text;
    const barcode = normalizeBarcode(rawText);
    if (!barcode) return;

    try {
      controls?.stop();
    } catch {
      // 直前に停止されていても、読取結果はそのまま利用します。
    }
    elements.barcodeInput.value = barcode;
    updateAll();
    stopScanner(`読取完了：${barcode}`);
    setCameraError("");
    elements.scanSuccess.hidden = false;
    window.clearTimeout(scanFeedbackTimer);
    scanFeedbackTimer = window.setTimeout(() => {
      elements.scanSuccess.hidden = true;
    }, 1100);
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
    showToast("バーコードを読み取りました");
  }

  async function startScanner() {
    setCameraError("");
    elements.scanSuccess.hidden = true;

    if (!window.isSecureContext) {
      setCameraError("カメラはHTTPSのページでのみ利用できます。公開URL（https://）から開くか、JANコードを手入力してください。");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("このブラウザはカメラ読取に対応していません。最新のSafariで開くか、JANコードを手入力してください。");
      return;
    }

    const ZXing = globalThis.ZXingBrowser;
    if (!ZXing?.BrowserMultiFormatReader) {
      setCameraError("バーコード読取機能を読み込めませんでした。通信状態を確認してページを再読み込みしてください。");
      return;
    }

    stopScanner("カメラを準備しています…");
    setScanningState(true);

    try {
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
        ZXing.BarcodeFormat.EAN_13,
        ZXing.BarcodeFormat.EAN_8,
        ZXing.BarcodeFormat.UPC_A,
        ZXing.BarcodeFormat.UPC_E,
        ZXing.BarcodeFormat.CODE_128,
      ]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

      codeReader = new ZXing.BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 80,
        delayBetweenScanSuccess: 400,
        tryPlayVideoTimeout: 5000,
      });

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      scannerControls = await codeReader.decodeFromConstraints(
        constraints,
        elements.cameraVideo,
        (result, error, controls) => {
          if (result) {
            handleScanSuccess(result, controls);
            return;
          }
          const errorName = error?.name ?? error?.constructor?.name;
          if (error && errorName !== "NotFoundException" && errorName !== "ChecksumException" && errorName !== "FormatException") {
            setCameraError("バーコードを読み取れませんでした。明るい場所で、バーコード全体を枠内に入れてください。");
          }
        },
      );
      elements.cameraStatus.textContent = "読取中です。バーコードを枠内に合わせてください";
    } catch (error) {
      stopScanner("カメラを開始できませんでした");
      setCameraError(permissionMessage(error));
    }
  }

  function resetProductForm() {
    editingId = null;
    elements.productNameInput.value = "";
    elements.barcodeInput.value = "";
    elements.purchasePriceInput.value = "";
    elements.salePriceInput.value = "";
    elements.feeRateInput.value = "10";
    elements.shippingInput.value = "0";
    elements.packagingInput.value = "0";
    elements.otherCostsInput.value = "0";
    elements.saveItemButton.textContent = "この商品を保存";
    elements.cancelEditButton.hidden = true;
    updateAll();
  }

  async function rescan() {
    stopScanner("再スキャンの準備中です…");
    resetProductForm();
    await startScanner();
  }

  function persistItems() {
    const stored = writeJsonStorage(STORAGE_KEYS.items, savedItems);
    if (!stored) showToast("保存できませんでした。Safariのストレージ設定をご確認ください");
    return stored;
  }

  function recordFromForm(id = createId(), savedAt = new Date().toISOString()) {
    const values = getFormValues();
    const calculation = calculateProfit(values);
    const verdictKey = judgePurchase(calculation, settings);
    return {
      id,
      productName: values.productName || "商品名未入力",
      barcode: values.barcode,
      ...calculation,
      verdict: verdictKey,
      verdictLabel: VERDICTS[verdictKey].label,
      savedAt,
      updatedAt: new Date().toISOString(),
    };
  }

  function makeTextElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function makeMetric(label, value) {
    const wrapper = document.createElement("div");
    wrapper.append(makeTextElement("span", "", label), makeTextElement("strong", "", value));
    return wrapper;
  }

  function renderSavedItems() {
    elements.savedItemsList.replaceChildren();
    elements.exportCsvButton.disabled = savedItems.length === 0;
    elements.savedSummary.textContent = savedItems.length === 0
      ? "保存した商品はありません。"
      : `${savedItems.length}件をこの端末に保存しています。`;

    const sortedItems = [...savedItems].sort((a, b) => String(b.updatedAt ?? b.savedAt).localeCompare(String(a.updatedAt ?? a.savedAt)));
    sortedItems.forEach((item) => {
      const card = document.createElement("article");
      card.className = "saved-item";
      card.dataset.itemId = item.id;

      const head = document.createElement("div");
      head.className = "saved-item-head";
      const titleArea = document.createElement("div");
      titleArea.append(
        makeTextElement("h3", "", item.productName || "商品名未入力"),
        makeTextElement("p", "saved-item-code", `JAN：${item.barcode || "未入力"}`),
        makeTextElement("p", "saved-item-date", dateFormatter.format(new Date(item.updatedAt ?? item.savedAt))),
      );
      const verdictKey = VERDICTS[item.verdict] ? item.verdict : "skip";
      const badge = makeTextElement("span", `verdict-badge is-${verdictKey}`, item.verdictLabel || VERDICTS[verdictKey].label);
      head.append(titleArea, badge);

      const metrics = document.createElement("div");
      metrics.className = "saved-metrics";
      metrics.append(
        makeMetric("仕入", formatYen(item.purchasePrice)),
        makeMetric("売価", formatYen(item.salePrice)),
        makeMetric("利益", formatYen(item.profit)),
        makeMetric("ROI", formatPercent(item.roi)),
      );

      const actions = document.createElement("div");
      actions.className = "saved-actions";
      const editButton = makeTextElement("button", "secondary-button", "編集");
      editButton.type = "button";
      editButton.dataset.action = "edit";
      const recalculateButton = makeTextElement("button", "secondary-button", "再計算");
      recalculateButton.type = "button";
      recalculateButton.dataset.action = "recalculate";
      const deleteButton = makeTextElement("button", "danger-button", "削除");
      deleteButton.type = "button";
      deleteButton.dataset.action = "delete";
      actions.append(editButton, recalculateButton, deleteButton);

      card.append(head, metrics, actions);
      elements.savedItemsList.append(card);
    });
  }

  function saveCurrentItem() {
    if (!hasRequiredPrices() || !elements.profitForm.reportValidity()) {
      showToast("仕入価格と想定売却価格を入力してください");
      return;
    }

    if (editingId) {
      const index = savedItems.findIndex((item) => item.id === editingId);
      if (index >= 0) {
        savedItems[index] = recordFromForm(editingId, savedItems[index].savedAt);
        if (persistItems()) showToast("保存内容を更新しました");
      }
    } else {
      savedItems.push(recordFromForm());
      if (persistItems()) showToast("この商品を保存しました");
    }

    editingId = null;
    elements.saveItemButton.textContent = "この商品を保存";
    elements.cancelEditButton.hidden = true;
    renderSavedItems();
  }

  function loadItemForEdit(item) {
    editingId = item.id;
    elements.productNameInput.value = item.productName === "商品名未入力" ? "" : (item.productName || "");
    elements.barcodeInput.value = item.barcode || "";
    elements.purchasePriceInput.value = String(item.purchasePrice ?? "");
    elements.salePriceInput.value = String(item.salePrice ?? "");
    elements.feeRateInput.value = String(item.feeRate ?? 10);
    elements.shippingInput.value = String(item.shipping ?? 0);
    elements.packagingInput.value = String(item.packaging ?? 0);
    elements.otherCostsInput.value = String(item.otherCosts ?? 0);
    elements.saveItemButton.textContent = "変更を保存";
    elements.cancelEditButton.hidden = false;
    updateAll();
    elements.profitForm.closest("section").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("保存データを編集欄に読み込みました");
  }

  function recalculateItem(itemId) {
    const index = savedItems.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const item = savedItems[index];
    const calculation = calculateProfit(item);
    const verdictKey = judgePurchase(calculation, settings);
    savedItems[index] = {
      ...item,
      ...calculation,
      verdict: verdictKey,
      verdictLabel: VERDICTS[verdictKey].label,
      updatedAt: new Date().toISOString(),
    };
    persistItems();
    renderSavedItems();
    showToast("現在の判定基準で再計算しました");
  }

  function deleteItem(itemId) {
    const item = savedItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    if (!window.confirm(`「${item.productName}」を削除しますか？`)) return;
    savedItems = savedItems.filter((candidate) => candidate.id !== itemId);
    persistItems();
    renderSavedItems();
    if (editingId === itemId) resetProductForm();
    showToast("保存データを削除しました");
  }

  function exportCsv() {
    if (savedItems.length === 0) return;
    const headers = [
      "商品名", "JANコード", "仕入価格", "想定売価", "販売手数料率", "販売手数料",
      "送料", "梱包費", "その他経費", "手取り額", "利益", "利益率", "ROI", "判定", "保存日時", "更新日時",
    ];
    const rows = savedItems.map((item) => [
      item.productName,
      item.barcode,
      item.purchasePrice,
      item.salePrice,
      item.feeRate,
      item.fee,
      item.shipping,
      item.packaging,
      item.otherCosts,
      item.net,
      item.profit,
      item.margin === null ? "" : item.margin.toFixed(1),
      item.roi === null ? "" : item.roi.toFixed(1),
      item.verdictLabel,
      item.savedAt,
      item.updatedAt,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `barcode-profit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("CSVを出力しました");
  }

  elements.settingsOpenButton.addEventListener("click", () => toggleSettings(elements.settingsPanel.hidden));
  elements.settingsCloseButton.addEventListener("click", () => toggleSettings(false));
  elements.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!elements.settingsForm.reportValidity()) return;
    settings = normalizeSettings({
      candidateProfit: elements.candidateProfitInput.value,
      candidateRoi: elements.candidateRoiInput.value,
      reviewProfit: elements.reviewProfitInput.value,
    });
    writeJsonStorage(STORAGE_KEYS.settings, settings);
    updateCalculation();
    showToast("判定基準を保存しました");
    toggleSettings(false);
  });
  elements.settingsResetButton.addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    populateSettingsForm();
    writeJsonStorage(STORAGE_KEYS.settings, settings);
    updateCalculation();
    showToast("判定基準を初期値に戻しました");
  });

  elements.startScanButton.addEventListener("click", startScanner);
  elements.stopScanButton.addEventListener("click", () => stopScanner());
  elements.rescanButton.addEventListener("click", rescan);
  elements.barcodeInput.addEventListener("input", () => {
    const normalized = normalizeBarcode(elements.barcodeInput.value);
    if (elements.barcodeInput.value !== normalized) elements.barcodeInput.value = normalized;
    updateSearchLinks();
  });

  elements.searchLinks.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-search]");
    if (link?.getAttribute("aria-disabled") === "true") {
      event.preventDefault();
      showToast("先にバーコードを入力してください");
    }
  });

  elements.profitForm.addEventListener("input", updateCalculation);
  elements.saveItemButton.addEventListener("click", saveCurrentItem);
  elements.cancelEditButton.addEventListener("click", () => {
    resetProductForm();
    showToast("編集をキャンセルしました");
  });
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.savedItemsList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    const card = button?.closest("[data-item-id]");
    if (!button || !card) return;
    const item = savedItems.find((candidate) => candidate.id === card.dataset.itemId);
    if (!item) return;
    if (button.dataset.action === "edit") loadItemForEdit(item);
    if (button.dataset.action === "recalculate") recalculateItem(item.id);
    if (button.dataset.action === "delete") deleteItem(item.id);
  });

  window.addEventListener("pagehide", () => stopScanner("カメラを停止しました"));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && scannerControls) stopScanner("画面を離れたためカメラを停止しました");
  });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEYS.items) {
      const latest = readJsonStorage(STORAGE_KEYS.items, []);
      savedItems = Array.isArray(latest) ? latest : [];
      renderSavedItems();
    }
    if (event.key === STORAGE_KEYS.settings) {
      settings = normalizeSettings(readJsonStorage(STORAGE_KEYS.settings, DEFAULT_SETTINGS));
      populateSettingsForm();
      updateCalculation();
    }
  });

  populateSettingsForm();
  updateAll();
  renderSavedItems();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {
        showToast("オフライン機能を準備できませんでした");
      });
    });
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp, { once: true });
  } else {
    initApp();
  }
}
