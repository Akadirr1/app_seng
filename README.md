# KOÜ Yazılım Kulübü — mobil uygulama

Kocaeli Üniversitesi Yazılım Kulübü'nün etkinlik uygulaması. Expo (React Native) ile tek kod
tabanı; iOS ve Android'e aynı yerden çıkıyor.

Uygulama, `design-source/KOU Yazilim Kulubu App.dc.html` içindeki tasarım kanvasından
birebir uyarlandı.

## Ekranlar

| Ekran | Rota | Not |
| --- | --- | --- |
| Splash | `/` | 1.9 sn logo + pixel loader, sonra onboarding ya da ana sayfa |
| Onboarding | `/onboarding` | 3 sayfa, "Atla" ile geçilebilir, bir kez gösterilir |
| Ana sayfa | `/(tabs)` | İstatistikler, yaklaşan etkinlikler, kulüp duyuruları |
| Etkinlik takvimi | `/(tabs)/takvim` | Liste ve takvim (grid) görünümü |
| Etkinlik arşivi | `/(tabs)/arsiv` | Tarihi geçmiş etkinlikler, kategori filtresi, boş durum |
| AI Gündem | `/(tabs)/gundem` | Yapay zekâ haber akışı, günün bülteni, kaydedilenler |
| Haber detay | `/gundem/[id]` | Üç maddelik TR özet, Orijinal/Çeviri geçişi, kaydet |
| Haber arama | `/gundem/ara` | Başlık, kaynak ve kategoride arama; son aramalar |
| Bildirim ayarları | `/(tabs)/bildirim` | Ana anahtar, 6 kategori, hatırlatma, bülten saati, sessiz saatler |
| Etkinlik detay | `/etkinlik/[id]` | Hero, künye satırları, konuşmacı, kayıt CTA |
| Kayıt formu | `/kayit/[id]` | Ad soyad, öğrenci no (9 hane), bölüm, sınıf, KVKK |
| Kayıt başarılı | `/kayit-basarili` | Kayıt kodu ve dönüş aksiyonları |

Öne çıkan bir karta ya da akıştaki bir satıra dokunulduğunda, tasarımdaki gibi kısa bir
pixel "YUKLENIYOR" perdesi gösterilip detay açılır.

## Çalıştırma

```bash
npm install
```

```bash
npx expo start
```

> **Pull sonrası `npm ci`.** `git pull` yalnızca dosyaları güncelliyor;
> `node_modules` olduğu yerde kalıyor. Yeni bir bağımlılık eklendiyse Metro
> `Unable to resolve "…"` diyor ve bu, paketin depoda eksik olduğu gibi okunuyor —
> eksik olan kurulum. `npm run check:release` bu durumu adıyla söylüyor.

Telefonda denemek için Expo Go ile QR'ı okut. Simülatör/emülatör için `i` veya `a`.
Tarayıcıda hızlı bakmak için:

```bash
npx expo start --web
```

Tip kontrolü:

```bash
npm run typecheck
```

Yayın öncesi regresyon kontrolü:

```bash
npm run check:release
```

`scripts/check-release.mjs` içindeki kontrollerin **her biri bir kez gerçekten
başarısız olduğu için** orada — demo kaydının geri sızmasından, sürüm sayaçlarının
`app.json`'a geri kopyalanmasına, panelin sunucuda ayağa kalkamamasına kadar.
Sayısını buraya yazmıyoruz: bir önceki hâli "sekiz" diyordu ve çoktan otuzu
geçmişti. Listeyi görmek için betiği çalıştırın.

`npm run check:bundle` ayrı durur ve daha pahalıdır: web paketini derleyip
**içine** bakar. `EXPO_PUBLIC_*` değerleri derleme anında gömüldüğü için, kaynakta
görünmeyen bir sır pakette olabilir — ve gömülü bir JWT varsa yükünü çözüp
`anon` olduğunu doğrular. CI her PR'da çalıştırıyor.

Spekülatif kural eklemeyin. Bir regresyon kaçtığında onu yakalayan kontrolü ekleyin
ve **eklemeden önce kontrolün kırmızı olduğunu görün** — boş geçen bir assertion,
olmayan assertion'dan beterdir çünkü yeşil rapor verir.

