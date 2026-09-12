/**
 * `npm run env:check`
 *
 * "Bende hangi değişken eksik?" sorusunun cevabı. Elle tutulan bir liste
 * değil: hangi değişkenlerin gerektiği **koddan** çıkarılıyor, yani liste ile
 * gerçeğin ayrışması diye bir ihtimal yok.
 *
 * İki ortam ayrı ayrı raporlanıyor çünkü **sunucuda iki ayrı ortam var**:
 * uygulamanınki EAS'ta, panelinki Coolify'da. Yerelde ikisi de aynı `.env`'i
 * okuduğu için bu ayrım görünmüyor ve "EAS'ta var" ile "panelde var" aynı şey
 * sanılıyor — bir kez tam olarak bu yaşandı (`EXPO_PUBLIC_FIREBASE_API_KEY`).
 *
 * `check:all`'a BİLEREK dâhil değil: ortam değişkenleri makineye özgü, ve
 * onları CI benzeri bir koşumda zorunlu kılmak her koşumu kırardı.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import './load-env';

const root = join(import.meta.dirname, '..');

/** Değeri olmayabilir; kodun kendi varsayılanı var. */
const OPTIONAL = new Set([
  'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID',
  'EXPO_PUBLIC_AIGUNDEM_DATA_MODE',
  'SUPABASE_STORAGE_BUCKET',
  'ADMIN_PORT',
  'ADMIN_AUTO_PUSH',
  'SMTP_PORT',
  'MAIL_FROM',
  'MAIL_REPLY_TO',
]);

function sources(dirs: string[], pattern: RegExp): Set<string> {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
        for (const m of readFileSync(join(root, rel), 'utf8').matchAll(pattern)) {
          // Kısmi eşleşmeler (bir hata mesajının içindeki `EXPO_PUBLIC_` gibi)
          // eleniyor: en az iki parçalı, harfle biten adlar.
          if (/_[A-Z0-9]+$/.test(m[1])) found.add(m[1]);
        }
      }
    }
  };
  dirs.forEach(walk);
  return found;
}

const app = sources(['src', 'app'], /process\.env\.(EXPO_PUBLIC_[A-Z0-9_]+)/g);

// YALNIZCA `admin/`. `scripts/` buraya girmiyor ve bu bir ayrıntı değil:
// `check-bundle` ile `check-release` `EXPO_PUBLIC_AIGUNDEM_*` adlarını
// GEÇİYOR ama onları pakette ARAMAK için — panelin o değerlere ihtiyacı yok.
// Taramaya dâhil edildiklerinde rapor, Coolify'a AI Gündem anahtarları
// girilmesi gerekiyormuş gibi görünüyordu.
const panel = sources(['admin'], /process\.env\.([A-Z0-9_]+)/g);

// SMTP ayarları `readMailConfig`'e parametre olarak geçiyor, yani
// `process.env.SMTP_HOST` diye bir satır yok — tarama onları göremez.
for (const ad of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_REPLY_TO']) {
  panel.add(ad);
}

let eksik = 0;
const ortak = [...app].filter((ad) => panel.has(ad));

function rapor(baslik: string, nerede: string, adlar: Set<string>) {
  console.log(`\n${baslik}  ${nerede}`);
  for (const ad of [...adlar].sort()) {
    const deger = (process.env[ad] ?? '').trim();
    const not = ortak.includes(ad) ? '  ← tek ortak değer, iki yere de girilecek' : '';
    if (deger) console.log(`  ✓ ${ad}${not}`);
    else if (OPTIONAL.has(ad)) console.log(`  · ${ad}  (isteğe bağlı — kodun varsayılanı var)`);
    else {
      console.log(`  ✗ ${ad}  EKSİK${not}`);
      eksik += 1;
    }
  }
}

rapor('UYGULAMA', '→ EAS environment', app);
rapor('PANEL', '→ Coolify', panel);

console.log(`
Üç yer var, ve listeler BÜYÜK ÖLÇÜDE AYRIK:

  .env / .env.local (bu makine)  ikisi de buradan okuyor, hepsi burada
  EAS environment                yalnızca yukarıdaki UYGULAMA listesi
  Coolify                        yalnızca yukarıdaki PANEL listesi

İki yere birden girilen tek değer: ${ortak.join(', ') || '(yok)'}.
Sebebi, web'den hesap silme sayfasının parolayı Identity Toolkit ile
doğrulaması — Admin SDK parola doğrulayamıyor. Geri kalan hiçbir değer
tekrarlanmıyor: uygulama servis hesabını ve SMTP parolasını hiç görmüyor,
panel de Firebase istemci yapılandırmasını.

Uygulama değerleri DERLEME ANINDA gömülüyor: EAS'ta değiştirmek koşan
uygulamayı değiştirmiyor, yeni derleme gerekiyor. Panel değerleri süreç
başlarken okunuyor: değiştirince redeploy gerekiyor.`);

console.log(eksik ? `\n${eksik} değişken eksik.` : '\nEksik yok.');
process.exit(eksik ? 1 : 0);
