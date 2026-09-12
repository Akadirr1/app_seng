/**
 * Release guard — `npm run check:release`
 *
 * Every check here exists because the thing it guards actually went wrong once.
 * This is not a general lint pass; do not add speculative rules to it. When a
 * regression escapes, add the check that would have caught it and confirm the
 * check fails before the fix.
 *
 * Runs on plain node, no dependencies, so it works before `npm install` in CI.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const json = (p) => JSON.parse(read(p));

const results = [];
/** @param {string} name @param {string} why @param {() => string | null} run */
function check(name, why, run) {
  let problem;
  try {
    problem = run();
  } catch (err) {
    problem = `kontrol çalıştırılamadı: ${err.message}`;
  }
  results.push({ name, why, problem });
}

/**
 * firestore.rules içindeki tek bir `match` bloğunu ayıklar.
 *
 * Dosyanın tamamında regex aramak yetmiyor: aynı satır birden çok blokta
 * geçiyor ve bir bloktan silinse bile kontrol öbüründe bulup yeşil veriyordu.
 * Bir kere tam olarak bu oldu.
 */
function rulesBlock(collection) {
  const rules = read('firestore.rules');
  const start = rules.indexOf(`match /${collection}/`);
  if (start < 0) return '';
  const next = rules.indexOf('\n    match /', start + 1);
  return rules.slice(start, next < 0 ? rules.length : next);
}

const app = json('app.json').expo;
const pkg = json('package.json');
const store = read('src/store.tsx');

check(
  'demo kaydı yok',
  'Sabit bir demo kaydı ("Elif Yılmaz") her kuruluma gidiyordu; yeni kullanıcı ' +
    'başkasının kaydını görüyordu.',
  () => {
    // Matches `registrations: []` with any whitespace, including across lines.
    const empty = /registrations:\s*\[\s*\]/.test(store);
    if (!empty) return 'defaultState.registrations boş değil';
    return null;
  },
);

check(
  'ana ekranda sabit isim yok',
  'Uygulama girişsiz; kullanıcının adını bilemez. Başlık herkese "Merhaba Elif" diyordu.',
  () => {
    const home = read('app/(tabs)/index.tsx');
    if (/Merhaba\s+[A-ZÇĞİÖŞÜ]/.test(home)) return 'başlıkta sabit bir isim var';
    return null;
  },
);

check(
  'iOS deployment target override edilmemiş',
  'deploymentTarget "18.7.8" idi. Bu alan minimum sürüm; listelemeyi neredeyse ' +
    'hiçbir cihaza bırakmıyordu.',
  () => {
    const raw = read('app.json');
    if (raw.includes('deploymentTarget')) return 'app.json hâlâ deploymentTarget taşıyor';
    return null;
  },
);

check(
  'app.json şemada olmayan alan taşımıyor',
  '`newArchEnabled` SDK 52-53’te geçerliydi; 57’de yeni mimari tek seçenek olduğu ' +
    'için alan şemadan kalktı. Kalması `expo doctor`’ı kırmızıya düşürüyordu ve ' +
    'yaptığı hiçbir şey yoktu — zaten açık olan bir şeyi açıyordu.',
  () => {
    const raw = read('app.json');
    const stale = ['newArchEnabled'].filter((k) => raw.includes(`"${k}"`));
    return stale.length ? `app.json hâlâ taşıyor: ${stale.join(', ')}` : null;
  },
);

check(
  'paket sürümleri SDK ile uyuşuyor',
  '`expo doctor` on bir paketin SDK’nın beklediği sürümde olmadığını söylemişti — ' +
    'EAS build’de, yani en geç görülecek yerde. Caret aralığı (`^0.10.0`) SDK’nın ' +
    'hiç denemediği bir sürüme çözülebiliyor ve sonuç yalnızca gerçek cihazda ortaya ' +
    'çıkıyor.\n' +
    'Bu kontrolün yetkilisi **kurulu** expo: beklenen sürümler onun içindeki listede. ' +
    'Yani expo’nun kendisi eskiyse liste de eski olur ve kontrol eski beklentiye karşı ' +
    'yeşil verir — tam olarak bu oldu. `expo` sürümü o yüzden ayrıca sabitleniyor.\n' +
    'Kırmızıya dönerse: `npm run deps:sync`. Elle sürüm yazılmıyor.',
  () => {
    // Expo hangi sürümü beklediğini bu dosyada tutuyor; tahmin etmeye gerek yok.
    const bundled = json('node_modules/expo/bundledNativeModules.json');
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const bad = Object.entries(bundled)
      .filter(([name, want]) => deps[name] && deps[name] !== want)
      .map(([name, want]) => `${name} ${deps[name]} ≠ ${want}`);

    // `expo` kendi listesinde yok; kurulu sürümüyle karşılaştırılıyor.
    //
    // Bu **önce** bakılıyor ve tek başına dönüyor: expo eskiyse yukarıdaki liste
    // de eskidir ve her satırı ters okunur — "~57.0.15 ≠ ~57.0.10" doğru olanı
    // yanlış gibi gösterir. O hâlde söylenecek tek şey node_modules'ün eski
    // olduğu.
    const installed = json('node_modules/expo/package.json').version;
    if (deps.expo !== `~${installed}`) {
      return (
        `node_modules eski: kurulu expo ${installed}, package.json ${deps.expo} istiyor. ` +
        'Beklenen sürümler kurulu expo’nun listesinden okunuyor, yani bu hâlde ' +
        'yanlış listeye bakılıyor — önce `npm ci`.'
      );
    }

    return bad.length ? bad.join(', ') : null;
  },
);

check(
  'submit ayarı testçilere ulaşıyor',
  'Android testçileri "öğe bulunamadı" gördü ve build kusursuzdu: submit ayarı ' +
    '`releaseStatus: "draft"` taşıyordu. Draft bir sürüm Play Console’da durur, hiçbir ' +
    'kanala dağıtılmaz — yükleme başarılı görünür, EAS yeşil der, kimse indiremez. ' +
    'Play’in ilk yüklemesinde gerekebiliyor; orada kalması testçisi olmayan bir test ' +
    'kanalı demek. Bilerek draft’a alınacaksa bu kontrol de bilerek değiştirilsin.',
  () => {
    const android = json('eas.json').submit?.production?.android;
    if (!android) return 'eas.json: submit.production.android yok';
    if (android.releaseStatus === 'draft') {
      return `eas.json: releaseStatus "draft" — "${android.track}" kanalındaki testçilere ulaşmaz`;
    }
    return null;
  },
);

