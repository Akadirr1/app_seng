# Giriş sistemi, QR yoklama, sertifika — son plan

Uygulama App Store'da **girişsiz** yayında (1.1.2). Hedef: hesap sistemi, ardından
QR ile yoklama, QR ile çekilişe katılma ve katılana dijital sertifika.

Bu belge iki şeyi ayırıyor: **mağazaların gerçekten şart koştuğu** (birincil
kaynaktan doğrulandı) ile **bu deponun kodunda ölçülen** teknik gerçekler.
Doğrulanmamış hiçbir şey buraya yazılmadı; ölçülemeyen yerler öyle işaretlendi.

---

## 1. Verilmiş kararlar

Bunlar tartışma değil, girdi. Planın geri kalanı bunların üstüne kuruldu.

| # | Karar | Sonucu |
|---|---|---|
| 1 | **E-posta alan adı kısıtı yok.** Herkes kayıt olabilir. | Öğrencilik doğrulaması e-postadan gelmiyor; yerine öğrenci numarası tekilliği + e-posta doğrulaması konuyor (§4). |
| 2 | **Giriş yalnızca "Etkinliğe katıl" düğmesinde zorunlu.** | Takvim, arşiv, duyurular, AI Gündem girişsiz kalıyor. Guideline 5.1.1(v) ile birebir uyumlu (§3.2). |
| 3 | **Profil bilgileri kayıt formuna otomatik akıyor.** Ad soyad, öğrenci numarası, e-posta bir kez girilir. | Form üç alan yerine onay ekranına iner; kimlik artık hesaba **bağlı** (§4). |
| 4 | **Site yayınlanacak; hesap silme sayfası orada, girişin arkasında.** | Play'in web silme adresi şartı karşılanıyor (§3.4, §6). |
| 5 | **Sıralama: önce hesap sistemi, sonra QR ve sertifika.** | QR akışı kayıt kaydının üstüne oturduğu için hesaplı kayıt önce geliyor. |

Ayrıca iki soru cevapsız kaldığı için **öneri olarak karara bağlandı**, itiraz
gelirse değişir:

- **Mevcut kayıtlar göç ettirilmiyor.** Bugünkü kayıtların sahibi yok; öğrenci
  numarasına bakıp sahiplendirmek, numarayı bilen herkese başkasının kaydını
  verirdi. Eski kayıtlar yerelde kalır, yenileri `uid` taşır.
- **Sertifikayı panel imzalar.** Üzerinde doğrulama kodu ve sitedeki
  `/dogrula/<kod>` adresine giden bir QR olur.

---

## 2. Bu tasarım neyi güvence altına alıyor, neyi almıyor

Karar 3'ün gerekçesi "güvenlik üst düzey olur" idi. Doğru yönde, ama sınırını
yazmadan geçmek yanlış olur.

**Kazanılan, gerçek:**

