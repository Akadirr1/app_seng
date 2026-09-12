# Giriş sistemi, QR yoklama, sertifika — araştırma ve plan

Uygulama App Store'da **girişsiz** yayında (1.1.2). Hedeflenen üç özellik: QR ile
yoklama, QR ile çekilişe katılma, yoklamaya katılana dijital sertifika.

Bu belge iki şeyi ayırıyor: **mağazaların gerçekten şart koştuğu** (birincil
kaynaktan doğrulandı) ile **bu deponun kodunda ölçülen** teknik gerçekler.
Doğrulanmamış hiçbir şey buraya yazılmadı.

---

## 0. Önce itiraz: üç özelliğin hiçbiri giriş gerektirmiyor

Talep "bunları yapmadan önce login lazım" şeklinde geldi. Kod bunu desteklemiyor:

Kayıt akışı **zaten kimlik taşıyor**. `registrations/{eventId}__{studentNo}`
dokümanı ad, öğrenci numarası, bölüm, sınıf ve bir `code` tutuyor; doküman
kimliği bir öğrencinin aynı etkinliğe iki kez yazılmasını hâlihazırda
engelliyor (bkz. AGENTS.md, "Bir doküman kimliği bir benzersizlik kuralı
taşıyabilir"). Yoklamada cevaplanması gereken soru "bu kişi kim" değil, "bu
kişi kayıtlı mı ve kapıdan geçti mi" — ikisinin de cevabı elde.

Girişin gerçekte satın aldığı şey başka ve daha dar:

| Kazanım | Bugün ne oluyor |
|---|---|
| Kayıtlar cihaz değişince kaybolmuyor | Kayıtlar AsyncStorage'da; Firestore'a **yalnızca yazılıyor** (`allow read: if false`). Telefon değişti mi kayıt gitti. |
| Çekilişte cihazlar arası tekillik | Şu an çekiliş katılımı **yalnızca aynı cihazda** engelleniyor (`makeEntryId` rastgele). AGENTS.md bunu zaten kurallar sayfasına yazmamanın gerekçesi olarak anıyor. |
| Sertifikaya sonradan erişim | Sertifika yerel kalırsa uygulama silinince gider. |

Yani doğru cümle "QR için login lazım" değil, **"kayıtların cihazdan bağımsız
olması için login lazım"**. Bu meşru bir ürün kararı, ama sıralamayı değiştirir:
QR yoklama ve sertifika **girişsiz de bugün yapılabilir**, giriş ise kendi
başına ve kendi gerekçesiyle ele alınabilir.

Aşağıdaki plan ikisini ayrı faz olarak veriyor. Yine de "önce login" denirse
Faz 2 ve 3'ün sırası değiştirilir; teknik içerik aynı kalır.

---

## 1. Apple ve Google gerçekte ne şart koşuyor

### 1.1 Sign in with Apple zorunlu değil — bir şartla

Yaygın inanışın aksine Apple, Apple hesabıyla girişi **her uygulamadan**
istemiyor. Guideline 4.8'in birebir metni:

> Apps that use a third-party or social login service (such as Facebook Login,
> Google Sign-In, Log in with X, …) to set up or authenticate the user's primary
> account with the app must also offer as an equivalent option another login
> service with the following features: […]
>
> Another login service is **not** required if:
> * **Your app exclusively uses your company's own account setup and sign-in systems.**
> * […]
> * Your app is an education, enterprise, or business app that requires the user
>   to sign in with an existing education or enterprise account.
> * […]

Sonuç, ve bu planın en önemli kararı:

- **Yalnızca kendi hesap sistemimizi sunarsak (e-posta + parola), Sign in with
  Apple zorunlu değildir.**
- **Google ile Giriş'i eklediğimiz an Sign in with Apple zorunlu hâle gelir.**
  İkisi bir pakettir; "önce Google'ı koyalım, Apple'ı sonra" diye bir yol yok,
  o hâliyle 4.8'den ret gelir.

Üçüncü bir ihtimal: KOÜ'nün kendi hesabıyla giriş (education account
istisnası). Kulüp üniversitenin kendisi olmadığı için bu istisnaya dayanmak
risklidir; @kocaeli.edu.tr adresine e-posta doğrulaması ise "kendi hesap
sistemimiz" kalır ve istisnaya hiç ihtiyaç duymaz.

