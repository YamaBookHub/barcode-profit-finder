export function normalizeBarcode(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function cameraErrorMessage(error, manualFallback = "JANコードを手入力してください。") {
  const name = error?.name ?? "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "カメラの利用が許可されていません。\nSafariのアドレスバー左側のメニュー → Webサイトの設定 → カメラ → 許可 に変更して再読み込みしてください。\niPhoneの設定アプリ → アプリ → Safari → カメラ でも確認できます。";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return `利用できるカメラが見つかりません。${manualFallback}`;
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "カメラを開始できませんでした。他のカメラアプリを閉じてから、もう一度お試しください。";
  }
  if (name === "OverconstrainedError") {
    return "この端末のカメラ設定に対応できませんでした。ページを再読み込みして、もう一度お試しください。";
  }
  return `カメラを開始できませんでした。Safariを再読み込みするか、${manualFallback}`;
}

export class DuplicateGuard {
  constructor(windowMs = 3000) {
    this.windowMs = windowMs;
    this.lastCode = "";
    this.lastSeenAt = 0;
  }

  isDuplicate(code, now = Date.now()) {
    const duplicate = code === this.lastCode && now - this.lastSeenAt < this.windowMs;
    if (!duplicate) {
      this.lastCode = code;
      this.lastSeenAt = now;
    }
    return duplicate;
  }

  reset() {
    this.lastCode = "";
    this.lastSeenAt = 0;
  }
}

function stopMedia(video) {
  const stream = video?.srcObject;
  if (stream?.getTracks) stream.getTracks().forEach((track) => track.stop());
  if (video) video.srcObject = null;
}

export class BarcodeScanner {
  constructor({ video, onStatus, onError, onSuccess, onStateChange } = {}) {
    this.video = video;
    this.onStatus = onStatus ?? (() => {});
    this.onError = onError ?? (() => {});
    this.onSuccess = onSuccess ?? (() => {});
    this.onStateChange = onStateChange ?? (() => {});
    this.controls = null;
    this.reader = null;
    this.guard = new DuplicateGuard(3000);
  }

  async start() {
    this.onError("");
    if (!globalThis.isSecureContext) {
      this.onError("カメラはHTTPSのページでのみ利用できます。公開URL（https://）から開くか、JANコードを手入力してください。");
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.onError("このブラウザはカメラ読取に対応していません。最新のSafariで開くか、JANコードを手入力してください。");
      return false;
    }

    const ZXing = globalThis.ZXingBrowser;
    if (!ZXing?.BrowserMultiFormatReader) {
      this.onError("バーコード読取機能を読み込めませんでした。通信状態を確認してページを再読み込みしてください。");
      return false;
    }

    this.stop("カメラを準備しています…");
    this.onStateChange(true);
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
      this.reader = new ZXing.BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 80,
        delayBetweenScanSuccess: 500,
        tryPlayVideoTimeout: 5000,
      });

      this.controls = await this.reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        this.video,
        (result, error, controls) => {
          if (result) {
            const raw = typeof result.getText === "function" ? result.getText() : result.text;
            const code = normalizeBarcode(raw);
            if (!code || this.guard.isDuplicate(code)) return;
            try { controls?.stop(); } catch { /* すでに停止済み */ }
            this.stop(`読取完了：${code}`);
            if (navigator.vibrate) navigator.vibrate(100);
            this.onSuccess(code);
            return;
          }
          const errorName = error?.name ?? error?.constructor?.name;
          if (error && !["NotFoundException", "ChecksumException", "FormatException"].includes(errorName)) {
            this.onError("読み取りにくい状態です。明るい場所でバーコード全体を枠内に入れてください。");
          }
        },
      );
      this.onStatus("読取中です。バーコードを枠内に合わせてください");
      return true;
    } catch (error) {
      this.stop("カメラを開始できませんでした");
      this.onError(cameraErrorMessage(error));
      return false;
    }
  }

  stop(status = "カメラを停止しました") {
    try { this.controls?.stop(); } catch { /* すでに停止済み */ }
    this.controls = null;
    stopMedia(this.video);
    this.onStateChange(false);
    this.onStatus(status);
  }

  allowImmediateRescan() {
    this.guard.reset();
  }
}

function normalizeOcrText(text) {
  return String(text ?? "")
    .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
    .replaceAll("，", ",")
    .replaceAll("．", ".")
    .replace(/(\d)\s+(?=\d)/g, "$1");
}

