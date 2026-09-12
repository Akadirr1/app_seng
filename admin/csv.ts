/**
 * CSV hücresi — RFC 4180 tırnaklama **ve** formül etkisizleştirme.
 *
 * Tırnaklama tek başına yetmiyor: Excel ve LibreOffice `=`, `+`, `-`, `@` ile
 * başlayan bir hücreyi tırnak içinde de formül sayıyor. `name` alanını öğrenci
 * yazıyor ve kural yalnızca uzunluğa bakıyor — `=HYPERLINK("http://…")` ya da
 * `-2+3+cmd|' /C calc'!A0` geçerli bir ad. Dosyayı açan kulüp yöneticisinin
 * makinesinde çalışır. Başa tek tırnak koymak hücreyi metne çeviriyor; Excel
 * tırnağı göstermiyor.
 *
 * Üç CSV yazıcısı (panelde iki, `npm run export`) bunu paylaşıyor. Aynı
 * fonksiyonun üç kopyası, bu düzeltmeyi ikisinde unutmanın yoluydu.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