### 1.2 Apple girişi dayatmamızı da istemiyor

Guideline 5.1.1(v), birebir:

> **If your app doesn't include significant account-based features, let people
> use it without a login.** […] Apps may not require users to enter personal
> information to function, except when directly relevant to the core
> functionality of the app or required by law.

Yani **takvim, arşiv, duyurular ve AI Gündem giriş duvarının arkasına
konulamaz.** Giriş yalnızca hesap gerektiren işlere (kayıt, çekiliş, sertifika)
kapı olabilir. Bu, "açılışta login ekranı" tasarımını doğrudan eler.

### 1.3 Hesap silme — Apple

Hesap oluşturmayı destekleyen uygulama, silmeyi de sunmak zorunda (2022-06-30'dan
beri). Apple'ın destek sayfasından doğrulananlar:

- Silme **uygulama içinden başlatılabilmeli**, tipik olarak hesap ayarlarında.
  "Bize e-posta atın" kabul edilmiyor; telefon/e-posta/destek akışı dayatmak
  yalnızca yüksek düzenlemeye tabi sektörlere tanınmış.
- Web sayfasına yönlendirme serbest, ama **doğrudan** o sayfaya link verilmeli.
- **Tüm hesap kaydı ve ilişkili kişisel veri** silinmeli; "geçici olarak devre
  dışı bırakma yeterli değildir".
- Silme **anında olmak zorunda değil**: süre kullanıcıya bildirilirse gecikmeli
  silme kabul ediliyor, ama tamamlandığında **onay verilmeli**.
- Yeniden kimlik doğrulama, e-posta/SMS kodu ve onay adımı serbest; "gereksiz
  yere zorlaştıran" akışlar reddediliyor.
- Yasa gereği saklanan veri varsa **kullanıcıya söylenmeli**.
- Sign in with Apple kullanılıyorsa token'lar REST API ile **revoke** edilmeli.
  (Bizde SIWA yoksa bu madde düşüyor.)

### 1.4 Hesap silme — Google Play

Play'in veri silme politikası Apple'dan **bir adım fazlasını** istiyor:

- Uygulama içi silme yolu **ve** uygulamaya erişemeyenler için **web'den
  erişilebilir bir silme adresi**. Adres çalışır olmalı, kapsamı doğru olmalı,
  hesap silme sayfada **belirgin** olmalı ve uygulama/geliştirici adını
  anmalı.
- Bu adres Play Console'da **Data safety formunda** beyan ediliyor.
- Güvenlik, dolandırıcılık önleme veya mevzuat gereği saklanan veri varsa
  gizlilik politikasında anlatılmalı.
- Tarihler geçti (2023-12-07 / 2024-05-31 uzatma); bugün **yürürlükte ve
  yaptırımlı**.

**Bizim için pratik sonuç:** panel zaten Coolify'da bir alan adında HTTPS ile
koşuyor. Silme sayfası oraya bir rota olarak eklenir; ayrı bir site gerekmiyor.

### 1.5 Bunlara ek olarak bizim tarafta değişecekler

- App Store **privacy nutrition label** ve Play **Data safety** formu: "Contact
  Info → e-posta" ve "Identifiers → User ID" eklenecek. Hesap eklemek bu iki
  formu yanlış hâle getirir, güncellenmemesi tek başına ret sebebi.
- Gizlilik politikası (`PRIVACY_POLICY_URL` uygulamada zaten var): hesap,
  saklama süresi ve silme anlatılacak.
- KVKK: ad ve öğrenci numarası kişisel veri; aydınlatma metni hesap kurulumunda
  da gösterilmeli. Sertifikada ad yazacağı için sertifika üretimi de aydınlatma
  kapsamına giriyor.

---

## 2. Kimlik sağlayıcı kararı