## Proje yapısı

```
app/                 expo-router rotaları (dosya adı = rota)
  _layout.tsx        fontlar, store, yükleme perdesi, stack
  (tabs)/            alt sekmeli 5 ana ekran + özel tab bar
src/
  theme.ts           renk paleti, gradyanlar, tipografi, radius/spacing
  icons.ts           8×8 pixel ikon path'leri + onboarding pixel çizimleri
  data.ts            tipler, sabit listeler ve çevrimdışı yedek (içerik Firestore'da)
  content.tsx        Firestore'dan okuma + yerele düşme (useContent)
  firebase.ts        getDb, fetchContent, pushRegistration
  firebaseConfig.ts  .env okur, SDK import etmez
  store.tsx          kayıtlar + bildirim tercihleri (AsyncStorage ile kalıcı)
  components/        Txt, PixelIcon, PixelBadge, Toggle, Segmented, kart vb.
  notificationPlan.ts  ne zaman hangi bildirim kurulacak (saf; hatırlatma + bülten)
  gundem/            AI Gündem bölümü — ayrı Supabase projesi, kendi veri katmanı
                     (bkz. docs/ai-gundem-port.md)
scripts/             kontroller, kural yayınlama, push gönderimi, kayıt dışa aktarma
assets/brand/        kulüp rozeti ve laptop maskotu
design-source/       kaynak tasarım kanvası (referans)
```

### Tasarım kuralları

- **Renk:** 5 marka rengi `src/theme.ts` içindeki `palette`'te. Geri kalan nötrler `colors`'ta.
- **Tipografi:** Gövde, form ve butonlar Plus Jakarta Sans. Press Start 2P **yalnızca**
  rozet etiketleri, grup başlıkları, boş durum ve yükleme metninde — okunabilirlik önce.
- **Gradyanlar:** Tasarımdaki CSS gradyan durakları %100'ü aşıyordu (örn. `#0389BC 135%`).
  `theme.ts` içindeki bitiş renkleri bu yüzden ara değer olarak önceden hesaplandı.
- **Boşluk:** 4'ün katları, radius 8–16.

## Firebase

Ekranlar Firestore'a bağlı. İçerik Firestore'dan okunuyor, ulaşılamazsa `src/data.ts`
içindeki paketlenmiş kopyaya düşülüyor — böylece uygulama hiçbir durumda boş ekran
göstermiyor. Hangi kaynağın kullanıldığı `useContent().source` ile görülebilir.

### Kurulum (tek seferlik, 3 adım)

Firestore veritabanı oluşturulmuş durumda ama varsayılan kurallar her şeyi kapatıyor.
Veriyi yüklemek için:

```bash
npm install -g firebase-tools   # bir kez
firebase login                  # bir kez
npm run rules:deploy
```

Kurallar projede yayınlanana kadar Firestore kendi varsayılanını uygular ve o her
şeyi reddeder — uygulama `Missing or insufficient permissions` der. Dosya depoda
durduğu sürece hiçbir şey yapmaz.

İçerik yönetim panelinden giriliyor (`npm run admin`). Panel Admin SDK kullanıyor,
bu kuralları hiç görmüyor; yazmak için kural gevşetmek gerekmez.

### Neler bağlı

| Veri | Nereden |
| --- | --- |
| Etkinlikler | Firestore `events` → yoksa `src/data.ts` |
| Arşiv | Aynı `events` listesinin tarihi geçmiş yarısı (`splitByDate`) |
| Kayıtlar | Önce cihaza yazılır, sonra Firestore `registrations` |
| Kalan kontenjan | `events.capacity` − `eventSeats/{id}.seatIds.length` |
| Görseller | Firebase Storage → adresler `events.photos` içinde |
| Duyurular | `https://api.kouseng.com/announcements` |
| Bildirim tercihleri | Sadece cihaz (AsyncStorage) |

Kayıt akışı önce yerele yazıp ekranı anında açar, ardından Firestore'a gönderir. Yazma
başarısız olursa kayıt `synced: false` olarak işaretlenir — öğrenci kodunu yine görür.

### Dosyalar

