/**
 * `npm run sertifika:onizle`
 *
 * Sertifikanın üç varyantını HTML olarak yazar ve fontları yanına kopyalar.
 * Tarayıcıda aç, Cmd/Ctrl+P ile PDF'e bas — A4 yatay, kenar boşluğu yok.
 *
 * Var olma sebebi bu deponun kendi dersi: **bir tasarımı kaynağını okuyarak
 * değerlendirmek bir kez yanlış çıktı** (hesap ikonu maddesi). Sertifika da
 * aynı sınıf: uzun bir adın çerçeveyi taşırdığını ancak basınca görüyorsunuz,
 * ve taşan sertifika geri alınamıyor — dışarıda, birinin elinde.
 *
 * Varyantlar rastgele değil, ÖLÇÜLECEK üç sınır:
 *   normal  — tipik ad, tek satır
 *   uzun    — 21 karakter, hâlâ tam punto ve tek satır
 *   uzun2   — 34 karakter, bir kademe inik ve iki satır
 *   cokuzun — 40+ karakter, iki kademe inik
 */
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import QRCode from 'qrcode';

import { certificateHtml } from '../admin/certificate';

const CIKTI = process.env.SERT_OUT ?? join(process.cwd(), 'sertifika-onizleme');

/** Marka fontları — uygulamanın kullandığı dosyaların ta kendisi. */
const FONTLAR = [
  '@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf',
  '@expo-google-fonts/plus-jakarta-sans/600SemiBold/PlusJakartaSans_600SemiBold.ttf',
  '@expo-google-fonts/plus-jakarta-sans/800ExtraBold/PlusJakartaSans_800ExtraBold.ttf',
  '@expo-google-fonts/press-start-2p/400Regular/PressStart2P_400Regular.ttf',
];

const ORNEKLER: Record<string, { adSoyad: string; etkinlik: string }> = {
  normal: { adSoyad: 'Abdülkadir İvenç', etkinlik: 'Yapay Zekâ Atölyesi' },
  uzun: {
    adSoyad: 'Ayşegül Nur Şahinoğlu',
    etkinlik: 'React Native ile Mobil Uygulama Geliştirme Kampı',
  },
  uzun2: { adSoyad: 'Muhammed Emin Küçükçelebi Oğulları', etkinlik: 'Git ve GitHub Atölyesi' },
  cokuzun: {
    adSoyad: 'Muhammed Emin Küçükçelebioğulları Yıldırım',
    etkinlik: 'Siber Güvenlik ve Sızma Testleri Eğitim Programı',
  },
};

void (async () => {
  mkdirSync(join(CIKTI, 'fonts'), { recursive: true });
  for (const f of FONTLAR) {
    const ad = f.split('/').pop()!;
    copyFileSync(join('node_modules', f), join(CIKTI, 'fonts', ad));
  }

  const qr = await QRCode.toString('https://mobil.kouseng.com/sertifika/K7M2QX9R', {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
    color: { dark: '#001B4A', light: '#0000' },
  });

  for (const [ad, veri] of Object.entries(ORNEKLER)) {
    const dosya = join(CIKTI, `${ad}.html`);
    writeFileSync(
      dosya,
      certificateHtml({
        ...veri,
        tarih: '12 Mart 2026',
        belgeNo: 'K7M2QX9R',
        dogrulamaUrl: 'mobil.kouseng.com/sertifika/K7M2QX9R',
        fontBase: './fonts',
        qrSvg: qr,
      }),
    );
    console.log(`✓ ${dosya}`);
  }

  console.log('\nTarayıcıda aç ve yazdır: A4 yatay, kenar boşluğu yok, arka plan grafikleri açık.');
})();