- Kayıt artık anonim bir POST değil, **doğrulanmış e-postası olan bir hesabın**
  işlemi. Bugün kurallar dokuz haneli herhangi bir numarayı kabul ediyor
  (AGENTS.md'de "tasarımsal açık" diye kayıtlı); bundan sonra numara hesaba
  bağlı olacak ve her hesap tek numara taşıyacak.
- Bir öğrenci numarası **tek hesaba** kilitleniyor. İkinci bir hesap aynı
  numarayı alamıyor, yani "başkasının numarasıyla kayıt" tek tıkla yapılamıyor.
- Kayıtlar cihazdan bağımsız okunabiliyor; telefon değişince kaybolmuyor.
- Çekilişte tekillik cihazda değil hesapta — bugün yalnızca aynı cihazda
  engelleniyor.

**Kazanılmayan, ve bunu bilerek kabul ediyoruz:**

- **Öğrenci numarasının gerçekten o kişiye ait olduğunu hiçbir şey kanıtlamıyor.**
  Alan adı kısıtı kaldırıldığı için elde kriptografik bir kanıt yok: ilk gelen
  numarayı alır. Birinin başkasının numarasını "kapmasını" engelleyen şey
  teknik değil sosyal — kulüp üyesini tanıyor ve panelden düzeltebiliyor.
- Yani bu sistem **sahtekârlığı zorlaştırıyor, imkânsızlaştırmıyor.** Kabul
  edilebilir: kapıda yoklamayı okutan görevli zaten orada ve sertifika
  yoklamadan türüyor.

Bu satırların burada olma sebebi, altı ay sonra "hani güvenlik üst düzeydi"
sorusunun cevabının belgede durması.

---

## 3. Apple ve Google gerçekte ne şart koşuyor

### 3.1 Sign in with Apple zorunlu değil — bir şartla

Guideline 4.8'in birebir metni:

> Apps that use a third-party or social login service (such as Facebook Login,
> Google Sign-In, Log in with X, …) to set up or authenticate the user's primary
> account with the app must also offer as an equivalent option another login
> service with the following features: […]
>
> Another login service is **not** required if:
> * **Your app exclusively uses your company's own account setup and sign-in systems.**
> * […]

Sonuç:

- **Yalnızca kendi hesap sistemimiz (e-posta + parola) → Sign in with Apple
  zorunlu değil.**
- **Google ile Giriş eklendiği an zorunlu hâle gelir.** İkisi bir pakettir;
  "önce Google'ı koyalım, Apple'ı sonra" diye bir yol yok, o hâliyle 4.8'den ret
  gelir. Bu yüzden sosyal giriş planda hiç yok.

### 3.2 Apple girişi dayatmamızı da istemiyor

Guideline 5.1.1(v), birebir:

> **If your app doesn't include significant account-based features, let people
> use it without a login.** […] Apps may not require users to enter personal
> information to function, except when directly relevant to the core
> functionality of the app or required by law.

Karar 2 tam olarak bunu karşılıyor: içerik açık, **yalnızca katılma eylemi**
hesap istiyor. "Açılışta login ekranı" tasarımı bu maddeyle elenmiş durumda.

### 3.3 Hesap silme — Apple

Hesap oluşturmayı destekleyen uygulama silmeyi de sunmak zorunda (2022-06-30'dan
beri). Apple'ın destek sayfasından doğrulananlar:

- Silme **uygulama içinden başlatılabilmeli**. "Bize e-posta atın" kabul
  edilmiyor; destek akışı dayatmak yalnızca yüksek düzenlemeye tabi sektörlere
  tanınmış.
- Web sayfasına yönlendirme serbest, ama **doğrudan** o sayfaya link verilmeli.
- **Tüm hesap kaydı ve ilişkili kişisel veri** silinmeli; "geçici olarak devre
  dışı bırakma yeterli değildir".
- Silme anında olmak zorunda değil: süre bildirilirse gecikme kabul, ama
  tamamlandığında **onay verilmeli**.
- Yeniden kimlik doğrulama ve onay adımı serbest; "gereksiz yere zorlaştıran"
  akışlar reddediliyor.
- Yasa gereği saklanan veri varsa kullanıcıya söylenmeli.

### 3.4 Hesap silme — Google Play

Play bir adım fazlasını istiyor:

- Uygulama içi silme yolu **ve** uygulamaya erişemeyenler için **web'den
  erişilebilir bir silme adresi**. Adres çalışır olmalı, hesap silme sayfada
  **belirgin** olmalı, uygulama/geliştirici adını anmalı.
- Adres Play Console'da **Data safety formunda** beyan ediliyor.
- Saklanan veri varsa gizlilik politikasında anlatılmalı.
- Tarihler geçti (2023-12-07 / 2024-05-31); bugün yürürlükte ve yaptırımlı.

Karar 4 bunu karşılıyor.

### 3.5 Bizim tarafta ayrıca değişecekler

- App Store **privacy nutrition label** ve Play **Data safety** formu: "Contact
  Info → e-posta", "Identifiers → User ID". Hesap eklemek bu iki formu yanlış
  hâle getirir; güncellenmemesi tek başına ret sebebi.
- Gizlilik politikası (`PRIVACY_POLICY_URL` uygulamada zaten var): hesap,
  saklama süresi, silme.
- KVKK: ad ve öğrenci numarası kişisel veri. Aydınlatma metni hesap kurulumunda
  gösterilecek; sertifikada ad yazacağı için sertifika da kapsamda.

---

## 4. Kimlik ve profil modeli — "eşleştirme"

**Sağlayıcı: Firebase Auth, yalnızca e-posta + parola.** Doğrulandı: Spark
(ücretsiz) planda çalışıyor, **50.000 aylık aktif kullanıcıya** kadar ücretsiz.
Kulüp ölçeğinde tavan görünmüyor.

Neden Firebase: korunacak veri Firestore'da ve tek güvenlik modeli Firestore
kuralları; kurallar `request.auth.uid` konuşuyor. Supabase Auth depoda kurulu
(AI Gündem için) ama Firestore'u açamaz — iki kimlik sistemi bakmak
yapılmayacak.

**E-posta bağlantılı (passwordless) giriş elendi:** Firebase Dynamic Links
25 Ağustos 2025'te kapandı, e-posta bağlantısıyla giriş artık Universal/App
Links kurulumu istiyor (alan adında `apple-app-site-association` ve
`assetlinks.json`, associated-domains entitlement, prebuild). Parolayı
kaldırmanın bedeli bu; şimdilik değmez.

### 4.1 Koleksiyonlar

```
users/{uid}
  email, adSoyad, studentNo, createdAt

studentNumbers/{studentNo}        ← numara→hesap kilidi, içeriği tek alan
  uid

registrations/{eventId}__{studentNo}    ← doküman kimliği bugünkü hâliyle kalıyor
  uid  ←  YENİ
  regId, seatId, eventId, code, name, studentNo, department, year, createdAt
```

`studentNumbers` ayrı bir koleksiyon çünkü **bir doküman kimliği, hiçbir
sorgunun taşıyamayacağı bir benzersizlik kuralı taşıyabiliyor** — bu depo aynı
numarayı kayıtlarda zaten bu yöntemle kullanıyor (AGENTS.md). Numara profile
gömülü kalsaydı iki hesabın aynı numarayı taşımasını hiçbir şey engelleyemezdi.

### 4.2 Akış

1. **Kayıt ol:** e-posta + parola + ad soyad + öğrenci numarası. Tek ekran.
2. `sendEmailVerification` gönderilir. E-posta doğrulanmadan katılma açılmaz.
3. `studentNumbers/{no}` oluşturulur. Numara doluysa istemci "bu numara başka
   bir hesapta kayıtlı" der; çözümü panelden.
4. **Etkinliğe katıl:** form açılmıyor, **onay ekranı** açılıyor — ad, numara,
   bölüm, sınıf profilden geliyor. Kullanıcı yalnızca bölüm/sınıf gibi
   etkinliğe özgü alanı düzeltip onaylıyor.
5. Yazma bugünkü batch'in aynısı; üstüne `uid` alanı ve kurallarda eşleşme
   şartı.

Bölüm ve sınıf da profile alınabilir; ilk kayıttan sonra profile yazılıp
sonrakilerde varsayılan gelmesi en ucuzu (kullanıcı yılda bir sınıf
değiştiriyor).

### 4.3 Kurallar (şekil)

```
match /users/{uid} {
  allow read, write: if request.auth.uid == uid;      // yalnızca kendi profili
}

match /studentNumbers/{no} {
  allow read: if false;                                // numara listesi sızmasın
  allow create: if request.auth != null
                && request.auth.token.email_verified
                && request.resource.data.keys().hasOnly(['uid'])
                && request.resource.data.uid == request.auth.uid;
  allow update, delete: if false;                      // kilit kalıcı, panel çözer
}

match /registrations/{regId} {
  allow read: if resource.data.uid == request.auth.uid;   // YENİ: kendi kaydını okur
  allow create: if request.auth != null
                && request.auth.token.email_verified
                && regId == request.resource.data.eventId + '__' + request.resource.data.studentNo
                && request.resource.data.uid == request.auth.uid
                && get(/databases/$(database)/documents/studentNumbers/$(request.resource.data.studentNo)).data.uid == request.auth.uid
                && ( … bugünkü alan doğrulamaları aynen … );
  allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['createdAt'])
                && resource.data.uid == request.auth.uid;
}
```

Üç not:

- `request.auth.token.email_verified` kurallarda **doğrudan var**; doğrulanmamış
  e-postayı sunucu tarafında eleyen ücretsiz kaldıraç budur.
- Kuraldaki `get()` her değerlendirmede bir doküman okuması demek. Kulüp
  ölçeğinde önemsiz, ama ücretsiz değil — bilinerek.
- `allow read` ilk kez açılıyor. Bugün `if false`; kayıtların cihazdan bağımsız
  olmasının tek yolu bu ve `uid` eşleşmesiyle dar tutuluyor.

**Kurallar depoda dururken hiçbir şey yapmıyor** — `npm run rules:deploy`
gerekiyor. Bu, bu deponun en pahalı dersi (AGENTS.md).

---

## 5. QR yoklama, çekiliş, sertifika

### 5.1 Tarayıcı görevlide olmalı, öğrencide değil

İki model var:

**(A) Etkinlik QR'ı ekranda, öğrenci okutur.** Kod fotoğraflanıp paylaşılır ve
salonda olmayan herkes yoklamaya girer. Kapatmak için kodun 30 saniyede bir
dönmesi gerekir, **ama doğrulayacak yer yok**: Firestore kuralları HMAC
hesaplayamaz, Cloud Functions da yok (§7.2).

**(B) Öğrencinin QR'ı telefonunda, görevli okutur. ← seçilen**
QR, kaydın `seatId`'sini taşır (kimlikte öğrenci numarası geçtiği için doküman
kimliği değil — bu ayrım depoda zaten var). Görevli paneli telefonunda açar,
kamerayla okutur, panel Admin SDK ile yoklamayı yazar.