- `.env` ve `.env.local` — gerçek değerler. **İkisi de git'e girmiyor.**
  Çakışırsa `.env.local` kazanıyor (Expo'nun sırası). Sunucu tarafı
  (`npm run admin`, `push`, `export`) `scripts/load-env.ts` üzerinden ikisini de
  okuyor — düz `dotenv/config` yalnızca `.env` okur ve `.env.local`'i sessizce
  yok sayar.
- `.env.example` — boş şablon, repoda duruyor.
- `src/firebaseConfig.ts` — sadece config okur, SDK import etmez.
- `src/firebase.ts` — `getDb()`, `fetchContent()`, `pushRegistration()` (kayıt + koltuk tek batch).
- `src/content.tsx` — `ContentProvider` + `useContent()`; Firestore/yerel geçişi burada.
- `scripts/deploy-rules.mjs` — `npm run rules:deploy`.
- `firestore.rules` — güvenlik kuralları. Depoda durması yetmez, yayınlanması gerekir.

Firestore SDK'sı açılış paketine dahil değil; dinamik import ile ilk okuma anında
yükleniyor (Metro logunda ayrı bir `src/firebase.ts (20 modules)` satırı olarak görünür).

```ts
import { getDb, COLLECTIONS } from '../src/firebase';
import { collection, getDocs } from 'firebase/firestore';

const snap = await getDocs(collection(getDb(), COLLECTIONS.events));
```

> **Güvenlik:** `EXPO_PUBLIC_*` değerleri derleme sırasında JS paketine gömülür, yani
> uygulamayı kuran herkes bunlara ulaşabilir. Firebase istemci config'i için bu normaldir —
> koruma **Firestore/Storage Security Rules** ile sağlanır, bu anahtarları saklayarak değil.
> Kuralları yazmadan üretime çıkmayın.

Analytics (`measurementId`) React Native'de çalışmaz; sadece web derlemesi için `.env`'de duruyor.

### Bildirimler nereden çıkıyor

| ne | nasıl | otomatik mi |
|---|---|---|
| Etkinlik hatırlatması | cihazda yerel, kayıt olunan etkinliğin saatinden geri sayarak | ✅ |
| AI Gündem bülteni | cihazda yerel, kullanıcının seçtiği saatte | ✅ |
| Yeni etkinlik / iptal / çekiliş sonucu | panel kaydettiği anda push | ✅ |
| Yeni duyuru | panel `api.kouseng.com`'u 15 dakikada bir yokluyor | ✅ |
| Serbest metinli duyuru | `npm run push -- --category ... --title ... --body ...` | elle |

Push'un çalışması için **panelin ayakta olması** gerekiyor: gönderen taraf o.
Panel kapalıyken kaydedilen bir etkinlik bildirim üretmez (kayıt yine yazılır).

Yerelde panel çalıştırırken gerçek kullanıcılara bildirim gitmesin istiyorsanız:

```bash
ADMIN_AUTO_PUSH=off npm run admin
```

Panel açılışta hangi modda olduğunu yazıyor. Duyuru yoklaması **ilk turda
hiçbir şey göndermez** — mevcut listeyi sessizce işaretler, bildirimler bir
sonraki gerçekten yeni duyuruyla başlar.

### Bildirim gelmedi, nereye bakılır

Panelde **Bildirimler** sayfası var (`/bildirimler`). Zincirin hangi halkasının
koptuğunu orada görürsünüz:

| sayfada gördüğünüz | anlamı |
|---|---|
| `Kayıtlı cihaz: 0` | hiçbir cihaz token yazmamış — uygulamayı bir kez açıp izin vermek gerekiyor; simülatörde ve Expo Go'da token hiç üretilmez |
| `Otomatik gönderim: KAPALI` | `ADMIN_AUTO_PUSH=off` tanımlı |
| Son gönderimler boş | panel ya yeni kodu çalıştırmıyor ya da hiç etkinlik kaydedilmedi |
| `0 gönderildi` | hedef vardı ama ulaşılamadı; satırdaki `başarısız` sayısına ve sunucu günlüğüne bakın |

**Test bildirimi** düğmesi deftere yazmadan gönderiyor, yani tekrar tekrar
denenebilir. Kategorisi açık olan her cihaza gider.

Panel açılışında görülmesi gereken satırlar:

```
Yönetim paneli: http://localhost:4000
[push] otomatik bildirim AÇIK. Kapatmak için ADMIN_AUTO_PUSH=off.
```

Bunlar yoksa panel yeni kodu çalıştırmıyor demektir.

> **Simülatörde push test edilemez.** iOS Simulator'da APNs yok, dolayısıyla
> token da yok — `requestPushToken` orada bilerek `null` dönüyor. Simülatörde
> çalışan tek şey **yerel** bildirimler (hatırlatma ve bülten). Uzaktan push
> için gerçek cihaz + development build ya da TestFlight gerekiyor; Expo Go
> SDK 53'ten beri uzaktan push'u desteklemiyor.

### EAS derlemelerinde

`.env` git'te olmadığı için EAS Build sunucusuna **gitmez**. Üretim derlemesinden önce
değişkenleri bir kez tanımlayın:

```bash
eas env:create --environment production --name EXPO_PUBLIC_FIREBASE_API_KEY --value "..." --visibility plaintext
```

Diğer altı değişken için de aynısını tekrarlayın. Tanımlanmazsa uygulama açılışta
`[firebase] ...` uyarısı verir ve `getDb()` hata fırlatır.

**AI Gündem bölümü için üç değişken daha var** ve bunlar Firebase'inkilerden
tamamen ayrı bir Supabase projesine bakıyor:

```bash
eas env:create --environment production --name EXPO_PUBLIC_AIGUNDEM_DATA_MODE       --value "supabase" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_AIGUNDEM_SUPABASE_URL    --value "https://<ref>.supabase.co" --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_AIGUNDEM_SUPABASE_ANON_KEY --value "..." --visibility plaintext
```

Tanımlanmazsa bölüm **sessizce fixture göstermez**: "yapılandırılmamış" durumuna
düşer ve ekranda hangi değişkenin eksik olduğunu söyler. Bu bilinçli — mock
verisi uydurma haber başlıkları ve mağaza sürümünde gerçek gibi görünürdü.

Aynısını `preview` için de yapın — dahili (ad-hoc) derlemeler o ortamı okuyor ve
`eas.json`'daki her profil `environment` alanını açıkça adlandırıyor:

```bash
eas env:create --environment preview --name EXPO_PUBLIC_AIGUNDEM_DATA_MODE --value "supabase" --visibility plaintext
# ...diğer ikisi
```

Ne girildiğini görmek için:

```bash
eas env:list --environment production
```

Bu liste değişkeni göstermiyorsa o derleme onsuz çıkmıştır — `.env`'de olması
hiçbir şey ifade etmez, `.env` EAS sunucusuna gitmiyor. Mağaza derlemesinde
"Güncel içeriğe ulaşılamadı" yerine **"AI Gündem yapılandırılmamış"** ve eksik
değişkenin adı çıkıyorsa, tam olarak bu olmuştur.

`SUPABASE_SERVICE_ROLE_KEY` bu üçlünün arasında **yok** ve olmayacak: o anahtar
panelin, sunucuda kalıyor. `npm run check:bundle` derlenmiş paketi tarayıp
sızmadığını doğruluyor — ve gömülü bir JWT varsa yükünü çözüp `anon` olduğuna
bakıyor, çünkü service_role anahtarı da bir JWT ve metin araması ikisini ayırt
edemiyor.

## Bildirimler

İki ayrı mekanizma, tek ayar ekranı (`app/(tabs)/bildirim.tsx`). Dört tercihin
dördü de artık gerçekten bir şey yapıyor.

**Hatırlatmalar — cihazda, sunucusuz.** Kayıtlı olduğun etkinliğin `startsAt`
değerinden geri sayılarak `expo-notifications` ile yerel olarak zamanlanır.
Sunucu, ağ, token gerekmez. Kullanıcının seçtiği süreyi (`1 saat` / `1 gün` /
`3 gün önce`) kullanır, sessiz saatler açıksa 23:00–08:00'e denk gelen
hatırlatmayı sabah 08:00'e kaydırır, kaydırınca etkinliğin kendisinden sonraya
düşüyorsa hiç kurmaz. Kayıt, tercih veya etkinlik listesi değiştiğinde tüm
program iptal edilip yeniden kurulur.

**Duyurular — push, kulüpten.** Cihaz `devices/{token}` dokümanına push token'ını
ve tercihlerini yazar; gönderim `npm run push` ile yapılır.

```bash
npm run push -- --category Duyuru --title "Başlık" --body "Metin"
npm run push -- --category Atölye --title "..." --body "..." --event ev2 --dry
```

`--event` bildirime dokununca açılacak etkinliği belirler, `--dry` kimseye
göndermeden kaç cihaza gideceğini gösterir. Script `master` kapalı olanları,
kategoriyi kapatmış olanları ve sessiz saatlerdekileri atlar; kaç cihazın hangi
sebeple elendiğini yazar. `DeviceNotRegistered` dönen token'ları (uygulamayı
kaldırmış kullanıcılar) koleksiyondan siler.

