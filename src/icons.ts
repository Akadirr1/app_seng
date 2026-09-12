/**
 * Pixel icon paths, ported verbatim from the design canvas.
 *
 * Every path is drawn on an 8×8 grid so the shapes stay on whole pixels at any
 * render size — that is what gives the icons their blocky look.
 */
export const ICON = {
  gift: 'M1 2h6v1h-6z M2 3h4v5h-4z M3 0h1v2h-1z M4 1h1v1h-1z M0 2h1v1h-1z',
  star: 'M3 0h2v2h-2z M0 2h8v2h-8z M2 4h4v2h-4z M1 6h2v2h-2z M5 6h2v2h-2z',
  clock: 'M2 0h4v1h-4z M0 2h1v4h-1z M7 2h1v4h-1z M2 7h4v1h-4z M3 2h1v3h-1z M4 4h1v1h-1z',
  cal: 'M1 1h6v1h-6z M0 2h8v6h-8z M2 0h1v2h-1z M5 0h1v2h-1z',
  pin: 'M3 0h2v1h-2z M2 1h4v3h-4z M3 4h2v2h-2z M3 6h2v2h-2z',
  home: 'M3 0h2v1h-2z M1 1h6v1h-6z M0 2h8v1h-8z M1 3h6v5h-6z',
  grid: 'M0 0h3v3h-3z M5 0h3v3h-3z M0 5h3v3h-3z M5 5h3v3h-3z',
  bell: 'M3 0h2v1h-2z M2 1h4v4h-4z M1 5h6v1h-6z M3 6h2v1h-2z',
  chat: 'M0 0h8v5h-8z M1 5h2v2h-2z',
  lines: 'M0 0h8v2h-8z M0 3h6v2h-6z M0 6h4v2h-4z',
  code: 'M2 1h1v1h-1z M1 2h1v2h-1z M2 4h1v1h-1z M5 1h1v1h-1z M6 2h1v2h-1z M5 4h1v1h-1z',
  // Büyüteç: 3x3 halka artı sağ alta inen sap. Sekme başlığındaki arama düğmesi.
  search: 'M2 1h2v1h-2z M1 2h1v2h-1z M4 2h1v2h-1z M2 4h2v1h-2z M5 5h1v1h-1z M6 6h2v2h-2z',
  check:
    'M6 1h2v1h-2z M5 2h1v1h-1z M4 3h1v1h-1z M3 4h1v1h-1z M2 5h1v1h-1z M1 4h1v1h-1z M0 3h1v1h-1z M1 5h1v1h-1z',
  // Figür: baş, bir boşluk satırı, tam genişlikte omuz, iki yanda inen kol ve
  // ortada gövde. Hesap sekmesinin ikonu — sette kişiyi anlatan başka bir glif
  // yoktu ve `bell` artık bildirim ayarlarına ait.
  //
  // İki kullanıcı bildirimi bu çizimi belirledi, ikisi de aynı sebeple:
  //
  // **Boyun çizilmiyor.** İlk hâlde baş ile omuz arasında iki piksellik bir
  // boyun vardı; sekiz pikselde o dar öğe, altındaki geniş kütleyle birleşince
  // istenmeyen bir siluet okutuyordu. İki geniş parça arasında dar bir öğe yok
  // artık: baş, boş satır, omuz.
  //
  // **Gövde tek parça bir kütle değil.** Boyun kalkınca alt üç satır 8×3'lük
  // dolu bir dikdörtgene indi ve bu sefer "kolu yok" diye bildirildi — dolu bir
  // blokta anatomi okunmuyor. Kollar birer piksel genişliğinde, gövdeden birer
  // piksellik boşlukla ayrılmış ve gövdeden bir satır önce bitiyor: bitmeseler
  // üç paralel çubuk olurlardı, kol değil.
  //
  // Bu ızgarayı gözle değerlendirmenin tek yolu onu basmak — yolu okuyarak
  // tahmin etmek burada iki kez yanlış çıktı.
  user: 'M2 0h4v3h-4z M0 4h8v1h-8z M0 5h1v2h-1z M2 5h4v3h-4z M7 5h1v2h-1z',
} as const;

export type IconName = keyof typeof ICON;

/** A single-colour layer of a multi-colour pixel illustration. */
export type PixelArtLayer = { fill: string; d: string };

/**
 * Onboarding illustrations for pages 2 and 3. Drawn on a 22×17 grid — wider than
 * the icons because they are scene art rather than glyphs.
 */
export const ONBOARDING_ART: Record<'form' | 'bell', PixelArtLayer[]> = {
  form: [
    { fill: '#D2E7EC', d: 'M4 1h14v15h-14z' },
    { fill: '#0389BC', d: 'M6 3h10v2h-10z M6 7h10v1h-10z M6 10h10v1h-10z' },
    { fill: '#001B4A', d: 'M6 13h6v2h-6z' },
    { fill: '#93CBDC', d: 'M0 8h2v2h-2z M2 10h2v2h-2z' },
  ],
  bell: [
    { fill: '#93CBDC', d: 'M9 1h4v1h-4z M7 2h8v9h-8z M5 11h12v2h-12z M9 13h4v2h-4z' },
    { fill: '#0389BC', d: 'M8 3h6v7h-6z' },
    { fill: '#D2E7EC', d: 'M17 2h2v2h-2z M19 0h2v2h-2z' },
  ],
};

export const PIXEL_ART_VIEWBOX = '0 0 22 17';
