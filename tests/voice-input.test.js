import test from "node:test";
import assert from "node:assert/strict";

import { parseSpokenNumber, speechErrorMessage, speechRecognitionConstructor } from "../voice-input.js";

test("読み上げた金額を数字へ変換する", () => {
  assert.equal(parseSpokenNumber("1,980円"), "1980");
  assert.equal(parseSpokenNumber("三千九百八十円"), "3980");
  assert.equal(parseSpokenNumber("一万二千三百四十五円"), "12345");
  assert.equal(parseSpokenNumber("10.5パーセント", { allowDecimal: true }), "10.5");
  assert.equal(parseSpokenNumber("価格は不明"), null);
});

test("Safariの音声認識とマイク拒否メッセージに対応する", () => {
  function WebkitRecognition() {}
  assert.equal(speechRecognitionConstructor({ webkitSpeechRecognition: WebkitRecognition }), WebkitRecognition);
  assert.match(speechErrorMessage("not-allowed"), /マイクを許可/);
});