### Gerekenler

**Servis hesabı anahtarı** (sadece gönderici script için, uygulamaya girmez).
`devices` koleksiyonu istemciye kapalı — token listesi sızarsa herkes herkese
bildirim gönderebilir. Bu yüzden script Admin SDK kullanıyor. `.env.example`'daki
`FIREBASE_SERVICE_ACCOUNT` satırına bakın. **Bu anahtar güvenlik kurallarını
tamamen bypass eder; asla commit etmeyin, asla uygulamaya koymayın.**

**Mağaza kimlik bilgileri** — bunlar olmadan push cihaza ulaşmaz:

```bash
eas credentials   # Android: FCM V1 service account JSON
                  # iOS: APNs key (.p8) — EAS otomatik üretebilir
```

Push, Expo Go'da çalışmaz; development build veya production build gerekir.
Yerel hatırlatmalar Expo Go'da da çalışır.

## Yönetim paneli

Etkinlik girmek ve kayıtları görmek için küçük bir web paneli.

```bash
ADMIN_PASSWORD=uzun-ve-rastgele-bir-sey npm run admin
# http://localhost:4000
```

Parolayı `.env`'e koyabilirsiniz. **Tanımlı değilse panel başlamaz** — kayıtlara
erişiyor ve açık bir sunucuda çalışacak, varsayılan parolayla açılması doğru
olmaz. Servis hesabı anahtarı `npm run push` ile aynı.