(B)'nin üstünlüğü:

- Paylaşma sorunu yok; tarayıcı görevlide.
- Uygulamaya kamera izni ve yeni native modül **girmiyor**. QR çizmek saf hesap.
- Yeni Firestore kuralı yok — yazan taraf Admin SDK, kuralları görmüyor.
- Blaze gerekmiyor.

Bedeli: görevlinin panelin açık olduğu bir telefonu olmalı; kamera HTTPS
istiyor, panel zaten HTTPS'te.

### 5.2 Çekiliş ayrı bir QR akışı değil

Okutulan katılımcı yoklamaya girer; çekiliş katılımı yoklamadan türer. "Geldi"
ile "çekilişe katıldı" aynı olay olduğunda ikinci bir mekanizma yazmaya gerek
yok. Çekilişin kendine özgü form alanları varsa (bugünkü `raffles` tanımı) form
uygulamada doldurulmaya devam eder, QR yalnızca gelişi işaretler.

Hesap geldiği için çekiliş tekilliği artık **cihazda değil hesapta**: katılım
kimliği `eventId__uid` olur ve ikinci katılım var olan dokümana düşer.

### 5.3 Sertifika

Yoklama kaydından türer, panel üretir. Teslim: uygulamada sertifika ekranı +
sitede `/dogrula/<kod>` doğrulama sayfası. Görsel gerekiyorsa `sharp` zaten
kurulu (SVG → PNG). **PDF yazılmayacak**, kulüp basılabilir dosya isteyene
kadar.

