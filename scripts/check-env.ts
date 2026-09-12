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
const panel = sources(['admin', 'scripts'], /process\.env\.([A-Z0-9_]+)/g);

// SMTP ayarları `readMailConfig`'e parametre olarak geçiyor, yani
// `process.env.SMTP_HOST` diye bir satır yok — tarama onları göremez.
for (const ad of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'MAIL_REPLY_TO']) {
  panel.add(ad);
}

let eksik = 0;

function rapor(baslik: string, nerede: string, adlar: Set<string>) {
  console.log(`\n${baslik}  ${nerede}`);
  for (const ad of [...adlar].sort()) {
    const deger = (process.env[ad] ?? '').trim();
    const istege = OPTIONAL.has(ad);
    if (deger) console.log(`  ✓ ${ad}`);
    else if (istege) console.log(`  · ${ad}  (isteğe bağlı — kodun varsayılanı var)`);
    else {
      console.log(`  ✗ ${ad}  EKSİK`);
      eksik += 1;
    }
  }
}

rapor('UYGULAMA', '— EAS environment + yerelde .env / .env.local', app);
rapor('PANEL', '— sunucuda Coolify, yerelde .env / .env.local', panel);

console.log(
  '\nUygulama değerleri DERLEME ANINDA gömülüyor: EAS\'ta değiştirmek koşan\n' +
    'uygulamayı değiştirmiyor, yeni derleme gerekiyor. Panel değerleri süreç\n' +
    'başlarken okunuyor: değiştirince redeploy gerekiyor.',
);

console.log(eksik ? `\n${eksik} değişken eksik.` : '\nEksik yok.');
process.exit(eksik ? 1 : 0);