### Neden var

Bir `ClubEvent` on yedi alan taşıyor ve bunların yarısı `startsAt` ile yerden
türeyen görüntü metinleri: tarih tilesi, hafta günü, ay başlığı, saat–yer satırı,
üç künye satırı. Firebase Console'dan elle girildiğinde ilk etkinlik
ertelendiğinde tarih bir alanda değişip diğer beşinde kalıyor — ve hiçbir yerde
hata çıkmıyor, sadece uygulamada yanlış tarih görünüyor.

Panel hiçbir şeyi iki kez sormuyor: tarih, bitiş saati ve yer alınıp gerisi
`src/eventSchema.ts` içindeki `buildEvent` ile türetiliyor. Aynı fonksiyon
doğrulamayı da yapıyor, dolayısıyla Firestore'a ulaşan her etkinlik uygulamanın
beklediği şekilde.

Reddedilen girdiler: saat dilimi olmayan tarih (`2026-03-12T18:00:00`), olmayan
gün (31 Şubat), başlangıçtan önceki bitiş saati, boş başlık, boşluk içeren
kimlik. `npm run check:schema` bunları ve türetilen metinlerin doğruluğunu
sınıyor.

### Panelin ortam değişkenleri

| Değişken | Zorunlu | Ne için |
| --- | --- | --- |
| `ADMIN_PASSWORD` | ✅ | Panel girişi. Tanımsızsa panel başlamaz. |
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | Admin SDK anahtarı. Yol, JSON ya da base64. |
| `SUPABASE_URL` | görseller için | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | görseller için | `sb_secret_…` — publishable **değil** |
| `SUPABASE_STORAGE_BUCKET` | hayır | Varsayılan `event-photos` |
| `ADMIN_PORT` | hayır | Varsayılan 4000. Boş ya da geçersizse platformun enjekte ettiği `PORT`'a, o da yoksa 4000'e düşer |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `rules:deploy` için | Kuralların hangi projeye gideceği |