check(
  'panel sunucuda ayağa kalkabilir',
  'Panelin çalışma zamanı paketleri (express, firebase-admin, multer, sharp, ' +
    'supabase-js, tsx) devDependencies altında ve bu mobil uygulama için doğru — ' +
    'hiçbiri uygulama paketine girmiyor. Ama Nixpacks kurulumu NODE_ENV=production ' +
    'ile yapıyor ve npm o hâlde devDependencies’i atlıyor. Kaçırılırsa derleme ' +
    'yeşil geçiyor, konteyner `Cannot find module \'express\'` ile ölüyor — yani ' +
    'hata derlemede değil, ilk açılışta ve sunucuda görünüyor.',
  () => {
    const needed = ['express', 'firebase-admin', 'multer', 'sharp', '@supabase/supabase-js', 'tsx'];
    // dependencies'e taşınmışlarsa imajın ayrıca bir şey yapmasına gerek yok.
    const dev = needed.filter((n) => pkg.devDependencies?.[n]);
    if (!dev.length) return null;

    // TOML yorumu `#` ile başlıyor ve bu dosya baştan aşağı yorum: aradığımız
    // iki metin de gerekçesiyle birlikte orada yazıyor. Ham metinde arayınca
    // gerçek ayarlar silinse bile kontrol yeşil kalıyor — sınandı. Aynı tuzağın
    // JS tarafı için `strip()` var ama o yalnızca `//` ve `/* */` biliyor.
    // Tırnak içindeki `#` yorum değil, o yüzden satır tırnak sayılarak taranıyor.
    const stripToml = (src) =>
      src
        .split('\n')
        .map((line) => {
          let quote = null;
          for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (quote) {
              if (c === quote) quote = null;
            } else if (c === '"' || c === "'") {
              quote = c;
            } else if (c === '#') {
              return line.slice(0, i);
            }
          }
          return line;
        })
        .join('\n');

    const cfg = stripToml(read('nixpacks.toml'));
    if (!/npm ci[^\n]*--include=dev/.test(cfg)) {
      return `nixpacks.toml devDependencies kurmuyor ama panel onlara bağlı: ${dev.join(', ')}`;
    }

    // Başlatma komutu da burada olmak zorunda: `[start]` düşerse Nixpacks
    // `npm start`'a geri dönüyor ve o komut bu depoda `expo start` — yani mobil
    // geliştirme sunucusu. Deploy başarılı görünür, panel hiç açılmaz.
    if (!/admin\/server\.ts/.test(cfg)) {
      return 'nixpacks.toml paneli başlatmıyor — Nixpacks `npm start`’a düşer, o da `expo start`';
    }
    return null;
  },
);