**Karar: Firebase Auth, yalnızca e-posta + parola.**

Gerekçe, sırayla:

1. Korunacak veri Firestore'da ve **tek güvenlik modeli Firestore kuralları**.
   Kurallar `request.auth.uid` konuşuyor; başka bir sağlayıcının JWT'si orada
   hiçbir şey ifade etmiyor. Supabase Auth zaten depoda (`@supabase/supabase-js`
   AI Gündem için kurulu) ama Firestore'u açamaz; köprü kurmak iki kimlik
   sistemi bakmak demek — yapılmayacak.
2. Google/Apple sosyal giriş eklenmediği sürece **Sign in with Apple borcu
   doğmuyor** (bkz. 1.1). Bu, `expo-apple-authentication`, entitlement, prebuild
   ve Android tarafında web akışı demek olan bir iş kaleminin tamamını siliyor.
3. Parola sıfırlama Firebase'in **kendi barındırdığı** sayfayla çalışıyor;
   uygulamaya derin bağlantı gerekmiyor.

**E-posta bağlantılı (passwordless) giriş bilerek elendi.** Firebase Dynamic
Links **25 Ağustos 2025'te kapandı**; e-posta bağlantısıyla giriş artık
Universal Links / App Links kurulumu istiyor — alan adında `apple-app-site-association`
ve `assetlinks.json` barındırmak, associated-domains entitlement'ı, prebuild
yapılandırması. Parolayı ortadan kaldırmanın bedeli bu; şimdilik değmez.

**Anonim giriş bir ara adım olarak değerli:** UI'ı hiç değiştirmeden
`request.auth.uid != null` şartını kurallara sokar ve AGENTS.md'de "tasarımsal
açık" diye kayıtlı kayıt-spam'ini daraltır. Faz 1'e alındı.

**App Check ayrıca yapılmalı ve giriş onun yerine geçmez.** Spam'in gerçek
cevabı App Check; ücretsiz ve girişten bağımsız.

---

## 3. Ölçülen teknik tuzaklar

Hepsi bu depoda, kurulu sürümlerle ölçüldü. Tahmin değil.

### 3.1 `firebase/auth` React Native'de yanlış derlemeye çözülüyor

`firebase` 12.17.1'in `./auth` ihracat haritasında **`react-native` koşulu
yok**:

```
"./auth": { "types": …, "node": {…}, "browser": {…}, "default": … }
```

Metro bu yüzden **browser** derlemesini alıyor. Browser derlemesinin varsayılan
kalıcılığı `browserLocalPersistence`, yani `localStorage` — React Native'de yok.
Sonuç: **oturum bellekte kalır ve uygulama kapanınca düşer.** Kullanıcı her
açılışta yeniden giriş yapar ve bu bir hata olarak değil "uygulama beni
unutuyor" diye bildirilir.

`getReactNativePersistence` yalnızca RN derlemesinde (`dist/rn/index.rn.d.ts`)
tanımlı. İki import da bu depoda **typecheck'i kırıyor**, ölçüldü:

```
firebase/auth   → error TS2305: has no exported member 'getReactNativePersistence'
@firebase/auth  → error TS2305: aynı hata
```

Sebep: iki paketin de `exports` haritasında `"types"` anahtarı `"react-native"`
koşulundan **önce** geliyor, TypeScript ilk eşleşeni alıyor ve paylaşılan
`auth-public.d.ts`'e düşüyor. `customConditions: ["react-native"]` (Expo
tabanından geliyor) bunu değiştirmiyor.

→ **Faz 1'in ilk işi bir spike:** oturum gerçekten yeniden açılışta duruyor mu.
Ölçülmeden hiçbir şey yazılmayacak. Elde üç yol var: RN derlemesini açıkça
import etmek, `Persistence` sözleşmesini AsyncStorage üzerinde birkaç satırla
kendimiz sağlamak, ya da `@react-native-firebase/auth`'a geçmek (native modül,
prebuild ve `google-services.json` demek — son çare).

