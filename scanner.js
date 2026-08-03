export function normalizeBarcode(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export const CAMERA_CONSTRAINT_ATTEMPTS = Object.freeze([
  Object.freeze({ audio: false, video: Object.freeze({ facingMode: "environment" }) }),
  Object.freeze({ audio: false, video: true }),
]);

const CAMERA_RETRYABLE_ERRORS = new Set([
  "AbortError",
  "ConstraintNotSatisfiedError",
  "OverconstrainedError",
  "TypeError",
  "UnknownError",
]);

export function isStandaloneDisplay(scope = globalThis) {
  return Boolean(
    scope.navigator?.standalone === true
    || scope.matchMedia?.("(display-mode: standalone)")?.matches,
  );
}

export async function requestCameraStream(mediaDevices = globalThis.navigator?.mediaDevices) {
  if (!mediaDevices?.getUserMedia) {
    const error = new Error("getUserMedia is unavailable");
    error.name = "NotSupportedError";
    throw error;
  }

  let lastError;
  for (let index = 0; index < CAMERA_CONSTRAINT_ATTEMPTS.length; index += 1) {
    try {
      return await mediaDevices.getUserMedia(CAMERA_CONSTRAINT_ATTEMPTS[index]);
    } catch (error) {
      lastError = error;
      const canRetry = index < CAMERA_CONSTRAINT_ATTEMPTS.length - 1
        && CAMERA_RETRYABLE_ERRORS.has(error?.name ?? "");
      if (!canRetry) throw error;
    }
  }
  throw lastError;
}

export function cameraErrorMessage(error, manualFallback = "JANコードを手入力してください。", context = {}) {
  const name = error?.name || error?.constructor?.name || "UnknownError";
  const standaloneAdvice = context.standalone
    ? "\nホーム画面版で失敗する場合は、下の「公開URLをコピー」からSafari本体で直接開いてください。"
    : "";
  let message;
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    message = "カメラの利用が許可されていません。\nSafariのアドレスバー左側のメニュー → Webサイトの設定 → カメラ → 許可 に変更して再読み込みしてください。\niPhoneの設定アプリ → アプリ → Safari → カメラ でも確認できます。";
  } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    message = `利用できるカメラが見つかりません。${manualFallback}`;
  } else if (["NotReadableError", "TrackStartError", "TrackEndedError", "AbortError"].includes(name)) {
    message = "カメラ映像が開始直後に停止しました。ほかのカメラアプリを完全に閉じ、Safariを再起動してからお試しください。";
  } else if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    message = "この端末のカメラ設定に対応できませんでした。制約を減らして再試行しましたが開始できませんでした。";
  } else if (name === "NotSupportedError") {
    message = "この画面ではカメラAPIを利用できません。LINE・Googleアプリ等の内蔵ブラウザではなくSafari本体で公開URLを開いてください。";
  } else {
    message = `カメラを開始できませんでした。Safariを再起動するか、${manualFallback}`;
  }
  return `${message}${standaloneAdvice}\nエラー識別：${name}`;
}

export function createBarcodeReader(ZXing = globalThis.ZXingBrowser) {
  if (!ZXing?.BrowserMultiFormatReader || !ZXing?.BarcodeFormat) {
    const error = new Error("ZXing barcode reader is unavailable");
    error.name = "NotSupportedError";
    throw error;
  }

  // @zxing/browser のブラウザ用バンドルは DecodeHintType を公開しないため、
  // 公開APIの possibleFormats setter で対象形式を指定する。
  const reader = new ZXing.BrowserMultiFormatReader(new Map(), {
    delayBetweenScanAttempts: 80,
    delayBetweenScanSuccess: 500,
    tryPlayVideoTimeout: 5000,
  });
  reader.possibleFormats = [
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,
    ZXing.BarcodeFormat.CODE_128,
  ];
  return reader;
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
    this.stream = null;
    this.active = false;
    this.sessionId = 0;
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
    const sessionId = this.sessionId;
    this.onStateChange(true);
    try {
      this.video.autoplay = true;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.setAttribute("autoplay", "");
      this.video.setAttribute("muted", "");
      this.video.setAttribute("playsinline", "");
      this.video.setAttribute("webkit-playsinline", "");

      this.reader = createBarcodeReader(ZXing);

      const stream = await requestCameraStream();
      if (sessionId !== this.sessionId) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack || videoTrack.readyState === "ended") {
        stream.getTracks().forEach((track) => track.stop());
        const error = new Error("Camera track ended before playback");
        error.name = "TrackEndedError";
        throw error;
      }
      this.stream = stream;
      this.active = true;
      videoTrack.addEventListener("ended", () => {
        if (!this.active || sessionId !== this.sessionId) return;
        const error = new Error("Camera track ended during playback");
        error.name = "TrackEndedError";
        this.stop("カメラ映像が停止しました");
        this.onError(cameraErrorMessage(error, undefined, { standalone: isStandaloneDisplay() }));
      }, { once: true });

      this.controls = await this.reader.decodeFromStream(
        stream,
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
      if (sessionId !== this.sessionId) return false;
      this.onStatus("読取中です。バーコードを枠内に合わせてください");
      return true;
    } catch (error) {
      if (sessionId !== this.sessionId) return false;
      this.stop("カメラを開始できませんでした");
      this.onError(cameraErrorMessage(error, undefined, { standalone: isStandaloneDisplay() }));
      return false;
    }
  }

  stop(status = "カメラを停止しました") {
    this.active = false;
    this.sessionId += 1;
    try { this.controls?.stop(); } catch { /* すでに停止済み */ }
    this.controls = null;
    if (this.stream?.getTracks) this.stream.getTracks().forEach((track) => track.stop());
    this.stream = null;
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
    // OCRが「1 980」のように千区切りを空白で返した場合だけ連結する。
    // 単純に全数字間の空白を消すと「3980 50%」が398050になるため避ける。
    .replace(/(\d)\s+(?=\d{3}(?:\D|$))/g, "$1");
}