---

## 6. Hesap silme mimarisi

Üç parça, ikisi zaten var.

**Uygulama içi (Apple şartı):** Ayarlar → "Hesabımı sil" → yeniden kimlik
doğrulama → ne silineceğinin listesi → onay.

**Web (Play şartı):** sitede **statik bir sayfa** yeter. Firebase Auth web
SDK'sıyla giriş yapılır, aynı silme talebi yazılır. Sunucu rotası, oturum
yönetimi, yeni backend gerekmiyor — bu yüzden panele değil siteye konuyor.

**Temizlik (panel):** `deletionRequests/{uid}` dokümanı bir yoklayıcı tarafından
işlenir; Admin SDK `users/{uid}`, kayıtlar, çekiliş katılımları, yoklamalar,
sertifikalar, `studentNumbers/{no}` ve `devices` kayıtlarını siler. Panelde
zaten iki yoklayıcı çalışıyor (`startPushFlusher`, `startAnnouncementPoller`);
bu üçüncüsü, aynı desen.

**Onay nasıl veriliyor** (Apple "tamamlandığında onay" istiyor, elimizde e-posta
gönderen bir altyapı yok): istemci silme talebinden sonra **oturumu açık
tutarak** talebin durumunu izler; panel veriyi silip `status: done` yazar,
istemci onayı gösterir ve **en son** `deleteUser()` ile kendi Auth kaydını
siler. Kullanıcı uygulamayı kapatırsa panel bir zaman aşımından sonra Auth
kaydını kendisi siler.