check(
  'panel portu saf çözücüden geçiyor',
  'Port kararı `admin/port.ts` içinde ve `check:panel` orayı sınıyor — ama server.ts ' +
    'bir satırla yeniden `process.env`\u2019i okumaya dönerse o sınavın koruduğu bir şey ' +
    'kalmıyor. Yanlış çözülen port sessiz: `listen(0)` hata vermiyor, rastgele bir ' +
    'port açıyor, konteyner sağlıklı görünüyor ve ters proxy hiç ulaşamıyor.',
  () => {
    // Yorumları at: bu dosyanın kendi açıklamaları da ADMIN_PORT/PORT yazıyor.
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const server = strip(read('admin/server.ts'));
    if (!/resolvePort\(/.test(server)) {
      return 'admin/server.ts portu resolvePort ile çözmüyor';
    }
    if (/process\.env\.(ADMIN_)?PORT/.test(server)) {
      return 'admin/server.ts portu hâlâ doğrudan process.env\u2019den okuyor';
    }
    return null;
  },
);

check(
  'panel CSV hücresi ve oturumu saf modüllerden geçiyor',
  'csvCell, verifyToken ve loginLimiter `check:panel` içinde sınanıyor — ama server.ts ' +
    'yerel bir `cell` yazıp ya da jetonu yine sabit bir imza yapıp geri dönerse o sınavın ' +
    'koruduğu bir şey kalmıyor. Formül enjeksiyonu ve sınırsız parola denemesi ikisi de ' +
    'sessiz: dosya açılır, giriş çalışır, kimse bir hata görmez.',
  () => {
    // Yorumları at: server.ts kendi açıklamalarında eski jetonu ve `cell`i anıyor.
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const server = strip(read('admin/server.ts'));
    const exporter = strip(read('scripts/export-registrations.ts'));
    for (const name of ['csvCell', 'verifyToken', 'loginLimiter', 'issueToken']) {
      if (!new RegExp(`\\b${name}\\(`).test(server)) return `admin/server.ts ${name}() kullanmıyor`;
    }
    if (/const cell = /.test(server)) return 'admin/server.ts yerel bir CSV hücre fonksiyonu taşıyor';
    if (/sign\('ok'\)/.test(server)) return 'admin/server.ts oturum jetonunu yine sabit bir imzayla üretiyor';
    if (/function csvCell/.test(exporter) || !/\bcsvCell\b/.test(exporter)) {
      return 'scripts/export-registrations.ts paylaşılan csvCell fonksiyonunu kullanmıyor';
    }
    return null;
  },
);

check(
  'Firebase Auth React Native kalıcılığı elde',
  'Oturum kalıcılığı `getReactNativePersistence`e bağlı, ve o fonksiyon yalnızca ' +
    '@firebase/auth\u2019un React Native derlemesinde var. `firebase/auth`\u2019un varsayılan ' +
    'derlemesi tek satır (`export * from "@firebase/auth"`) ve Metro o iç içe isteği ' +
    'react-native koşuluyla çözdüğü için cihazda doğru derleme yükleniyor. Koşul ' +
    'kaybolursa kalıcılık sessizce belleğe düşer: oturum uygulama kapanınca ölür, ' +
    'kullanıcı her açılışta yeniden giriş yapar ve sürüm derlemesinde konsol ' +
    'olmadığı için hiçbir uyarı görünmez.',
  () => {
    const scoped = JSON.parse(read('node_modules/@firebase/auth/package.json'));
    const cond = scoped.exports?.['.']?.['react-native'];
    if (!cond) return '@firebase/auth artık react-native koşulu taşımıyor';

    const rnEntry = String(cond.default ?? cond).replace(/^\.\//, '');
    const rn = read(`node_modules/@firebase/auth/${rnEntry}`);
    if (!/getReactNativePersistence/.test(rn)) {
      return `@firebase/auth react-native derlemesi (${rnEntry}) getReactNativePersistence ihraç etmiyor`;
    }

    // Umbrella paket yalnızca yeniden ihraç ediyorsa Metro iç isteği kendi
    // koşullarıyla çözüyor; gerçek bir derlemeye dönerse o zincir kopar.
    const umbrella = read('node_modules/firebase/auth/dist/esm/index.esm.js');
    if (!/export \* from ['"]@firebase\/auth['"]/.test(umbrella)) {
      return 'firebase/auth artık @firebase/auth\u2019u yeniden ihraç etmiyor — kalıcılık zinciri koptu';
    }

    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const auth = strip(read('src/auth.ts'));
    if (!/getReactNativePersistence\(/.test(auth) || !/initializeAuth\(/.test(auth)) {
      return 'src/auth.ts kalıcılığı initializeAuth + getReactNativePersistence ile kurmuyor';
    }
    return null;
  },
);

check(
  'panelin yasal sayfaları giriş istemiyor',
  'Play\u2019in şartı, uygulamaya erişemeyen kullanıcının hesabını WEB\u2019den ' +
    'silebilmesi. Bu rotalar `app.use(requireAuth)`\u2019tan sonra kayıt edilirse ' +
    'yönetici parolası isterler ve şart karşılanmaz — üstelik sayfa açılıyor ' +
    'göründüğü için kimse fark etmez, giriş ekranına yönlendirir.',
  () => {
    // Yorumlar atılıyor: bu rotaların ÜSTÜNDEKİ açıklama `app.use(requireAuth)`
    // metnini kelimesi kelimesine içeriyor ve ham metinde arayınca kontrol o
    // yorumu buluyor — yani sıra doğruyken bile "sonra kayıtlı" diyordu.
    // Ölçüldü. Bu defterde aynı tuzağın üç kaydı zaten var.
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const server = strip(read('admin/server.ts'));
    const guard = server.indexOf('app.use(requireAuth)');
    if (guard < 0) return 'admin/server.ts requireAuth ara yazılımını hiç kurmuyor';

    for (const route of ["'/gizlilik'", "'/kosullar'", "'/hesap-sil'"]) {
      const at = server.indexOf(route);
      if (at < 0) return `admin/server.ts ${route} rotasını sunmuyor`;
      if (at > guard) return `${route} requireAuth'tan SONRA kayıtlı — giriş ister`;
    }
    // Kimlik doğrulamadan silme talebi kabul etmek, bir e-postayı bilen
    // herkese başkasının hesabını sildirmek olurdu.
    if (!/verifyPassword\(/.test(server)) {
      return 'web silme rotası parolayı doğrulamıyor';
    }
    return null;
  },
);

check(
  'AI Gündem yapılandırması pakete gömülüyor',
  'Expo\u2019nun babel eklentisi `process.env.EXPO_PUBLIC_*` ifadesini ancak statik ' +
    'üye erişimi olarak GÖRÜRSE değeri pakete gömüyor. `process.env`\u2019i bir nesne ' +
    'gibi dolaştırmak ya da anahtarı hesaplamak üretim derlemesinde `undefined` ' +
    'üretiyor — ve sonuç "yapılandırma yok" gibi görünüyor, "kod yanlış" gibi değil. ' +
    'Sürüm derlemesinde konsol da olmadığı için bölüm sessizce boş açılır.',
  () => {
    // Yorumları at: env.ts bu üç ifadeyi kendi açıklamasında da yazıyor.
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const env = strip(read('src/gundem/config/env.ts'));
    const needed = [
      'process.env.EXPO_PUBLIC_AIGUNDEM_DATA_MODE',
      'process.env.EXPO_PUBLIC_AIGUNDEM_SUPABASE_URL',
      'process.env.EXPO_PUBLIC_AIGUNDEM_SUPABASE_ANON_KEY',
    ];
    const missing = needed.filter((name) => !env.includes(name));
    if (missing.length) {
      return `env.ts bu okumaları harfi harfine yapmıyor: ${missing.join(', ')}`;
    }
    return null;
  },
);

check(
  'CI paketin içine bakıyor',
  'Sırların pakete girip girmediğini yalnızca `check:bundle` görebiliyor: ' +
    '`EXPO_PUBLIC_*` değerleri derleme anında gömülüyor, yani kaynakta olmayan bir ' +
    'değer pakette olabiliyor. Adım CI\u2019dan düşerse hiçbir şey kırmızı olmaz — ' +
    'yalnızca kimse bakmamış olur, ve fark edildiğinde anahtar çoktan yayınlanmıştır.',
  () => {
    // YAML yorumları `#`; bu iş akışı adımı kendi gerekçesini yanında taşıyor.
    const stripYaml = (src) => src.replace(/^\s*#.*$/gm, '');
    const ci = stripYaml(read('.github/workflows/ci.yml'));
    if (!/npm run check:bundle/.test(ci)) {
      return 'ci.yml `npm run check:bundle` çalıştırmıyor — pakete kimse bakmıyor';
    }
    if (!/"check:bundle"/.test(read('package.json'))) {
      return 'package.json içinde `check:bundle` betiği yok';
    }
    return null;
  },
);

check(
  'kurulu paketler package.json ile uyuşuyor',
  'Bir bağımlılık eklendiğinde `git pull` onu kurmuyor — `node_modules` olduğu yerde ' +
    'kalıyor. Sonuç Metro\u2019dan "Unable to resolve" diye geliyor ve bu, paketin ' +
    'depoda eksik olduğu gibi okunuyor; oysa eksik olan kurulum. Ölçüldü: ' +
    '@tanstack paketleri eklendikten sonra taze bir çalıştırmada tam olarak bu oldu.',
  () => {
    const declared = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    const missing = Object.keys(declared).filter(
      (name) => !existsSync(join(root, 'node_modules', name, 'package.json')),
    );
    if (missing.length) {
      return (
        `node_modules bu paketleri taşımıyor: ${missing.join(', ')}. ` +
        '`npm ci` çalıştırın — pull kurulum yapmıyor.'
      );
    }
    return null;
  },
);

check(
  'sürüm iki dosyada aynı',
  'app.json 1.0.1, package.json 1.0.0 diye ayrışmıştı. runtimeVersion appVersion ' +
    'politikasında olduğu için sürüm dizgesi OTA eşleşmesini de belirliyor.',
  () => (app.version === pkg.version ? null : `app.json ${app.version} ≠ package.json ${pkg.version}`),
);

check(
  'uygulama kimliği iki platformda aynı',
  'com.akadirr1.sengkou her iki mağazada kayıtlı ve ilk yayından sonra değiştirilemez.',
  () => {
    const ios = app.ios?.bundleIdentifier;
    const android = app.android?.package;
    if (ios !== 'com.akadirr1.sengkou') return `ios.bundleIdentifier beklenmedik: ${ios}`;
    if (android !== ios) return `android.package (${android}) ios ile aynı değil`;
    return null;
  },
);

check(
  'yerel sürüm sayaçları app.json’da değil',
  'appVersionSource "remote"; sayaçları EAS tutuyor. app.json’da bir kopya kalırsa ' +
    'hangisinin geçerli olduğu karışır.',
  () => {
    if (json('eas.json').cli?.appVersionSource !== 'remote') return 'eas.json remote demiyor';
    if (app.ios?.buildNumber !== undefined) return 'app.json hâlâ ios.buildNumber taşıyor';
    if (app.android?.versionCode !== undefined) return 'app.json hâlâ android.versionCode taşıyor';
    return null;
  },
);

check(
  'bekleyen kayıtlar yeniden gönderiliyor',
  'syncPending() bir yorumda söz veriliyordu ama hiç yazılmamıştı; gönderilemeyen ' +
    'kayıt sessizce kayboluyordu.',
  () => {
    if (!/const syncPending\s*=\s*useCallback/.test(store)) {
      return 'syncPending tanımlı değil (yorumda geçmesi sayılmaz)';
    }
    if (!/AppState\.addEventListener/.test(store)) {
      return 'AppState tetikleyicisi yok — öne gelişte yeniden deneme çalışmaz';
    }
    if (!/syncPending\(\)/.test(store)) return 'syncPending hiçbir yerden çağrılmıyor';
    return null;
  },
);

check(
  'kayıt yeniden gönderimi kopya üretmiyor',
  'pushRegistration `addDoc` kullanıyordu. Yazma Firestore’a ulaşıp `synced` bayrağı ' +
    'diske yazılmadan uygulama ölürse kayıt beklemede görünür ve yeniden gönderilir — ' +
    '`addDoc` her denemede yeni bir doküman üretir, yani öğrenci kayıt listesinde iki ' +
    'kez çıkardı. Çekiliş katılımlarında baştan `setDoc` vardı; kayıtlarda açıktı.',
  () => {
    const fb = read('src/firebase.ts');
    // Yorumlar hariç. Açıklama metinleri `addDoc` ve `increment(1)` diye neyin
    // neden kullanılmadığını anlatıyor; onlara bakarsak kontrol kendi
    // gerekçesini bulup kırmızı kalır.
    const code = fb.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    if (/addDoc/.test(code)) return 'src/firebase.ts hâlâ addDoc kullanıyor';
    if (!/doc\(db, COLLECTIONS\.registrations, payload\.regId\)/.test(fb)) {
      return 'kayıt kendi kimliğine yazılmıyor';
    }
    // Kayıt ve koltuk aynı batch'te olmalı. Ayrı yazılırsa biri gidip öteki
    // gitmeyebilir ve etkinlik dolmadığı hâlde dolmuş görünebilir.
    if (!/writeBatch\(db\)/.test(fb) || !/batch\.commit\(\)/.test(fb)) {
      return 'kayıt ile koltuk aynı batch’te yazılmıyor';
    }
    // arrayUnion idempotent; increment değil. Yeniden gönderim sayıyı
    // şişirmemeli.
    if (/increment\(/.test(code)) {
      return 'koltuk sayısı increment ile artıyor — yeniden gönderimde şişer';
    }
    // Kayıt dokümanının kimliğinde öğrenci numarası var ve koltuk listesi
    // herkese açık. İkisi karışırsa dokuz haneli numaralar kaba kuvvetle
    // çözülebilir hâle gelir.
    if (/arrayUnion\(payload\.regId\)/.test(code)) {
      return 'öğrenci numarası taşıyan kimlik herkese açık listeye giriyor';
    }
    if (!/seatIds: arrayUnion\(payload\.seatId\)/.test(fb)) {
      return 'koltuk jetonu arrayUnion edilmiyor';
    }
    // Kimlik cihazda üretilip saklanmazsa her denemede yenisi çıkar ve setDoc da
    // addDoc gibi davranır.
    const store = read('src/store.tsx');
    if (!/seatId: makeEntryId\(\)/.test(store)) return 'koltuk jetonu cihazda üretilmiyor';
    // Kimlikler sonradan eklendi: onlarsız kaydedilmiş bir kayıt cihazda
    // duruyor olabilir ve kimliksiz gönderilemez.
    if (!/regId: r\.regId \?\?/.test(store) || !/seatId: r\.seatId \?\?/.test(store)) {
      return 'eski kayıtlar için hidrasyon göçü yok';
    }
    if (!/request\.resource\.data\.regId == registrationId/.test(read('firestore.rules'))) {
      return 'kural doküman kimliğinin kaydın kimliği olmasını zorunlu kılmıyor';
    }
    return null;
  },
);

check(
  'aynı öğrenci numarası bir etkinliğe iki kez kaydolamıyor',
  'Kayıt dokümanının kimliği rastgeleydi, yani ikinci bir cihazdan aynı numarayla ' +
    'yeniden kayıt olmak serbestti — hem kontenjandan iki yer götürür hem listede iki ' +
    'kez görünürdü. Cihazdaki kontrol sadece o cihazı kapsıyor; silip yeniden kuran ' +
    'öğrenciyi durdurmuyor.',
  () => {
    const store = read('src/store.tsx');
    if (!/regId: `\$\{input\.eventId\}__\$\{input\.studentNo\}`/.test(store)) {
      return 'kimlik öğrenci numarasından türetilmiyor';
    }
    // Dosyanın tamamında değil, kendi bloğunda arıyoruz: aynı satır
    // raffleEntries bloğunda da var ve orada bulup yeşil vermek işe yaramaz.
    const block = rulesBlock('registrations');
    if (!block) return 'firestore.rules registrations bloğu taşımıyor';
    // Kimliği istemci seçebilseydi benzersizlik diye bir şey kalmazdı.
    if (!/registrationId == request\.resource\.data\.eventId \+ '__' \+ request\.resource\.data\.studentNo/.test(block)) {
      return 'kural doküman kimliğinin numaradan türemesini zorunlu kılmıyor';
    }
    // Update tamamen kapalı olsaydı yeniden gönderim sonsuza kadar reddedilirdi;
    // sınırsız açık olsaydı ikinci cihaz birincinin üzerine yazardı.
    if (!/affectedKeys\(\)\.hasOnly\(\['createdAt'\]\)/.test(block)) {
      return 'yeniden gönderim için dar update dalı yok';
    }
    // Çekiliş katılımları aynı yoldan geçiyor ve aynı deliğe düşerdi.
    if (!/affectedKeys\(\)\.hasOnly\(\['createdAt'\]\)/.test(rulesBlock('raffleEntries'))) {
      return 'çekiliş katılımlarında yeniden gönderim dalı yok';
    }
    // Reddedilen kayıt sonsuza kadar denenirse her açılış bir yazma harcar ve
    // ekranda "Gönderiliyor…" kalır.
    if (!/isRulesRejection/.test(store)) return 'kural reddi ağ hatasından ayrılmıyor';
    if (!/!r\.synced && !r\.blocked/.test(store)) return 'reddedilen kayıt yeniden denenmeye devam ediyor';
    return null;
  },
);

check(
  'kontenjan elle yazılmıyor, kayıtlardan çıkıyor',
  'Kontenjan `spots` diye serbest metindi: "12 / 60 yer kaldı". Kimse kayıt oldukça ' +
    'değişmiyordu, yönetici kontenjanı yükselttiğinde de değişmiyordu — cümleyi ' +
    'yeniden yazmak gerekiyordu. Ve hiçbir şey sınırı uygulamıyordu: dolu bir ' +
    'etkinliğe kayıt olmak serbestti.',
  () => {
    const schema = read('src/eventSchema.ts');
    if (/\bspots\b/.test(schema)) return 'eventSchema hâlâ spots taşıyor';
    if (!/export function seatsLeft/.test(schema)) return 'kalan yer türetilmiyor';

    const detail = read('app/etkinlik/[id].tsx');
    if (!/registeredCount\(/.test(detail)) return 'detay ekranı gerçek kayıt sayısını okumuyor';
    if (!/isFull\(/.test(detail)) return 'dolunca kayıt düğmesi kapanmıyor';
    // Detayda düğme gizlense de forma derin bağlantıyla gelinebiliyor.
    if (!/isFull\(/.test(read('app/kayit/[id].tsx'))) return 'kayıt formunda kontenjan kontrolü yok';

    if (!/COLLECTIONS\.eventSeats/.test(read('src/firebase.ts'))) return 'koltuklar okunmuyor';

    const rules = read('firestore.rules');
    if (!/match \/eventSeats\//.test(rules)) return 'eventSeats kuralı yok';
    // Kimlik silinebilirse dolu bir etkinliğe yer açılabilir.
    if (!/seatIds\.hasAll\(resource\.data\.seatIds\)/.test(rules)) {
      return 'kural koltukların silinmesini engellemiyor';
    }
    return null;
  },
);

check(
  'bildirim wiring bağlı',
  'NotificationSync mount edilmezse token da alınmaz, hatırlatma da kurulmaz — ' +
    'özellik hiçbir hata vermeden ölür.',
  () => {
    if (!/<NotificationSync\s*\/>/.test(read('app/_layout.tsx'))) {
      return '_layout.tsx NotificationSync render etmiyor';
    }
    const notif = read('src/notifications.tsx');
    if (!/addNotificationResponseReceivedListener/.test(notif)) {
      return 'bildirime dokunma dinleyicisi yok — bildirim etkinliği açmaz';
    }
    if (!/scheduleNotificationAsync/.test(notif)) return 'yerel hatırlatma kurulmuyor';
    return null;
  },
);

check(
  'görseller gerçek, sayaç uydurma değil',
  'Arşivde dört fotoğraflık bir görüntüleyici ve "24 foto" rozeti vardı; arkasında ' +
    'hiçbir dosya yoktu, dördü de aynı gradyan yer tutucuydu. Galeri geri geldi ama ' +
    'bu sefer gerçek dosyalarla: sayaç `photos.length`, yani ne varsa o.',
  () => {
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    const gallery = strip(read('src/components/PhotoGallery.tsx'));
    // Sabit bir adet, arkasında dosya olup olmadığına bakmadan sayı gösterir.
    if (/PHOTOS_PER_ENTRY|length: 4|\{ length: \d/.test(gallery)) {
      return 'galeri sabit bir görsel sayısı taşıyor';
    }
    // Sayaç ifadesinin kendisi aranıyor. Sadece `photos.length` aramak yetmiyor:
    // dosyada başka yerlerde de geçiyor ve payda sabitlense bile eşleşirdi —
    // yani kontrol tam korumak istediği şeyi kaçırıyordu.
    if (!/\} \/ \$\{photos\.length\}/.test(gallery)) {
      return 'sayacın paydası gerçek görsel sayısı değil';
    }
    // Tek görsel varsa gezilecek bir şey yok; yine de bir görüntüleyici açmak
    // eski sahte lightbox’ın aynısı olurdu.
    if (!/photos\.length < 2/.test(gallery)) return 'tek görselde galeri gizlenmiyor';

    // Kapaklar gerçekten veriye bağlı mı, yoksa yine yer tutucu mu?
    for (const f of ['app/(tabs)/arsiv.tsx', 'app/etkinlik/[id].tsx']) {
      if (!/uri=\{event\.photos\?\.\[0\]\}/.test(read(f))) return `${f} kapağı veriden almıyor`;
    }

    // Sınırsız görsel, detay ekranını mobil veride pahalı hâle getirir.
    if (!/MAX_PHOTOS/.test(strip(read('admin/server.ts')))) return 'panel görsel sayısını sınırlamıyor';
    if (!/errors\.photos/.test(strip(read('src/eventSchema.ts')))) {
      return 'şema görselleri doğrulamıyor';
    }
    return null;
  },
);

check(
  'yükleme yetim dosya bırakmıyor',
  'Doğrulama başarısız olursa yüklenen dosyalar Storage’da kalır ve hiçbir etkinlik ' +
    'onlara işaret etmez — kota onlara da ödenir ve kimse fark etmez. Silinen görsel ' +
    've silinen etkinlik için de aynısı geçerli.',
  () => {
    const server = read('admin/server.ts').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    // Doğrulama yüklemeden önce olmalı: `checked` başarısızsa hiçbir dosya
    // Storage’a gitmemiş oluyor.
    const validateAt = server.indexOf('const checked = buildEvent(input)');
    const uploadAt = server.indexOf('uploadEventPhoto(');
    if (validateAt < 0 || uploadAt < 0) return 'kaydetme yolu beklenen sırayı taşımıyor';
    if (validateAt > uploadAt) return 'doğrulama yüklemeden sonra yapılıyor';

    if (!/deletePhotos\(uploaded\)/.test(server)) return 'başarısız kayıtta yüklenenler geri alınmıyor';
    if (!/deletePhotos\(removed\)/.test(server)) return 'formdan çıkarılan görseller silinmiyor';
    if (!/deleteEventPhotos\(/.test(server)) return 'etkinlik silinince görselleri kalıyor';
    return null;
  },
);

check(
  'yapay gecikme yok',
  'Açılış ekranı hidrasyon bittikten *sonra* 1900 ms daha bekliyordu, ve her etkinlik ' +
    'detayı 460 ms’lik bir perdenin arkasından açılıyordu. İkisi de hiçbir şeyi ' +
    'beklemiyordu: perdenin yorumunda "gerçek fetch buraya gelecek" yazıyordu ama ' +
    '`useEvent(id)` bellekteki listeden okuyor. Kullanıcı her dokunuşta bekletiliyordu.',
  () => {
    // Yorumlar hariç, her seferinde: açıklamalar kaldırılan şeyin adını anıyor
    // ve onlara bakan kontrol kendi gerekçesini bulup kırmızı kalıyor. Bu
    // dosyada üçüncü kez oluyor.
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    const splash = strip(read('app/index.tsx'));
    if (/HOLD_MS/.test(splash)) return 'açılışta sabit bekleme sabiti duruyor';
    // Kalan gecikme animasyonun kendi süresi olmalı — yani geçiş animasyonun
    // bitmesine bağlı, bir sayaca değil.
    if (!/introDone/.test(splash)) return 'geçiş animasyonun bitmesine bağlı değil';

    const open = strip(read('src/useOpenEvent.ts'));
    if (/runWithLoader/.test(open)) return 'etkinlik detayı hâlâ perde arkasından açılıyor';
    if (/setTimeout/.test(open)) return 'useOpenEvent hâlâ bekletiyor';
    // Perde kalktıysa onu süren makine de kalmalı, yoksa ölü kod olarak durur
    // ve bir sonraki oturum "bu ne işe yarıyor" diye geri bağlar.
    if (/runWithLoader/.test(strip(read('src/store.tsx')))) {
      return 'store hâlâ runWithLoader taşıyor';
    }
    return null;
  },
);

check(
  'sahte okunmamış rozeti yok',
  'Zildeki kırmızı nokta koşulsuz render ediliyordu; okunmamış bir şey yokken ' +
    'varmış gibi gösteriyordu ve okunma durumunu tutan hiçbir şey yok.',
  () => {
    if (/styles\.bellDot/.test(read('app/(tabs)/index.tsx'))) {
      return 'bellDot hâlâ render ediliyor';
    }
    return null;
  },
);

check(
  'takvim ve arşiv başlığında sabit tarih yok',
  'Takvim başlığı "Mart – Nisan 2026" yazıyordu ve o etkinlikler geçtikten aylar ' +
    'sonra hâlâ oradaydı. Arşiv başlığı da aynısını yapıyordu: "2023’ten bugüne". ' +
    'Tarih aralığı veriden türetilmeli, elle yazılmamalı.',
  () => {
    const bad = ['app/(tabs)/takvim.tsx', 'app/(tabs)/arsiv.tsx']
      .map((f) => {
        // Yorumlar hariç: sabit bir yıl JSX metnine gömülmüş mü?
        const code = read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const year = code.match(/\b(19|20)\d{2}\b/);
        return year ? `${f}: ${year[0]}` : null;
      })
      .filter(Boolean);
    return bad.length ? `başlıkta sabit yıl var — ${bad.join(', ')}` : null;
  },
);

check(
  'arşiv uydurma veri taşımıyor',
  'src/data.ts altı hayali etkinlik ("Kış Kampı: Backend 101") ve iki uydurma sayı ' +
    'taşıyordu: ARCHIVE_TOTALS = { events: 38, photos: 412 }. İkincisi daha kötüydü — ' +
    'uygulamada fotoğraf deposu hiç yok, yani 412 hiçbir şeyi saymıyordu. Demo kaydı ' +
    'ile aynı sınıf hata: kullanıcı gerçek sanıyor.',
  () => {
    const data = read('src/data.ts');
    const code = data.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    if (/ARCHIVE_TOTALS/.test(code)) return 'src/data.ts hâlâ ARCHIVE_TOTALS taşıyor';
    if (/export const ARCHIVE\s*[:=]/.test(code)) return 'src/data.ts hâlâ sabit ARCHIVE dizisi taşıyor';
    // Arşiv geçmiş etkinliklerden türemeli; ayrı bir koleksiyon olarak dönerse
    // aynı etkinlik iki kez giriliyor demektir.
    if (/COLLECTIONS\.archive|archive:\s*'archive'/.test(read('src/firebase.ts'))) {
      return 'istemci hâlâ ayrı bir archive koleksiyonu okuyor';
    }
    if (!/splitByDate/.test(read('src/content.tsx'))) {
      return 'content.tsx arşivi etkinliklerden türetmiyor';
    }
    return null;
  },
);

check(
  'içerik durumu ekranlara bağlı',
  'useContent() `source`, `error`, `loading` ve `refresh` üretiyordu ve hiçbir ekran ' +
    'hiçbirini tüketmiyordu. Firestore erişilemezken kullanıcı boş bir uygulama ' +
    'görüyor, sebebini öğrenemiyor ve uygulamayı kapatmaktan başka bir şey ' +
    'yapamıyordu.',
  () => {
    // Aranan şey JSX'te gerçekten render edilmesi. Sadece isim aramak yetmiyor:
    // import satırı tek başına eşleşiyor, yani bileşen import edilip hiç
    // kullanılmasa da kontrol yeşil verirdi.
    const missing = ['app/(tabs)/takvim.tsx', 'app/(tabs)/index.tsx', 'app/(tabs)/arsiv.tsx']
      .filter((f) => {
        const src = read(f);
        return !/<ContentNotice\b/.test(src) || !/<RefreshControl\b/.test(src);
      });
    return missing.length ? `bağlı değil: ${missing.join(', ')}` : null;
  },
);

check(
  'tek koleksiyon uygulamayı karartmıyor',
  '`eventSeats` okuması `Promise.all` içindeydi. Kuralı yayınlanmadığı için ' +
    'reddedilince etkinlikler ve çekilişler de düştü — okunabildikleri hâlde. ' +
    'Uygulama tamamen boş açıldı ve "Missing or insufficient permissions" yazdı. ' +
    'Kalan yer bir zenginleştirme; takvim onsuz da doğru.',
  () => {
    const fb = read('src/firebase.ts');
    const all = /Promise\.all\(\[([\s\S]*?)\]\)/.exec(fb)?.[1] ?? '';
    if (/eventSeats/.test(all)) return 'koltuk okuması hâlâ Promise.all içinde';
    if (!/catch \(err: unknown\)[\s\S]{0,400}Koltuk sayıları okunamadı/.test(fb)) {
      return 'koltuk okumasının hatası yakalanmıyor';
    }
    return null;
  },
);

check(
  'sunucu tarafı .env.local okuyor',
  '`import \'dotenv/config\'` yalnızca `.env` okuyor; `.env.local` bir Expo geleneği, ' +
    'dotenv’in değil. Yani `npm start` onu görüyor, `npm run admin` görmüyordu. ' +
    'Belgeler "gizli değerler .env.local’e" diyordu ve panel onları hiç okumuyordu: ' +
    'anahtar doğru yerde duruyor, hiçbir şey çalışmıyor, ortada hata da yok.',
  () => {
    const entries = ['admin/server.ts', 'scripts/send-push.ts', 'scripts/export-registrations.ts'];
    const bare = entries.filter((f) => /'dotenv\/config'/.test(read(f)));
    if (bare.length) return `hâlâ doğrudan dotenv/config: ${bare.join(', ')}`;
    const missing = entries.filter((f) => !/load-env/.test(read(f)));
    if (missing.length) return `ortam yükleyici bağlı değil: ${missing.join(', ')}`;
    // Sıra da önemli: dotenv var olanın üzerine yazmıyor, önce yüklenen kazanıyor.
    if (!/\['\.env\.local', '\.env'\]/.test(read('scripts/load-env.ts'))) {
      return 'yükleyici .env.local’i .env’den önce okumuyor';
    }
    return null;
  },
);

check(
  'yapılandırmasız build sessiz kalmıyor',
  'EXPO_PUBLIC_FIREBASE_* değerleri derleme anında pakete giriyor. EAS ortam ' +
    'değişkenleri kurulmadan alınan bir build hiçbir şeye bağlanamıyor — ve eskiden ' +
    'sadece konsola yazıyordu. Release’de konsol yok: uygulama sessizce boş açılıyor, ' +
    'sebebini görmenin hiçbir yolu kalmıyor. Mağazadaki bir sürümde fark etmenin ' +
    'bedeli bir inceleme turu.',
  () => {
    const content = read('src/content.tsx');
    const block = /if \(!isFirebaseConfigured\) \{[\s\S]*?\n    \}/.exec(content)?.[0] ?? '';
    if (!block) return 'content.tsx yapılandırma kontrolünü taşımıyor';
    if (!/setError\(/.test(block)) return 'yapılandırma eksikken ekranda bir şey görünmüyor';
    // Yükleme durumu kapanmazsa ekran sonsuza kadar dönüyor ve bildirim çıkmıyor.
    if (!/setLoading\(false\)/.test(block)) return 'yükleme durumu kapatılmıyor';
    return null;
  },
);

check(
  'build profilleri ortamını açıkça söylüyor',
  'EAS ortam değişkenleri bir ortama bağlı (production/preview/development). Profil ' +
    'hangisini alacağını söylemezse varsayılana güveniliyor — ve yanlış giderse ' +
    'sonuç, yapılandırmasız bir mağaza build’i oluyor. Yazılı olan tahmin edilmez.',
  () => {
    const profiles = json('eas.json').build ?? {};
    const missing = Object.entries(profiles)
      .filter(([, v]) => !v.environment)
      .map(([k]) => k);
    return missing.length ? `environment tanımsız: ${missing.join(', ')}` : null;
  },
);

check(
  'boş Firestore hata sayılmıyor',
  'Boş koleksiyon `error`’a geliştirici mesajı yazıyordu ("`npm run seed` çalıştırın"). ' +
    'src/data.ts artık boş olduğu için düşülecek yerel içerik de yok — sıradan bir boş ' +
    'takvim kullanıcıya bağlantı sorunu gibi görünüyordu.',
  () => (/npm run seed/.test(read('src/content.tsx')) ? 'content.tsx hâlâ seed mesajını hata olarak yazıyor' : null),
);

check(
  'panel yığın izi sızdırmıyor',
  'Hata yakalayıcı olmadan express varsayılanına düşüp tarayıcıya tam yığın izini ' +
    'basıyordu — mutlak dosya yolları, paket sürümleri, Firestore hata ayrıntıları. ' +
    'Panel açık bir sunucuda çalışıyor.',
  () => {
    const server = read('admin/server.ts');
    if (!/app\.use\(\(err: unknown/.test(server)) return 'admin/server.ts hata yakalayıcı taşımıyor';
    return null;
  },
);

check(
  'panelde tarih elle yazılmıyor',
  'Başlangıç serbest metindi ve saat dilimiyle birlikte tam ISO isteniyordu. Saat ' +
    'dilimi unutulmuş bir dizge her okuyanın kendi diliminde başka bir an demek — ' +
    've hatırlatmalar o değere göre kuruluyor. Panelde yapılabilecek en pahalı ' +
    'yazım hatasıydı; artık yazılmıyor, seçiliyor.',
  () => {
    const views = read('admin/views.ts');
    if (/name="startsAt"/.test(views)) return 'form hâlâ tek parça startsAt alanı taşıyor';
    if (!/type="date" name="startsAtDate"/.test(views)) return 'başlangıç tarihi seçici değil';
    if (!/type="time" name="startsAtTime"/.test(views)) return 'başlangıç saati seçici değil';
    if (!/type="time" name="endsAt"/.test(views)) return 'bitiş saati seçici değil';
    // Seçicinin kendisi yetmez: ISO'yu sunucu kurmazsa saat dilimi yine forma
    // düşer.
    if (!/joinLocal\(date, time\)/.test(read('admin/server.ts'))) {
      return 'sunucu ISO’yu joinLocal ile kurmuyor';
    }
    return null;
  },
);

check(
  'her koleksiyonun bir kuralı var',
  'Kuralı yazılmamış koleksiyon, sonundaki "eşleşmeyen her şey kapalı" bloğuna ' +
    'düşer ve istemci "Missing or insufficient permissions" alır. Kod tarafında ' +
    'hiçbir şey hata vermez; hata ancak uygulama çalışırken görünür. Bu kontrol ' +
    'yayınlanıp yayınlanmadığını söyleyemez — onu yalnızca `npm run rules:deploy` ' +
    'yapar — ama kuralın hiç yazılmamış olduğunu söyler.',
  () => {
    const rules = read('firestore.rules');
    // COLLECTIONS'ın değerleri: `events: 'events',` gibi satırlar.
    const block = read('src/firebase.ts').match(/COLLECTIONS = \{([\s\S]*?)\}/)?.[1] ?? '';
    const names = [...block.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]);
    // Sayı değil, isim: regex tutmazsa `names` boş kalır ve kontrol hiçbir şey
    // bulmadığı için yeşil verirdi. Bu ikisi hiçbir zaman kaybolmayacak.
    if (!names.includes('events') || !names.includes('registrations')) {
      return `COLLECTIONS okunamadı (bulunan: ${names.join(', ') || 'hiçbiri'})`;
    }

    const missing = names.filter((n) => !new RegExp(`match /${n}/`).test(rules));
    return missing.length ? `firestore.rules kuralsız koleksiyon: ${missing.join(', ')}` : null;
  },
);

check(
  'kural yayınlama tek komut',
  'Kurallar konsola elle yapıştırılıyordu. Kural her değiştiğinde yeniden ' +
    'yapıştırmak gerekiyor ve yapıştırılanın depodakiyle aynı olduğunu hiçbir şey ' +
    'garanti etmiyordu — çekiliş blokları eklendiğinde uygulama tam olarak bu ' +
    'yüzden içerik okuyamadı.',
  () => {
    if (!pkg.scripts?.['rules:deploy']) return 'rules:deploy script’i yok';
    const deploy = read('scripts/deploy-rules.mjs');
    // Proje kimliği uygulamanınkiyle aynı kaynaktan gelmezse, kurallar doğru
    // projede yayınlanmış ama uygulama başka projeye bakıyor olabilir.
    if (!/EXPO_PUBLIC_FIREBASE_PROJECT_ID/.test(deploy)) {
      return 'proje kimliği uygulamanın kullandığı değişkenden okunmuyor';
    }
    if (!json('firebase.json').firestore?.rules) return 'firebase.json firestore.rules’a işaret etmiyor';
    return null;
  },
);

check(
  'servis hesabı anahtarları gitignore’lu',
  'Admin SDK anahtarı firestore.rules’u tamamen bypass eder. Depo public.',
  () => {
    const ignore = read('.gitignore');
    const missing = ['firebase-adminsdk', 'service-account', 'google-services.json'].filter(
      (p) => !ignore.includes(p),
    );
    return missing.length ? `.gitignore eksik desen: ${missing.join(', ')}` : null;
  },
);

check(
  'çekiliş beyanı iki ekranda da mount ediliyor',
  'Uygulama Guideline 5.3.1 yüzünden bir kez reddedildi: çekilişin kim ' +
    'tarafından düzenlendiği, katılımın ücretsiz olduğu ve Apple’ın sponsor ' +
    'olmadığı hiçbir yerde yazmıyordu. Bileşenin kendi testi var ama bir test ' +
    'onu ekrana kimsenin koymadığını göremez — reddi geri getirecek şey tam ' +
    'olarak bu satırın bir yeniden düzenlemede düşmesi.',
  () => {
    // Yorumları önce at: bu depoda bir guard üç kez kendi gerekçesini bulup
    // yeşil verdi. Aşağıdaki iki dosyanın yorumları da 5.3.1'i anlatıyor.
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    const missing = ['app/etkinlik/[id].tsx', 'app/cekilis/[id].tsx'].filter(
      (file) => !strip(read(file)).includes('<RaffleNotice'),
    );
    if (missing.length) return `RaffleNotice çizilmiyor: ${missing.join(', ')}`;

    // Kartın bağlantısı `/cekilis-kurallari`'na push ediyor. Rota stack'e
    // kayıtlı değilse bağlantı boş ekrana gider ve incelemeci kuralları
    // bulamaz — beyan varmış gibi görünür, olmaz.
    if (!strip(read('app/_layout.tsx')).includes('cekilis-kurallari')) {
      return 'app/_layout.tsx `cekilis-kurallari` rotasını kaydetmiyor';
    }
    if (!existsSync(join(root, 'app/cekilis-kurallari.tsx'))) {
      return 'app/cekilis-kurallari.tsx yok';
    }

    // Apple’ın cümlesi birebir isteniyor; yeniden yazılmış hâli beyanı doğru
    // ama incelemecinin aradığı kalıptan farklı yapar.
    // Yorumlar burada da atılıyor: cümleyi yalnızca bir açıklama satırında
    // bırakmak kontrolü yeşile boyardı — bu depoda üç kez böyle oldu.
    const legal = strip(read('src/raffleLegal.ts'));
    const sentence =
      'Apple bu çekilişin sponsoru değildir ve çekilişle hiçbir şekilde bağlantılı değildir.';
    if (!legal.includes(sentence)) return 'src/raffleLegal.ts Apple feragatini birebir taşımıyor';

    return null;
  },
);

check(
  'AI Gündem: ısıtma bağlı ve yapılandırma hatası doğru anlatılıyor',
  'İki ayrı sessiz arıza. (1) Zenginleştirme talep güdümlü: haber çekimi özet ' +
    'işi yaratmıyor, işi yaratan tek şey `request-enrichment`. Akıştaki ısıtma ' +
    'çağrısı düşerse bir haberi ilk açan herkes worker\'ın turunu beklemeye ' +
    'geri döner ve hiçbir test bunu göremez. (2) Yapılandırması olmadan çıkmış ' +
    'bir sürüm derlemesi, `unconfigured` dalı olmadan "bağlantını kontrol et" ' +
    'diyor — kullanıcıyı düzeltemeyeceği bir yere yollayıp gerçek sebebi ' +
    'gizliyor, ve sürüm derlemesinde konsol yok.',
  () => {
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const feed = strip(read('src/gundem/screens/FeedView.tsx'));

    if (!feed.includes('useEnrichmentWarmup(')) {
      return 'FeedView arka plan ısıtmasını çağırmıyor';
    }
    // Isıtma ve kapı bir çift: kapı olmadan yarım hazırlanmış haber akışa
    // giriyor, ısıtma olmadan kapı haberleri pencere dolana kadar saklıyor.
    if (!feed.includes('holdUnenriched(')) {
      return 'FeedView özetsiz haberi akışa girmekten alıkoymuyor';
    }
    if (!feed.includes("'unconfigured'")) {
      return 'FeedView yapılandırma hatasını ağ hatasından ayırmıyor';
    }
    if (!strip(read('src/gundem/data-access/unconfigured.ts')).includes("'unconfigured'")) {
      return 'unconfigured.ts hatayı `unconfigured` koduyla döndürmüyor';
    }
    return null;
  },
);

check(
  'otomatik bildirim panele bağlı',
  'Bildirim kararları (`src/pushPolicy.ts`) baştan sona testli, ama bir testin ' +
    'göremeyeceği şey panelin onları hiç çağırmaması. Çağrı düşerse yeni ' +
    'etkinlik yine sessizce yayımlanır — kimse hata görmez, sadece bildirim ' +
    'gelmez, ve gelmeyen bir bildirimin eksik olduğu belli olmaz. Aynı şekilde ' +
    'kuyruk zamanlayıcısı düşerse sessiz saatlerde biriken bildirimler ' +
    'sonsuza kadar bekler.',
  () => {
    const strip = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const server = strip(read('admin/server.ts'));

    const missing = [
      'decideNewEvent(',
      'decideCancelledEvent(',
      'decideRaffleResult(',
      'startPushFlusher(',
      'startAnnouncementPoller(',
    ].filter((call) => !server.includes(call));
    if (missing.length) return `admin/server.ts çağırmıyor: ${missing.join(', ')}`;

    // Elle gönderim ve otomatik gönderim aynı motoru kullanmak zorunda:
    // iki uygulama kategorileri ya da sessiz saatleri farklı yorumladığı gün
    // ayrışır, ve fark ancak birinin bildirimi almamasıyla görünür.
    if (!strip(read('scripts/send-push.ts')).includes("from '../admin/push'")) {
      return 'scripts/send-push.ts kendi gönderim mantığını taşıyor';
    }

    // Bülten bildirimi `{ tab: 'bulten' }` taşıyor; onu okuyan dal düşerse
    // dokunmak yine hiçbir yere gitmez.
    const app = strip(read('src/notifications.tsx'));
    if (!app.includes("'bulten'")) {
      return 'src/notifications.tsx bülten bildirimine dokunmayı ele almıyor';
    }
    // Duyuru push'u `announcementId` taşıyor; okuyan dal düşerse dokunmak
    // yine hiçbir yere gitmez. Aranan şey **rota**, alan adı değil:
    // `announcementId` tip anotasyonunda da geçiyor ve dal silindiğinde bu
    // kontrol yeşil kalıyordu — ölçüldü.
    if (!app.includes('/duyuru/')) {
      return 'src/notifications.tsx duyuru bildirimine dokunmayı ele almıyor';
    }
    return null;
  },
);

const failed = results.filter((r) => r.problem);

for (const r of results) {
  console.log(`${r.problem ? '✗' : '✓'} ${r.name}`);
  if (r.problem) console.log(`    ${r.problem}\n    neden: ${r.why}`);
}

console.log(
  failed.length
    ? `\n${failed.length}/${results.length} kontrol başarısız.`
    : `\n${results.length} kontrolün hepsi geçti.`,
);

process.exit(failed.length ? 1 : 0);