Panelin **hiçbir `EXPO_PUBLIC_*` değişkene ihtiyacı yok** (kural yayınlama hariç),
uygulamanın da hiçbir panel değişkenine. İki taraf ayrı.

### Sunucuya koyarken

Panel HTTP konuşuyor; parola ve kayıtlar açık ağdan geçmemeli. Bir reverse proxy
arkasına koyup TLS'i orada sonlandırın, ya da yalnızca yerel ağdan erişilebilir
bırakın. Oturum çerezi `HttpOnly` ve `SameSite=Strict`; oturumlar bellekte
tutuluyor, yani yeniden başlatınca herkes düşer.

## Yoklama listesi — kayıtları CSV'ye çıkarma

```bash
npm run export                        # tüm kayıtlar, ekrana
npm run export -- --event ev2         # tek etkinlik
npm run export -- --out yoklama.csv   # dosyaya
```

`registrations` koleksiyonu `firestore.rules` gereği istemciye kapalı — kimse
başkasının başvurusunu okuyamamalı. Bu yüzden script `npm run push` ile aynı
servis hesabı anahtarını kullanıyor (`.env.example` içindeki
`FIREBASE_SERVICE_ACCOUNT`).

Çıktı öğrenci numarasına göre sıralı; yoklamada aranan alan o. Dosyaya yazarken
başa BOM konuyor, yoksa Excel UTF-8'i Windows-1254 sanıp Türkçe karakterleri
bozuyor.

## Arşiv paneli

`/arsiv` yalnızca tarihi geçmiş etkinlikleri listeliyor ve her satırda kaç görsel
olduğunu gösteriyor — sayfanın işi "hangi etkinliğin görseli eksik" sorusuna
bakmak. Takvimde bakılan soru "sırada ne var", ikisi bir aradayken ikisi de zor
okunuyordu.

Arşiv ayrı bir koleksiyon **değil**: `events` listesinin geçmiş yarısı. Bir
etkinlik kendi gününün ertesi sabahı arşive geçiyor, ayrıca bir şey yapmak
gerekmiyor.

- **Yeni arşiv kaydı** — uygulamadan önceki etkinlikler için. Tarihi geçmişte
  olmak zorunda; gelecek tarihli bir kayıt takvimde görünür ve kayıt kabul ederdi.
- **Var olan etkinlikten doldur** — alanları kopyalar, yeni bir kayıt oluşturur.
  Kimliği değiştirmek gerekiyor, yoksa var olanın üzerine yazar.
- Kontenjan, rozet ve son-gün alanları arşiv formunda **görünmüyor** (olmuş bir
  etkinlikte anlamsızlar) ama gizli alan olarak korunuyorlar — kaydetmek var olan
  değeri silmiyor.

## Görseller

Panelden yükleniyor, **Supabase Storage**'da duruyor. Etkinlik başına en fazla
altı görsel: ilki kapak (arşiv kartı ve etkinlik detayının üstü), kalanı
detaydaki galeri. Tek görsel varsa galeri hiç çıkmıyor.

Yüklenen dosya 1600 px'e küçültülüp JPEG'e çevriliyor — telefondan çıktığı gibi
atılabilir. Uygulama hiçbir depolama SDK'sı kullanmıyor; elinde bir adres var ve
`<Image>` ile çekiyor.

### Neden Firebase Storage değil

Cloud Storage, 2024 sonrası açılan projelerde **Blaze planı** istiyor. Elli arşiv
fotoğrafı için kart bağlamanın anlamı yok. Supabase ücretsiz katmanında 1 GB
veriyor ve kart istemiyor.

Firestore hâlâ Firebase'de: etkinlikler, kayıtlar, çekilişler, cihaz kayıtları.
Supabase **yalnızca dosyaları** tutuyor. İki servis biraz çirkin ama alternatifi
ücretsiz depolama için tüm veri katmanını yeniden yazmaktı.

### Kurulum

