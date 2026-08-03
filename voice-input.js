const KANJI_DIGITS = Object.freeze({
  零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
});
const SMALL_UNITS = Object.freeze({ 十: 10, 百: 100, 千: 1000 });
const LARGE_UNITS = Object.freeze({ 万: 10_000, 億: 100_000_000 });

function kanjiNumber(value) {
  const chars = [...value].filter((char) => char in KANJI_DIGITS || char in SMALL_UNITS || char in LARGE_UNITS);
  if (!chars.length) return null;
  const hasUnit = chars.some((char) => char in SMALL_UNITS || char in LARGE_UNITS);
  if (!hasUnit) return Number(chars.map((char) => KANJI_DIGITS[char]).join(""));

  let total = 0;
  let section = 0;
  let digit = 0;
  chars.forEach((char) => {
    if (char in KANJI_DIGITS) {
      digit = KANJI_DIGITS[char];
    } else if (char in SMALL_UNITS) {
      section += (digit || 1) * SMALL_UNITS[char];
      digit = 0;
    } else if (char in LARGE_UNITS) {
      section += digit;
      total += (section || 1) * LARGE_UNITS[char];
      section = 0;
      digit = 0;
    }
  });
  return total + section + digit;
}

export function parseSpokenNumber(transcript, { allowDecimal = false } = {}) {
  const normalized = String(transcript ?? "")
    .normalize("NFKC")
    .replace(/[,_，\s]/g, "")
    .replace(/税込|税抜|価格|金額|円|パーセント|%/g, "");
  const numeric = normalized.match(/\d+(?:\.\d+)?/);
  let value = numeric ? Number(numeric[0]) : kanjiNumber(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  if (!allowDecimal) value = Math.round(value);
  return String(value);
}

export function speechRecognitionConstructor(scope = globalThis) {
  return scope?.SpeechRecognition || scope?.webkitSpeechRecognition || null;
}

export function speechErrorMessage(errorCode) {
  const messages = {
    "not-allowed": "音声入力を使うには、SafariのWebサイト設定でマイクを許可してください。",
    "service-not-allowed": "この端末では音声認識が許可されていません。iPhoneの設定を確認してください。",
    "audio-capture": "マイクを利用できません。ほかの録音アプリを閉じて再試行してください。",
    "no-speech": "音声を聞き取れませんでした。マイクに近づいてもう一度お試しください。",
    network: "音声認識の通信に失敗しました。通信状態を確認してください。",
  };
  return messages[errorCode] || `音声入力に失敗しました（${errorCode || "不明なエラー"}）。`;
}