export function extractPriceCandidates(text, limit = 6) {
  const normalized = normalizeOcrText(text);
  const matches = normalized.match(/[¥￥]?\s*\d[\d,.]{1,10}\s*円?/g) ?? [];
  const ranked = [];
  const seen = new Set();

  matches.forEach((match, index) => {
    const digits = match.replace(/[^\d]/g, "");
    if (digits.length < 2 || digits.length > 8) return;
    const value = Number(digits);
    if (!Number.isFinite(value) || value < 10 || value > 99_999_999 || seen.has(value)) return;
    seen.add(value);
    let score = 0;
    if (/[¥￥円]/.test(match)) score += 4;
    if (/[,，.．]/.test(match)) score += 2;
    if (digits.length >= 3 && digits.length <= 6) score += 1;
    if (/(00|50|80|90)$/.test(digits)) score += 1;
    ranked.push({ value, score, index });
  });

  return ranked
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ value }) => value);
}

function preprocessFrame(video, canvas) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("カメラ映像の準備ができていません。");

  const cropX = Math.floor(sourceWidth * 0.04);
  const cropY = Math.floor(sourceHeight * 0.18);
  const cropWidth = Math.floor(sourceWidth * 0.92);
  const cropHeight = Math.floor(sourceHeight * 0.64);
  const outputWidth = Math.min(1280, cropWidth);
  const outputHeight = Math.max(1, Math.round((cropHeight / cropWidth) * outputWidth));
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, outputWidth, outputHeight);

  const image = context.getImageData(0, 0, outputWidth, outputHeight);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.55 + 128));
    image.data[index] = contrasted;
    image.data[index + 1] = contrasted;
    image.data[index + 2] = contrasted;
  }
  context.putImageData(image, 0, 0);
}

function loadTesseractScript() {
  if (globalThis.Tesseract?.createWorker) return Promise.resolve(globalThis.Tesseract);
  const existing = document.querySelector('script[data-tesseract-loader="true"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(globalThis.Tesseract), { once: true });
      existing.addEventListener("error", () => reject(new Error("OCR機能を読み込めませんでした。")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./vendor/tesseract.min.js";
    script.dataset.tesseractLoader = "true";
    script.onload = () => resolve(globalThis.Tesseract);
    script.onerror = () => reject(new Error("OCR機能を読み込めませんでした。"));
    document.head.append(script);
  });
}

export class PriceTagScanner {
  constructor({ video, canvas, onStatus, onError, onStateChange, onProgress } = {}) {
    this.video = video;
    this.canvas = canvas;
    this.onStatus = onStatus ?? (() => {});
    this.onError = onError ?? (() => {});
    this.onStateChange = onStateChange ?? (() => {});
    this.onProgress = onProgress ?? (() => {});
    this.worker = null;
  }

  async start() {
    this.onError("");
    if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      this.onError("値札読取にはHTTPSとカメラ対応ブラウザが必要です。仕入価格は手入力できます。");
      return false;
    }
    this.stop("値札カメラを準備しています…");
    this.onStateChange(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      this.video.srcObject = stream;
      this.video.muted = true;
      this.video.setAttribute("playsinline", "");
      await this.video.play();
      this.onStatus("値段が中央の枠に大きく入るように合わせてください");
      return true;
    } catch (error) {
      this.stop("値札カメラを開始できませんでした");
      this.onError(cameraErrorMessage(error, "仕入価格を手入力してください。"));
      return false;
    }
  }

  stop(status = "値札カメラを停止しました") {
    stopMedia(this.video);
    this.onStateChange(false);
    this.onStatus(status);
  }

  async recognize() {
    this.onError("");
    try {
      preprocessFrame(this.video, this.canvas);
      this.stop("画像を端末内で解析しています…");
      this.onProgress(0.02, "OCRを準備しています");
      const Tesseract = await loadTesseractScript();
      if (!this.worker) {
        const workerPath = new URL("./vendor/tesseract-worker.min.js", document.baseURI).href;
        this.worker = await Tesseract.createWorker("eng", 1, {
          workerPath,
          logger: (message) => {
            if (typeof message.progress === "number") this.onProgress(message.progress, "文字を読み取っています");
          },
        });
        await this.worker.setParameters({
          tessedit_char_whitelist: "0123456789,.¥￥円",
          tessedit_pageseg_mode: "6",
          preserve_interword_spaces: "1",
        });
      }
      const result = await this.worker.recognize(this.canvas);
      const candidates = extractPriceCandidates(result?.data?.text);
      this.onProgress(1, "読取完了");
      return { candidates, text: result?.data?.text ?? "" };
    } catch (error) {
      this.onError(error?.message || "値札を読み取れませんでした。仕入価格を手入力してください。");
      return { candidates: [], text: "" };
    }
  }

  clearFrame() {
    const context = this.canvas.getContext("2d");
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.canvas.width = 1;
    this.canvas.height = 1;
  }

  async terminate() {
    this.stop();
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    this.clearFrame();
  }
}
