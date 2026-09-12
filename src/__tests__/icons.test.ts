import { ICON } from '../icons';

/**
 * Bir glifin satır genişlikleri — 8×8 ızgarada her satırda kaç piksel dolu.
 *
 * Yollar `Mx yhWvHh-Wz` biçiminde dikdörtgenler; her biri bir alanı dolduruyor.
 */
function rowWidths(path: string, size = 8): number[] {
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  for (const m of path.matchAll(/M(-?\d+) (-?\d+)h(-?\d+)v(-?\d+)h(-?\d+)z/g)) {
    const [x, y, w, h] = [+m[1], +m[2], +m[3], +m[4]];
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        if (grid[yy]?.[xx] !== undefined) grid[yy][xx] = true;
      }
    }
  }
  return grid.map((row) => row.filter(Boolean).length);
}

/**
 * Her satırda kaç **ayrı** dolu parça var — `█ . ████ . █` üç, `████████` bir.
 *
 * Genişlik tek başına anatomiyi göremiyor: dolu bir dikdörtgen de, kolları
 * ayrılmış bir gövde de aynı genişliği verebiliyor.
 */
function rowRuns(path: string, size = 8): number[] {
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  for (const m of path.matchAll(/M(-?\d+) (-?\d+)h(-?\d+)v(-?\d+)h(-?\d+)z/g)) {
    const [x, y, w, h] = [+m[1], +m[2], +m[3], +m[4]];
    for (let yy = y; yy < y + h; yy += 1) {
      for (let xx = x; xx < x + w; xx += 1) {
        if (grid[yy]?.[xx] !== undefined) grid[yy][xx] = true;
      }
    }
  }
  return grid.map((row) => row.filter((dolu, i) => dolu && !row[i - 1]).length);
}

describe('ICON yolları', () => {
  it('her glif en az bir piksel çiziyor', () => {
    for (const [ad, path] of Object.entries(ICON)) {
      expect(rowWidths(path).some((w) => w > 0)).toBe(true);
      expect(path.length).toBeGreaterThan(0);
      // Ayrıştırılamayan bir yol sessizce boş çizer; yukarıdaki iddia onu
      // yakalıyor ama sebebini söylemiyor, o yüzden biçim de sınanıyor.
      expect(path).toMatch(/^M-?\d+ -?\d+h/);
    }
  });

  /**
   * Hesap ikonunda **boğumlanma olmamalı**: iki geniş satır arasında kalan
   * dar bir dolu satır.
   *
   * Bu iddia bir kullanıcı bildirimi üzerine yazıldı. İlk çizimde baş ile
   * omuz arasında iki piksellik bir "boyun" vardı ve sekiz pikselde o şekil,
   * altındaki geniş kütleyle birlikte istenmeyen bir siluet okutuyordu.
   * Boyun yerine boş bir satır kondu — boş satır bu kuralı bozmuyor, çünkü
   * kural yalnızca **dolu** satırlara bakıyor.
   */
  it('user gliflinde iki geniş satır arasında dar satır yok', () => {
    const w = rowWidths(ICON.user);
    const bogumlar = w
      .map((genislik, i) => ({ i, genislik }))
      .filter(({ i, genislik }) => {
        if (genislik === 0) return false;
        const ust = w[i - 1] ?? 0;
        const alt = w[i + 1] ?? 0;
        return genislik < ust && genislik < alt;
      });
    expect(bogumlar).toEqual([]);
  });

  /**
   * Gövdede kollar **ayrı** duruyor: en az bir satır kol · gövde · kol diye üç
   * parçaya bölünmüş olmalı.
   *
   * Bu da bir kullanıcı bildirimi: boyun kalkınca alt üç satır dolu bir
   * dikdörtgene indi ve figür "kolsuz" göründü. Satır genişliği bunu göremiyor
   * — 8 genişliğindeki dolu bir satırla, kolları ayrılmış 6 piksellik bir satır
   * genişlik kuralının ikisini de geçiyor.
   */
  it('user glifinde kollar gövdeden ayrı', () => {
    const runs = rowRuns(ICON.user);
    expect(Math.max(...runs)).toBeGreaterThanOrEqual(3);
  });

  it('user glifi baş ve gövdeyi boş satırla ayırıyor', () => {
    const w = rowWidths(ICON.user);
    // Baş üstte, gövde altta, arada en az bir boş satır: ikisinin birbirine
    // değdiği her çizim bir boyun üretiyor.
    const bosIndex = w.findIndex((genislik, i) => genislik === 0 && i > 0 && i < w.length - 1);
    expect(bosIndex).toBeGreaterThan(0);
    expect(w.slice(0, bosIndex).every((genislik) => genislik > 0)).toBe(true);
    expect(w.slice(bosIndex + 1).every((genislik) => genislik > 0)).toBe(true);
  });
});
