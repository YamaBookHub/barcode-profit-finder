# Barcode Profit Finder

iPhone Safariでバーコードを読み取り、仕入価格と想定売価から利益・利益率・ROI・仕入判定を確認する静的PWAです。

## 主な機能

- ZXingによる EAN-13 / EAN-8 / UPC-A / UPC-E / CODE-128 のリアルタイム読取
- 無音のライブ映像解析のみを行い、写真・音声の撮影、保存、送信は行わない設計
- Google、メルカリ、駿河屋、Yahoo!フリマ、Yahoo!オークションの検索画面をバーコード付きで表示
- 販売手数料、手取り額、利益、利益率、ROI、損益分岐売価の自動計算
- 判定基準の変更
- localStorageへの商品保存、編集、削除、再計算、CSV出力
- ダークモード、ホーム画面追加、オフライン用アプリシェル

## ローカルでの確認

カメラAPIはHTTPSまたはlocalhostでのみ利用できます。

```sh
python3 -m http.server 4173
```

ブラウザで `http://localhost:4173/` を開いてください。

## テスト

```sh
npm test
```

## 第三者ライブラリ

`vendor/zxing-browser.min.js` は `@zxing/browser` 0.2.1 と `@zxing/library` 0.23.0 を含む配布バンドルです。ライセンスは `vendor/` 内を参照してください。