export function extractPriceCandidates(text, limit = 6, { deduplicate = true, requireCurrency = false } = {}) {
  const normalized = normalizeOcrText(text);
  const matches = normalized.match(/[¥￥]?\s*\d[\d,.]{1,10}\s*円?/g) ?? [];
  const ranked = [];
  const seen = new Set();

  matches.forEach((match, index) => {
    if (requireCurrency && !/[¥￥円]/.test(match)) return;
    const digits = match.replace(/[^\d]/g, "");
    if (digits.length < 2 || digits.length > 8) return;
    const value = Number(digits);
    if (!Number.isFinite(value) || value < 10 || value > 99_999_999) return;
    if (deduplicate && seen.has(value)) return;
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

function preprocessImageSource(source, canvas) {
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  if (!sourceWidth || !sourceHeight) throw new Error("画像を読み込めませんでした。");
  const scale = Math.min(1, 1800 / sourceWidth, 2200 / sourceHeight);
  const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
  const outputHeight = Math.max(1, Math.round(sourceHeight * scale));
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(source, 0, 0, outputWidth, outputHeight);
  const image = context.getImageData(0, 0, outputWidth, outputHeight);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
    image.data[index] = contrasted;
    image.data[index + 1] = contrasted;
    image.data[index + 2] = contrasted;
  }
  context.putImageData(image, 0, 0);
}

async function loadImageFile(file) {
  if (globalThis.createImageBitmap) return createImageBitmap(file);
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error("画像を読み込めませんでした。");
  }
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
      const stream = await requestCameraStream();
      this.video.srcObject = stream;
      this.video.autoplay = true;
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.setAttribute("autoplay", "");
      this.video.setAttribute("muted", "");
      this.video.setAttribute("playsinline", "");
      this.video.setAttribute("webkit-playsinline", "");
      await this.video.play();
      this.onStatus("値段が中央の枠に大きく入るように合わせてください");
      return true;
    } catch (error) {
      this.stop("値札カメラを開始できませんでした");
      this.onError(cameraErrorMessage(error, "仕入価格を手入力してください。", { standalone: isStandaloneDisplay() }));
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
      return await this.recognizeCanvas({ pageSegMode: "6", deduplicate: true });
    } catch (error) {
      this.onError(error?.message || "値札を読み取れませんでした。仕入価格を手入力してください。");
      return { candidates: [], text: "" };
    }
  }

  async recognizeImage(file) {
    this.onError("");
    let source;
    try {
      source = await loadImageFile(file);
      preprocessImageSource(source, this.canvas);
      return await this.recognizeCanvas({ pageSegMode: "11", deduplicate: false, limit: 5, requireCurrency: true });
    } catch (error) {
      this.onError(error?.message || "相場画像を読み取れませんでした。別の画像を選ぶか、価格を手入力してください。");
      return { candidates: [], text: "" };
    } finally {
      if (typeof source?.close === "function") source.close();
      if (source instanceof HTMLImageElement && source.src.startsWith("blob:")) URL.revokeObjectURL(source.src);
    }
  }

  async recognizeCanvas({ pageSegMode = "6", deduplicate = true, limit = 6, requireCurrency = false } = {}) {
    try {
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
          preserve_interword_spaces: "1",
        });
      }
      await this.worker.setParameters({ tessedit_pageseg_mode: pageSegMode });
      const result = await this.worker.recognize(this.canvas);
      const candidates = extractPriceCandidates(result?.data?.text, limit, { deduplicate, requireCurrency });
      this.onProgress(1, "読取完了");
      return { candidates, text: result?.data?.text ?? "" };
    } catch (error) {
      this.onError(error?.message || "画像から価格を読み取れませんでした。");
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
