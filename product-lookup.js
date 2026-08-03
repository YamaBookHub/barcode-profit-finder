export function isBookIsbn(value) {
  return /^(978|979)\d{10}$/.test(String(value ?? "").trim());
}

export async function lookupBookByIsbn(isbn, { fetchImpl = globalThis.fetch, signal } = {}) {
  const normalized = String(isbn ?? "").trim();
  if (!isBookIsbn(normalized)) return null;
  if (typeof fetchImpl !== "function") throw new Error("商品情報の取得機能を利用できません");

  const response = await fetchImpl(`https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(normalized)}`, {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) throw new Error(`商品情報を取得できませんでした（${response.status}）`);

  const [book] = await response.json();
  const summary = book?.summary;
  const title = String(summary?.title ?? "").trim();
  if (!title) return null;
  const series = String(summary?.series ?? "").trim();
  return {
    title: series && !title.includes(series) ? `${series} ${title}` : title,
    publisher: String(summary?.publisher ?? "").trim(),
    isbn: normalized,
  };
}
