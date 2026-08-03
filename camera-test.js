import { CAMERA_CONSTRAINT_ATTEMPTS, isStandaloneDisplay } from "./scanner.js?v=11";

const video = document.getElementById("diagnosticVideo");
const runButton = document.getElementById("runDiagnosticButton");
const stopButton = document.getElementById("stopDiagnosticButton");
const copyButton = document.getElementById("copyDiagnosticButton");
const status = document.getElementById("diagnosticStatus");
const result = document.getElementById("diagnosticResult");

let stream = null;
let lines = [];

function addLine(label, value) {
  lines.push(`${label}: ${String(value)}`);
  result.textContent = lines.join("\n");
}

function errorName(error) {
  return error?.name || error?.constructor?.name || "UnknownError";
}

function stopCamera(message = "カメラを停止しました。") {
  const activeStream = stream;
  stream = null;
  activeStream?.getTracks?.().forEach((track) => track.stop());
  video.srcObject = null;
  stopButton.disabled = true;
  runButton.disabled = false;
  status.textContent = message;
}

function waitForVideoPlayback(timeoutMs = 6000) {
  return Promise.race([
    video.play(),
    new Promise((_, reject) => {
      window.setTimeout(() => {
        const error = new Error("video.play timeout");
        error.name = "VideoPlaybackTimeout";
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

async function readPermissionState() {
  if (!navigator.permissions?.query) return "Permissions API非対応";
  try {
    const permission = await navigator.permissions.query({ name: "camera" });
    return permission.state;
  } catch {
    return "Safariでは取得不可";
  }
}

async function runDiagnostic() {
  stopCamera("診断を準備しています…");
  lines = [];
  result.textContent = "";
  runButton.disabled = true;
  copyButton.disabled = true;
  status.textContent = "端末とカメラAPIを確認しています…";

  addLine("診断バージョン", "v11");
  addLine("日時", new Date().toISOString());
  addLine("HTTPS", globalThis.isSecureContext);
  addLine("ホーム画面版", isStandaloneDisplay());
  addLine("User Agent", navigator.userAgent);
  addLine("mediaDevices", Boolean(navigator.mediaDevices));
  addLine("getUserMedia", Boolean(navigator.mediaDevices?.getUserMedia));
  addLine("カメラ権限状態", await readPermissionState());

  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    addLine("最終結果", "カメラAPIを利用できません");
    status.textContent = "Safari本体のHTTPSページで開いてください。";
    copyButton.disabled = false;
    runButton.disabled = false;
    return;
  }

  for (let index = 0; index < CAMERA_CONSTRAINT_ATTEMPTS.length; index += 1) {
    const attemptNumber = index + 1;
    const constraints = CAMERA_CONSTRAINT_ATTEMPTS[index];
    addLine(`試行${attemptNumber}`, JSON.stringify(constraints));
    status.textContent = `カメラ起動を試しています（${attemptNumber}/${CAMERA_CONSTRAINT_ATTEMPTS.length}）…`;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      addLine(`試行${attemptNumber} getUserMedia`, "成功");
      break;
    } catch (error) {
      addLine(`試行${attemptNumber} エラー`, `${errorName(error)} / ${error?.message || "詳細なし"}`);
      if (["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(errorName(error))) break;
    }
  }

  if (!stream) {
    addLine("最終結果", "getUserMedia失敗");
    status.textContent = "カメラ権限またはSafariのカメラ起動で失敗しました。";
    copyButton.disabled = false;
    runButton.disabled = false;
    return;
  }

  const track = stream.getVideoTracks()[0];
  addLine("映像トラック", track ? `${track.readyState} / ${track.label || "名称非公開"}` : "なし");
  if (track) {
    track.addEventListener("ended", () => {
      if (!stream || stream.getVideoTracks()[0] !== track) return;
      addLine("トラック終了", "getUserMedia成功後にendedイベント発生");
      addLine("最終結果", "MediaStreamTrack ended");
      stopCamera("映像トラックが開始後に終了しました。Safari本体または再起動をお試しください。");
      copyButton.disabled = false;
    }, { once: true });
  }

  video.srcObject = stream;
  try {
    await waitForVideoPlayback();
    const settings = track?.getSettings?.() ?? {};
    addLine("video.play", "成功");
    addLine("映像サイズ", `${video.videoWidth || settings.width || 0}×${video.videoHeight || settings.height || 0}`);
    addLine("カメラ向き", settings.facingMode || "取得不可");
    addLine("最終結果", "カメラ起動成功");
    status.textContent = "カメラ映像を開始できました。利益チェッカーへ戻ってください。";
    stopButton.disabled = false;
  } catch (error) {
    addLine("video.play エラー", `${errorName(error)} / ${error?.message || "詳細なし"}`);
    addLine("最終結果", "映像再生失敗");
    stopCamera("カメラ取得後の映像再生で失敗しました。Safariを再起動してください。");
  }
  copyButton.disabled = false;
  runButton.disabled = false;
}

async function copyResult() {
  const text = lines.join("\n");
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "診断結果をコピーしました。この内容をそのまま送ってください。";
  } catch {
    window.prompt("診断結果をコピーしてください。", text);
  }
}

runButton.addEventListener("click", runDiagnostic);
stopButton.addEventListener("click", () => stopCamera());
copyButton.addEventListener("click", copyResult);
window.addEventListener("pagehide", () => stopCamera());