Bu tuzağın "çalışıyor gibi görünüp sessizce bozulan" cinsten olduğunu not
düşmek gerekiyor: geliştirme sırasında fark edilmez, çünkü Expo'da uygulama
sürekli yeniden yükleniyor.

### 3.2 Cloud Functions yok — proje Spark planında

AGENTS.md kayıtlı: Firebase Storage Blaze istediği için görseller Supabase'e
taşındı. Aynı sebeple **Cloud Functions da yok.** Bu, "hesap silinince
Firestore'daki verisini temizle" için standart çözümün (Auth `onDelete`
tetikleyicisi) kullanılamayacağı anlamına geliyor.

**Karşılığı zaten elimizde:** panel bir sunucu, Admin SDK'sı var ve içinde iki
zamanlayıcı çalışıyor (`startPushFlusher`, `startAnnouncementPoller`). Silme
üçüncü bir yoklayıcı olarak aynı desene giriyor.

### 3.3 Depoda olmayanlar

QR için kamera/barkod paketi yok (`expo-camera` gerekecek — **ama aşağıdaki
tasarımda uygulamaya değil, panele**), `expo-apple-authentication` yok (2.
bölümün kararıyla gerekmiyor). `expo-crypto`, `expo-linking` ve AsyncStorage
2.2.0 kurulu.

---

## 4. QR yoklama tasarımı — tarayıcı kimde olmalı

İki model var ve seçim güvenliği belirliyor.

**(A) Etkinlik QR'ı ekranda, öğrenci okutur.** Kapıda/projeksiyonda bir kod
durur. Sorun: kodu fotoğraflayıp WhatsApp'a atan biri **salonda olmayan** herkesi
yoklamaya sokar. Kapatmak için kodun 30 saniyede bir dönmesi (HMAC + zaman
dilimi) gerekir, ve onu **doğrulayacak yer yok**: Firestore kuralları HMAC
hesaplayamaz, Cloud Functions da yok. Doğrulama panele kayar, yani yazma
"beklemede" girip sonradan onaylanır.

**(B) Öğrencinin QR'ı telefonunda, görevli okutur. ← önerilen**
Öğrencinin kaydı zaten bir `code` ve rastgele bir `seatId` taşıyor; QR bunu
gösterir. Görevli paneli telefonunda açar, kamerayla okutur, panel Admin SDK ile
yoklamayı yazar.

(B) neden daha ucuz **ve** daha güvenli:

- Paylaşma sorunu yok: tarayıcı görevlide, öğrenci salonda olmak zorunda.
- Uygulamaya kamera izni, `expo-camera`, yeni bir native modül **girmiyor**.
  QR çizmek saf hesap; okuma tarafı panelde tarayıcının kendi API'si.
- Yeni Firestore kuralı yok — yazan taraf Admin SDK, kuralları hiç görmüyor.
- Blaze gerekmiyor.
- **Giriş gerekmiyor.** Bugünkü kayıt kaydıyla çalışır.

Bedeli: görevlinin panelin açık olduğu bir telefonu olmalı ve kamera HTTPS
istiyor — panel zaten HTTPS'te.

**Çekilişe QR ile katılma bunun üstüne ayrı bir mekanizma değil:** okutulan
katılımcı yoklamaya girer, çekiliş katılımı yoklamadan türer. "Etkinliğe geldi"
ile "çekilişe katıldı" aynı olay olduğunda ikinci bir QR akışı yazmaya gerek
kalmıyor. Çekilişin ayrı form alanları isteniyorsa (bugünkü `raffles` tanımı)
form uygulamada doldurulmaya devam eder, QR yalnızca "geldi"yi işaretler.

**Sertifika:** yoklama kaydından türer. En ucuz teslim, uygulamada bir sertifika
ekranı + panelde `/dogrula/<kod>` doğrulama sayfası. Görsel üretimi gerekiyorsa
`sharp` zaten kurulu (SVG → PNG); **PDF yazılmayacak**, kulüp basılabilir dosya
isteyene kadar.

---

## 5. Fazlar