Sıralama önemli: Auth kaydı **en sona** kalmalı, yoksa istemci kendi talebinin
bittiğini okuyamaz.

---

## 7. Ölçülen teknik tuzaklar

Hepsi bu depoda, kurulu sürümlerle ölçüldü.

### 7.1 `firebase/auth` React Native'de yanlış derlemeye çözülüyor

`firebase` 12.17.1'in `./auth` ihracat haritasında **`react-native` koşulu yok**:

```
"./auth": { "types": …, "node": {…}, "browser": {…}, "default": … }
```

Metro bu yüzden **browser** derlemesini alıyor. Onun varsayılan kalıcılığı
`browserLocalPersistence`, yani `localStorage` — React Native'de yok. Sonuç:
**oturum bellekte kalır ve uygulama kapanınca düşer.** Kullanıcı her açılışta
yeniden giriş yapar; bu bir hata olarak değil "uygulama beni unutuyor" diye
bildirilir.

`getReactNativePersistence` yalnızca RN derlemesinde (`dist/rn/index.rn.d.ts`)
tanımlı. İki import da bu depoda typecheck'i kırıyor, ölçüldü:

```
firebase/auth   → error TS2305: has no exported member 'getReactNativePersistence'
@firebase/auth  → error TS2305: aynı hata
```

Sebep: iki paketin de `exports` haritasında `"types"` anahtarı `"react-native"`
koşulundan **önce** geliyor; TypeScript ilk eşleşeni alıp paylaşılan
`auth-public.d.ts`'e düşüyor. Expo tabanından gelen
`customConditions: ["react-native"]` bunu değiştirmiyor.

→ **Faz 1'in ilk işi bu spike.** Oturum yeniden açılışta gerçekten duruyor mu,
ölçülmeden UI yazılmayacak. Üç yol: RN derlemesini açıkça import etmek,
`Persistence` sözleşmesini AsyncStorage üzerinde birkaç satırla kendimiz
sağlamak, ya da `@react-native-firebase/auth` (native modül, prebuild ve
`google-services.json` — son çare).

Bu tuzak "çalışıyor gibi görünüp sessizce bozulan" cinsten: geliştirmede fark
edilmez, çünkü uygulama sürekli yeniden yükleniyor.

### 7.2 Cloud Functions yok, Auth var

İkisi karıştırılıyor, ayrı ayrı doğrulandı:

| | Spark (ücretsiz) planda |
|---|---|
| Firebase Auth (e-posta+parola) | **Çalışıyor.** 50.000 aylık aktif kullanıcıya kadar ücretsiz. |
| Cloud Functions | **Çalışmıyor.** Firebase'in kendi belgesi: *"to deploy functions, your project must be on the Blaze pricing plan."* |

(Firebase fiyatlandırma sayfasının özeti Functions'ı ücretsiz planda
çalışıyormuş gibi okutuyor; `docs/functions/get-started` bunu net biçimde
yalanlıyor. Doğru olan ikincisi.)

Yani hesap silme için standart çözüm olan **Auth `onDelete` tetikleyicisi
kullanılamıyor** — §6'daki panel yoklayıcısının sebebi bu, tercih değil.

### 7.3 Depoda olmayanlar

