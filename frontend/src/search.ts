// 英字だけを大小文字に関係なく比較し、他の文字はそのまま扱う。
function foldAscii(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

export function matchesTitle(title: string, query: string): boolean {
  return foldAscii(title).includes(foldAscii(query.trim()));
}