Her fazın kendi durma koşulu ve **kırılıp kırmızı verdiği görülmüş** en az bir
kontrolü var (AGENTS.md kuralı: iddia edilemeyen bir kontrol yeşil rapor eder).

### Faz 0 — giriş olmadan yapılabilecekler (önerilen ilk iş)
- App Check'i aç (ücretsiz, kayıt spam'ini daraltır).
- Panel tarafında QR tarayıcı + `attendance` koleksiyonu (Admin SDK yazar).
- Uygulamada kayıt kartında QR gösterimi.
- Sertifika ekranı + panelde doğrulama rotası.
- **Durma koşulu:** bir etkinlikte gerçek yoklama alınabiliyor.
- **Kontrol:** `check:panel`'e yoklama yazımının aynı kaydı iki kez saymadığı
  iddiası.

### Faz 1 — kimlik altyapısı (UI yok)
- Oturum kalıcılığı spike'ı (§3.1). **Bu bitmeden UI yazılmayacak.**
- Firebase Auth e-posta + parola açılır; anonim giriş ara adım olarak.
- Kurallara `request.auth.uid != null` girer; `registrations` ve `raffleEntries`
  dokümanlarına `uid` alanı eklenir (kurallar alanı zorunlu kılar).
- **Durma koşulu:** uygulama kapanıp açıldığında oturum duruyor, ölçülmüş.
- **Kontrol:** `check:release`'e kural bloğu iddiası (`rulesBlock()` deseni
  zaten var).

### Faz 2 — giriş ve hesap ekranı
- Kayıt ol / giriş / parola sıfırlama. **Girişsiz gezinme korunur** (§1.2):
  kapı yalnızca kayıt, çekiliş ve sertifikada.
- Ayarlarda "Hesabımı sil" — uygulama içinden başlatılır, yeniden kimlik
  doğrulama ister, süre bildirir, bittiğinde onay gösterir (§1.3).
- Panelde silme yoklayıcısı (§3.2) + Play için web silme sayfası (§1.4).
- Store formları ve gizlilik politikası güncellenir (§1.5).
- **Durma koşulu:** silme talebi uçtan uca çalışıyor ve onay dönüyor.
- **Kontrol:** silme yoklayıcısının kullanıcının **bütün** koleksiyonlarına
  dokunduğu; bir koleksiyon listeden düşünce kırmızı vermeli.

### Faz 3 — girişin gerçek kazanımı
- Kayıtlar cihazdan bağımsız okunur (`registrations` için `uid` bazlı okuma
  kuralı), çekilişte cihazlar arası tekillik, sertifikaya her cihazdan erişim.
- **Durma koşulu:** telefon değiştiren öğrenci kayıtlarını görüyor.

### Yapılmayacaklar (şimdilik)
- Google / Apple ile giriş — 4.8 borcunu doğurur (§1.1), kazanımı konfor.
- E-posta bağlantılı giriş — Dynamic Links kapandı (§2).
- PDF sertifika — istenene kadar.
- Cloud Functions'a dayanan hiçbir tasarım — plan Blaze gerektirmiyor.

---

## 6. Karar bekleyen sorular

1. **Sıralama:** Faz 0 önce mi (QR bugün çalışır, login sonra), yoksa ısrar
   edildiği gibi login önce mi? Teknik içerik değişmiyor, teslim süresi
   değişiyor.
2. **E-posta kısıtı:** yalnızca `@kocaeli.edu.tr` mi kabul edilecek? Öğrenciliği
   doğrular ve çekilişi ciddi biçimde temizler; mezun/dışarıdan katılımcıyı
   dışarıda bırakır.
3. **Mevcut kayıtların göçü:** bugünkü kayıtların sahibi yok. Öğrenci numarasına
   bakıp sahiplendirmek, numarayı bilen herkese başkasının kaydını verir —
   **önerilmiyor**. Öneri: eski kayıtlar yerelde kalır, yeni olanlar `uid`
   taşır, göç yapılmaz.
4. **Sertifikayı kim imzalar:** doğrulama kodu panelde mi üretilir, yoksa
   sertifika üzerinde kulüp imzası/QR'ı mı olacak?