1. Supabase Dashboard → **Storage → New bucket**
   - Ad: `event-photos`
   - **Public bucket: açık** (uygulama görselleri adresle çekiyor)
2. Project Settings → **API Keys → Secret keys → Reveal** → `.env.local`:
   ```
   SUPABASE_URL=https://<proje-ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   ```
   **`sb_publishable_…` değil.** O anahtar istemciye gömülmek için var: okur,
   yazamaz. Panel yanlış türü ilk istekten önce yakalayıp söylüyor — yoksa
   Supabase "row-level security policy" der ve asıl sebebi hiç söylemez.

`service_role` anahtarı Firebase servis hesabı anahtarıyla aynı sınıfta: RLS'i
tamamen aşar, `EXPO_PUBLIC_` öneki almaz, uygulamaya girmez. `.env.local`
gitignore'lu.

Bucket yoksa ya da anahtarlar eksikse panel ne yapılması gerektiğini yazıyor —
jenerik bir hata sayfası değil.

## Kalan işler

1. **Mağaza ekran görüntüleri** ve EAS build/submit.

## Mağazaya çıkarma

### Build'e hangi değerler giriyor

`EXPO_PUBLIC_*` olan her şey **derleme anında JS paketine yazılıyor** — ölçüldü.
Öneki olmayan hiçbir şey girmiyor. Uygulamanın okuduğu tek grup:

```
EXPO_PUBLIC_FIREBASE_API_KEY / APP_ID / AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID / PROJECT_ID / STORAGE_BUCKET
```

Supabase ve panel değişkenlerinin EAS'te **işi yok**: uygulama Supabase'e hiç
bağlanmıyor, görsel adreslerini Firestore'dan hazır alıyor.

`.env` gitignore'lu, dolayısıyla EAS Build sunucusuna **çıkmıyor**. Değerler
`eas env:create --environment production` ile EAS'e girilmeli; her profil hangi
ortamı kullandığını `eas.json` içinde açıkça söylüyor.

Sonuç: **anahtar değiştirmek yeni build gerektiriyor.** Sunucudaki gibi env
değiştirip yeniden başlatmak yok.

Değişkenler eksikse uygulama artık boş açılmıyor — ekranda "Uygulama
yapılandırması eksik" çıkıyor. Release'de konsol olmadığı için bunu görmenin
başka yolu yok.



`eas.json` hazır: `development` (simülatör), `preview` (dahili APK), `production`
(App Store / Play Store).

**Önce yapılması gerekenler:**

- Uygulama kimliği her iki platformda da **`com.akadirr1.sengkou`**. App Store Connect
  ve Play Console'da bu kimlikle kayıtlı. **İlk yayından sonra değiştirilemez** —
  değiştirmek yeni bir uygulama açmak, kullanıcıları ve yorumları sıfırlamak demektir.
- Apple Developer ($99/yıl) ve Google Play Console ($25 tek seferlik) hesapları.
- Gizlilik politikası URL'si — her iki mağazanın gizlilik alanına da bu yazılacak:
  https://kou-yazilim-kulubu-gizlilik.akadirr41.chatgpt.site
  Uygulamada `src/data.ts` içindeki `PRIVACY_POLICY_URL` sabitinde duruyor ve kayıt
  formundaki onay satırının altından açılıyor. Adres değişirse iki yeri de güncelleyin.

```bash
npm install -g eas-cli && eas login && eas build:configure
```

Üretim derlemesi:

```bash
eas build --platform all --profile production
```

Mağazaya gönderim:

```bash
eas submit --platform ios --profile production
```

```bash
eas submit --platform android --profile production
```

### Sürüm numaraları

İki ayrı sayı var ve karıştırılmaları en sık yapılan hata:

| | nedir | nerede | kim artırıyor |
|---|---|---|---|
| **Sürüm** (`version`) | kullanıcıya görünen — `1.1.1` | `app.json` | **elle** |
| **Build numarası** | mağazanın yükleme kimliği — `buildNumber` / `versionCode` | EAS sunucusu | otomatik |

Build numarası ve versionCode **EAS sunucusunda** tutulur (`appVersionSource: "remote"`),
`app.json`'da bilerek yok — `production` profilinde her derlemede otomatik artar. Böylece
"yerelde arttı ama commit'lemeyi unuttum, mağaza aynı numarayı reddetti" tuzağı ortadan
kalkar.