Kamera/barkod paketi yok (§5.1 sayesinde uygulamaya da gerekmiyor),
`expo-apple-authentication` yok (§3.1 sayesinde gerekmiyor). `expo-crypto`,
`expo-linking` ve AsyncStorage 2.2.0 kurulu.

---

## 8. Fazlar

Her fazın durma koşulu ve **kırılıp kırmızı verdiği görülmüş** en az bir
kontrolü var (AGENTS.md: iddia edilemeyen bir kontrol yeşil rapor eder).

### Faz 1 — kimlik altyapısı, UI yok
- Oturum kalıcılığı spike'ı (§7.1). **Bitmeden UI yazılmaz.**
- Firebase Auth açılır; `users` ve `studentNumbers` koleksiyonları.
- Kurallar yazılır ve **yayınlanır** (`npm run rules:deploy`).
- **Durma koşulu:** uygulama kapanıp açıldığında oturum duruyor, ölçülmüş.
- **Kontrol:** `check:release`'e kural bloğu iddiası — `rulesBlock()` deseni
  zaten var; `email_verified` ve `uid` eşleşmesi silinince kırmızı vermeli.

### Faz 2 — giriş, profil, eşleşmiş kayıt
- Kayıt ol / giriş / parola sıfırlama / e-posta doğrulama.
- Katılma düğmesi hesap istiyor; **gezinme açık kalıyor** (§3.2).
- Kayıt formu onay ekranına iniyor, profilden doluyor (§4.2).
- **Durma koşulu:** bir öğrenci hesap açıp etkinliğe katılabiliyor, ikinci bir
  hesap aynı numarayı alamıyor.
- **Kontrol:** `check:panel`'e saf doğrulama iddiaları (numara çakışması, profil
  → form eşleşmesi).

### Faz 3 — hesap silme (mağaza şartı)
- Uygulama içi silme, sitede statik silme sayfası, panelde temizlik yoklayıcısı
  (§6).
- Store formları ve gizlilik politikası güncellenir (§3.5).
- **Durma koşulu:** silme uçtan uca çalışıyor ve onay dönüyor.
- **Kontrol:** yoklayıcının kullanıcının **bütün** koleksiyonlarına dokunduğu;
  listeden bir koleksiyon düşünce kırmızı vermeli.

> Faz 3 biter bitmez sürüm çıkılabilir. Hesap sistemi mağaza açısından burada
> tamamlanmış oluyor; QR olmadan da yayınlanabilir.

### Faz 4 — QR yoklama ve çekiliş
- Uygulamada kayıt kartında QR; panelde tarayıcı; `attendance` koleksiyonu.
- Çekiliş katılımı `eventId__uid` ile hesap bazlı tekil.
- **Durma koşulu:** gerçek bir etkinlikte yoklama alınabiliyor.
- **Kontrol:** aynı katılımcının iki kez okutulması tek yoklama sayılıyor.

### Faz 5 — sertifika
- Panel üretimi, uygulamada ekran, sitede doğrulama sayfası.
- **Durma koşulu:** yoklamaya giren biri sertifikasını görüyor ve doğrulama
  adresi onu tanıyor.

### Yapılmayacaklar
- Google / Apple ile giriş — 4.8 borcunu doğurur (§3.1).
- E-posta bağlantılı giriş — Dynamic Links kapandı (§4).
- PDF sertifika — istenene kadar.
- Cloud Functions'a dayanan hiçbir tasarım — Blaze gerektiriyor (§7.2).
- Mevcut kayıtların göçü — §1.

---

## 9. Sürüm ve geri dönüş notu

Hesap sistemi yayına çıkan bir uygulamaya giriyor. İki şey önceden kararlaştı:

- **Mevcut kullanıcılar kırılmıyor:** gezinme girişsiz kaldığı için güncellemeyi
  alan biri hiçbir şey kaybetmiyor. Yalnızca yeni kayıt hesap istiyor.
- **`app.json` sürümü elle artırılacak.** `autoIncrement: true` yalnızca
  build numarasını artırıyor, kullanıcıya görünen `version`'ı değil — bu depo
  bunu bir kez yaşadı (AGENTS.md).