#### Sürüm ne zaman elle artırılır

`app.json`'daki `version`, mağazada **yayımlanmış** bir sürümün üzerine yeni bir sürüm
çıkarırken artırılır. Aynı sürümün TestFlight/internal test derlemeleri artırmayı
gerektirmez — onlar için build numarası zaten değişiyor.

Üç yerde birden: `app.json`, `package.json`, `package-lock.json`. `check:release`
ilk ikisinin eşit olduğunu doğruluyor.

#### "Otomatik artsın" isteniyorsa

`autoIncrement` platform bazında sürümü de artırabiliyor (`@expo/eas-json`
şemasından: ortak alan yalnızca `boolean`, `android` `'version' | 'versionCode'`,
`ios` `'version' | 'buildNumber'` de kabul ediyor):

```jsonc
"production": {
  "ios":     { "autoIncrement": "version" },
  "android": { "autoIncrement": "version" }
}
```

**Bilerek açılmadı.** Sürüm bir ürün kararı: aynı sürümün beş TestFlight derlemesini
alınca 1.1.5'e çıkmak istemezsiniz, ve `appVersionSource: "remote"` ile sayı EAS'a
taşındığı için depoya bakan biri artık hangi sürümün canlıda olduğunu göremez.
Unutmamak için doğru yer bu tablo, otomatik bir sayaç değil.

> **Uzaktan sayacı bir kez tohumlayın.** Yerel değerler kaldırıldığı için EAS'ın içe
> aktaracağı bir şey yok; tohumlamazsanız sayaç 1'den başlar ve Play, versionCode 3
> zaten yüklü olduğu için gönderimi **reddeder**. İlk uzaktan derlemeden önce bir kez:
>
> ```bash
> eas build:version:set --platform ios      # 5 girin  → sonraki derleme 6 üretir
> eas build:version:set --platform android  # 3 girin  → sonraki derleme 4 üretir
> ```
>
> Bunlar mağazalara en son gönderilmiş numaralar. `autoIncrement` üzerine ekleyerek gider.

`eas submit` iOS tarafı bilerek yapılandırılmadı; Apple bilgilerini komut interaktif
olarak soracak.

### İkonlar ve mağaza görselleri

`assets/icon.png`, `assets/android-icon-*.png`, `assets/splash-icon.png` kulüp rozetinden
üretildi.

Türetilmiş olanlar `scripts/make-icons.py` ile yeniden üretilebilir — rozet değişirse
`assets/brand/logo.png` dosyasını değiştirip script'i çalıştırmak yeterli:

```bash
pip install pillow          # ya da: uv pip install pillow
python3 scripts/make-icons.py
```

| Dosya | Boyut | Nerede kullanılıyor |
|---|---|---|
| `assets/notification-icon.png` | 96×96 | Android bildirim ikonu (`app.json`'dan bağlı) |
| `assets/store/play-icon-512.png` | 512×512 | Play Console mağaza ikonu |
| `assets/store/play-feature-graphic.png` | 1024×500 | Play Console feature graphic |

Pillow bilerek `package.json`'a eklenmedi; bu script derleme adımı değil, rozet
değişmediği sürece hiç çalıştırılmaz.

Bildirim ikonu kelime işaretinin tamamını değil **sadece "KOÜ" satırını** taşıyor.
Sebebi ölçüldü: bildirim ikonu durum çubuğunda 24dp görünür, üç satırın tamamı o
boyutta gri bir lekeye dönüşüyor. İki aday üretilip 24dp'ye küçültülerek
karşılaştırıldı; tek satır kalın harf okunur kalan tek seçenek.

Play'e yüklenecek ekran görüntüleri repoda yok, yayın sırasında alınacak.

## Yerelde native derleme (opsiyonel)

`npx expo run:ios` / `npx expo run:android` tam native derleme yapar. iOS için **Xcode**
(sadece Command Line Tools yetmez) ve CocoaPods gerekir. EAS Build kullanıyorsanız bunlara
gerek yok — derleme bulutta yapılır.
