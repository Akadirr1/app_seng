# QR yoklama ve sertifika — plan

Karar: **etkinlik QR'ı ekranda/afişte durur, öğrenci uygulamadan okutur.**
Kodun fotoğraflanıp paylaşılması kabul edilmiş bir maliyet; şart olan tek şey
okutmanın **uygulamada kayıtlı bir hesapla** çalışması.

Bu, `docs/giris-sistemi-plani.md` §5.1'de reddedilen modelin ta kendisi. Reddin
gerekçesi bir şarta bağlıydı ve o şart artık yok — aşağıda §1'de yazıyor.

---

## 1. Eski "hayır" neden geçersiz, ve yerine ne geliyor

Giriş planı iki modeli karşılaştırıp (B)'yi seçmişti:

- **(A)** Etkinlik QR'ı ekranda, öğrenci okutur.
- **(B)** Öğrencinin QR'ı telefonunda, görevli panelden okutur. ← eski seçim

(A)'ya itiraz tek cümleydi: *paylaşımı kapatmak için kodun 30 saniyede bir
dönmesi gerekir, ve dönen kodu doğrulayacak yer yok — Firestore kuralları HMAC
hesaplayamaz, Cloud Functions Blaze istiyor.*

**Rotasyon şartı düştüğü an itiraz da düşüyor.** Sabit bir jetonu doğrulamak için
HMAC gerekmiyor: jeton, istemciye **okuması kapalı** bir dokümanda durur ve kural
onu `get()` ile okur. Kural değerlendirmesi istemcinin okuma izninden geçmez, o
yüzden jeton hiçbir zaman kabloya çıkmaz ama kural onunla karşılaştırma yapabilir.
Sunucu yok, fonksiyon yok, Blaze yok.

(A)'nın (B)'de olmayan iki gerçek bedeli var ve ikisi de fiyatlanmalı:

1. **Kamera izni ve yeni bir native modül.** `expo-camera` girince EAS'ta yeni bir
   derleme ve mağazaya yeni bir sürüm şart. (B)'de uygulama hiç değişmiyordu —
   tarayıcı panelin içindeydi. Yani "QR'ı öğrenci okutsun" kararının bedeli bir
   sürüm çıkarmak.
2. **Yoklamanın anlamı daralıyor.** Kayıt "bu hesap, pencere açıkken jetonu
   gönderdi" demek; "bu kişi salondaydı" demek değil. Kulüp için kabul edilebilir,
   ama **sertifikanın üstüne bilmediğimiz bir şey yazılamaz** (bkz. §5).

(B) ölmüyor: aşağıdaki `attendance` dokümanının şekli iki modelde de aynı, o yüzden
ileride görevli tarayıcısı istenirse panele bir sayfa eklemek yetiyor.

---

## 2. Fikrin değerlendirmesi — zayıf noktalar

Sırayla, en ciddiden başlayarak.

### 2.1 Asıl risk QR değil, sertifikadaki isim

Kayıt formu ad soyad için yalnızca "iki parça, 5–80 karakter" istiyor.
`asdf qwer` bu denetimden geçer. Sertifika kulübün adını taşıyan bir belge ve
tamamen otomatik dağıtılırsa, er ya da geç o belgenin üstüne bir şaka adı
basılacak — ve geri alınamayacak, çünkü PDF'i kullanıcı indirmiş olacak.

**GÜNCELLEME — kulüp adı denetlemiyor.** Denetleyecek bir kaynak olmadığı için
doğru karar bu (bkz. `docs/dogrulama-ve-teklik-plani.md` §1). Yerine geçen şey
denetim değil, maliyet: öğrenci numarası artık tek, yani troll ad yazan kişi o
adı kendi numarasıyla yazıyor ve ikinci bir hesapla temiz bir sertifika alamıyor.

Panelde yayın ekranı yine var ve addaki alan yine düzenlenebilir — ama kapı
olarak değil, düzeltme imkânı olarak: operatör listeye bakmak zorunda değil,
bakmak isterse bakabiliyor.

### 2.2 Ad, düzenlendiği an dondurulmalı

Sertifika sayfası adı her açılışta profilden okursa, kişi profilini değiştirdiğinde
**belge sessizce değişir**. Kendini yeniden yazan şey belge değildir. Ad, yayın
anında `attendance` dokümanına kopyalanır ve orada kalır.

### 2.3 Sertifika adresi kişisel veri taşıyor

Sayfada ad soyad + etkinlik + tarih var. Adres tahmin edilebilir olursa
(`/sertifika/<uid>` ya da öğrenci numarası) liste dışarıdan taranabilir. Adres
**rastgele bir jeton** olacak, sayfa `noindex`, ve listeleyen bir uç nokta
olmayacak. Depoda bu dersin kaydı zaten var: kayıt dokümanının kimliği öğrenci
numarası taşıdığı için herkese açık koltuk listesine ayrı bir rastgele jeton
konmuştu.

### 2.4 Bir insan, iki hesap

`registrations` aynı öğrenci numarasının aynı etkinliğe iki kez yazılmasını
doküman kimliğiyle engelliyor. Yoklama `uid`'e bağlıydı ve profilde öğrenci
numarası yoktu, dolayısıyla iki hesap açan bir kişi iki yoklama ve iki
sertifika alırdı.

**ÇÖZÜLDÜ.** Öğrenci numarası profile eklendi ve teklik gerçekten zorlanıyor:
`phoneClaims/{telefon}` ve `studentClaims/{ogrenciNo}` — doküman kimliği
değerin kendisi, yazma panelde ve tek bir işlemde (ikisi birden ya da hiçbiri).
Sahiplenme e-posta doğrulandığı anda oluyor, yani her kapma bir gerçek posta
kutusu gerektiriyor. Ayrıntı: `docs/dogrulama-ve-teklik-plani.md`.

Bu aynı zamanda §2.1'in dayanağı: ad denetlenmediği hâlde sertifikanın bir
anlamı kalmasının tek sebebi, bir kişinin ikinci bir hesap açamaması.

### 2.5 Okutma anında giriş yoksa jeton kaybolmamalı

Okut → giriş ekranına at → geri dön → **jeton yok**. Kapı önünde yaşanan hâli bu.
Okunan jeton bekletilir, giriş/kayıt bitince yoklama kendiliğinden gönderilir.

### 2.6 Etkinlik salonunun internet'i

Yoklamanın en yoğun anı ile ağın en kötü anı aynı. Gönderim, kayıtlardaki
bekleyen/yeniden dene desenini kullanacak ve `permission-denied`'de duracak
(depodaki kural: yalnızca yeniden denemenin düzeltebileceği şeyi yeniden dene).
Bunun bir sonucu var: **pencere, etkinliğin bitiminde değil günün sonunda
kapanmalı** — yoksa akşam bağlantıya kavuşan telefon kalıcı olarak reddedilir.

### 2.7 Doğrulanmamış e-posta

Okutma anında e-posta doğrulaması **istenmeyecek** (kapıda insan bekletmenin
anlamı yok), ama **sertifika yalnızca doğrulanmış hesaba** yayınlanacak. Ayrım
şuradan: okutma zamana bağlı, sertifika değil.

### 2.8 Yayınlanmamış kural = çalışmayan yoklama

Bu tasarımın çekirdeği bir Firestore kuralı ve **bu depoda kuralları koşturacak bir
ortam yok** (`firestore.rules` içindeki `getAfter` notu aynı sebeple yazılmış).
Yanlış yazılmış bir kuralın belirtisi, etkinlik günü kimsenin okutamaması olur.
O yüzden ilk gerçek etkinlikten önce **sahte bir etkinlikle canlı prova** şart:
jeton yaz, okut, reddedilmesi gereken üç durumu (yanlış jeton, pencere dışı,
oturumsuz) tek tek dene.

### 2.9 Bunlar sorun değil

- Kodun paylaşılması — kullanıcının kararı, ve §5'teki cümle bunu zaten
  sahiplenmiş oluyor.
- Mağazadaki hesapsız sürüm — o sürümde tarayıcı da yok, yoklama hiç yazılmıyor.
  Geriye dönük bir kırılma yok.
- Kamera izni App Store gizlilik etiketini değiştirmiyor: kare hiçbir yere
  yazılmıyor, saklanmıyor, gönderilmiyor.

---

## 3. Veri modeli

Üç yeni parça, biri koleksiyon bile değil.

### `eventQr/{eventId}` — istemciye kapalı

```
{ token: string, opensAt: timestamp, closesAt: timestamp }
```

Panelden doğuyor (Admin SDK). `allow read: if false` — **jeton hiçbir istemciye
gitmiyor**; kurala `get()` ile giriyor, ki o çağrı istemcinin izinlerinden geçmez.
Panelde "jetonu yenile" düğmesi olacak: yanlış basılan ya da sızdığına pişman
olunan bir kod tek tıkla ölmeli.

Pencere varsayılanı: etkinliğin başlamasından 1 saat önce açılır, **etkinliğin
kendi gününün sonunda** kapanır (§2.6). İkisi de panelde düzenlenebilir.

### `attendance/{eventId}__{uid}`

```
{ eventId, uid, token, checkedInAt,
  certificate?: { no, adSoyad, issuedAt } }   // yalnızca panel yazar
```

Kimlik neden birleşik: aynı hesap aynı etkinliğe ikinci kez yazamasın — sayaç yok,
okuma yok, yarışacak bir şey yok. Depoda `eventId__studentNo` ile aynı kalıp.

**Sertifika ayrı bir koleksiyon değil.** Arşiv dersinin aynısı: `ArchiveEntry`'nin
her alanı zaten `ClubEvent`'te vardı ve ayrı tutmak aynı gerçeği iki kez girmek
demişti. Sertifika = yoklama + operatörün yayınlaması. Tek satır, ayrışacak
ikinci kopya yok.

### Kurallar (şekil)

```
match /attendance/{id} {
  allow read: if request.auth != null && resource.data.uid == request.auth.uid;
  allow delete: if false;

  // Yeniden gönderim: aynı yoklama var olan dokümana düşer, yani update.
  // Sertifika alanlarına istemci dokunamaz.
  allow update: if request.resource.data.diff(resource.data)
                        .affectedKeys().hasOnly(['checkedInAt']);

  allow create: if request.auth != null
    && request.resource.data.keys().hasOnly(['eventId','uid','token','checkedInAt'])
    && id == request.resource.data.eventId + '__' + request.auth.uid
    && request.resource.data.uid == request.auth.uid
    && exists(/databases/$(database)/documents/events/$(request.resource.data.eventId))
    && request.resource.data.token ==
         get(/databases/$(database)/documents/eventQr/$(request.resource.data.eventId)).data.token
    && request.time >= get(...).data.opensAt
    && request.time <= get(...).data.closesAt;
}
match /eventQr/{eventId} { allow read, write: if false; }
```

Jeton yoklama dokümanında saklanıyor çünkü kural yalnızca **yazılan** veriyi
görebiliyor. Sızıntı değil: dokümanı yalnızca sahibi okuyor ve jeton zaten
elindeydi.

**Sayaç yok.** Katılım sayısı panelin sorgusu. `increment()` bu depoda bir kez
yanlış yere gitmeye çok yaklaştı; yeniden denenen bir yazma sayacı şişirir.

---

## 4. QR'ın içinde ne var

`https://<panel>/qr/<eventId>/<token>`

- Uygulamanın tarayıcısı hem bu adresi hem de çıplak `<eventId>.<token>` biçimini
  kabul eder.
- Telefonun kendi kamerası okuduğunda boşa düşmez: panel o adreste "katılımını
  kaydetmek için uygulamayı aç" sayfasını gösterir. Universal link **kurulmuyor**
  (`apple-app-site-association` + entitlement, ayrı bir iş); sayfa yeterli.
- Sayfanın kendisi jetonu ekrana yazmaz — adres çubuğunda zaten var, ama sayfanın
  onu tekrar etmesi gereksiz.

---

## 5. Sertifika

### Nasıl üretiliyor

Panelde etkinlik başına yayın ekranı → liste (§2.1) → yayınla. Yayın, her
`attendance` satırına `certificate` alanını yazar. `no` rastgele bir jeton.

**Görsel iş sunucuda yapılmıyor.** `sharp` kurulu ve olay fotoğraflarında
kullanılıyor, ama şablon üstüne isim basmak metin çizmek demek: konteynerde
fontconfig ve Türkçe gliflerin bulunduğu bir font gerekir, ve yoksa belirti hata
değil — **boş ya da kutulu bir isim**. Bu depoda "denenmemiş dal yazılmamış daldır"
maddesi zaten var.

Onun yerine sertifika bir **HTML sayfası**: panelin herkese açık rotası
`GET /sertifika/:no` (yasal sayfalar gibi `requireAuth`'tan önce). Font,
görüntüleyenin cihazında çözülür.

Şablonu **sosyal medya ekibi üretiyor**: etkinlik adı ve sertifika sahibinin adı
değişken. İki yer tutucu birebir `{{ETKINLIK}}` ve `{{AD_SOYAD}}`, ve değerler
**metin olarak** basılıyor — ad kullanıcıdan geliyor, kaçırılmadan basılırsa
şablona kod sokulabilir.

PDF isteyen için ikinci bir yol yazılmıyor: uygulama aynı HTML'i `expo-print` ile
PDF'e basıp paylaşım sayfasına veriyor (`expo-print` SDK 57 listesinde, ek native
modül derdi yok).

Şablon yükleme, olay fotoğraflarının yolunu kullanır (multer + Supabase Storage) —
yeni bir depolama sağlayıcısı yok.

### Sayfadaki cümle

Sertifika, **bilinen şeyi** yazacak: kişi, etkinlik, tarih, belge numarası.
"Doğrulanmıştır", "katıldığı onaylanmıştır" gibi kodun arkasında durmadığı bir
iddia yazılmayacak (§1.2). Depodaki "412 fotoğraf" maddesi tam olarak bunun kaydı:
arayüzü olan kurgu, değişkendeki kurgudan çok daha zor fark ediliyor.

### Nasıl ulaşıyor

- Uygulamada **Hesabım → Sertifikalarım**: kendi `attendance` satırlarından
  `certificate` taşıyanlar. Boşken piksel fontla boş durum metni (depo kuralı).
- Posta: gönderim hattı kuruldu (`admin/mail.ts`), sertifika postası şablon
  hazır olunca eklenecek — ayrı bir altyapı işi kalmadı.
- Bildirim: mevcut push hattı (`pushPolicy` + `pendingPushes` + `pushLog` kilidi).
  Kilit gönderimden önce alınır, kimseye ulaşmayan gönderimde geri verilir — ikisi
  de defterde yazılı kurallar. Katılımcısı olmayan etkinlik için bildirim yok.
- ~~E-posta ile gönderim yok.~~ **Değişti:** SMTP hattı doğrulama kodu için
  zaten kuruldu, dolayısıyla sertifikayı postalamanın ek maliyeti kalmadı.

---

## 6. Uygulama tarafı

- `expo-camera` (~57.0.4, SDK'nın kendi listesinde). `CameraView` +
  `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}` + `onBarcodeScanned`.
- `app.json` eklentisi:
  ```json
  ["expo-camera", {
    "cameraPermission": "QR okutarak etkinlik yoklamana katılman için kamera gerekiyor.",
    "recordAudioAndroid": false
  }]
  ```
  `recordAudioAndroid` varsayılanı `true` ve `RECORD_AUDIO` izni ekliyor. **QR
  okumak için mikrofon istemek, inceleme masasında açıklanması gereken bir şey** ve
  bu depo izinleri zaten `blockedPermissions` ile budamış durumda.
- Giriş noktası: etkinlik ekranındaki "QR ile yoklama" düğmesi. Hesabım sekmesine
  ikinci bir giriş konmuyor — yoklama etkinliğe ait.
- Oturumsuz okutma: jeton bekletilir, `/giris`'ten dönünce gönderilir (§2.5).

---

## 7. Fazlar

**Faz 1 — yoklama**
1. `eventQr` + `attendance` kuralları, `rules:deploy`.
2. Panel: etkinlik sayfasında QR (jeton üret/yenile, pencere, yazdırılabilir kod),
   katılım listesi, "kayıt oldu ama okutmadı" karşılaştırması.
3. Uygulama: tarayıcı ekranı, bekleyen jeton, yeniden deneme.
4. Canlı prova (§2.8) — üç reddin üçü de denenmeden faz bitmiş sayılmaz.

**Faz 2 — sertifika**
5. Profile öğrenci numarası (§2.4).
6. Panel: şablon yükleme, yayın ekranı (düzenlenebilir ad), `/sertifika/:no`.
7. Uygulama: Sertifikalarım, `expo-print` ile PDF paylaşımı.
8. Yayında push.

**Yapılmayacaklar** — istendiğinde ayrıca konuşulur:
dönen/zamanlı QR, universal link, görevli tarayıcısı (model B), e-posta gönderimi,
sunucuda görsel üretimi, `studentNumbers` tekillik koleksiyonu, çekilişin QR'a
bağlanması.

---

## 8. Bu planın dayandığı ölçümler

- `expo-camera` ~57.0.4 ve `expo-print` ~57.0.1, kurulu `expo`'nun
  `bundledNativeModules.json` dosyasında var — ikisi de SDK'nın kendi sürüm
  listesinden geliyor, `deps:sync` ikisini de yönetir.
- Eklenti seçenekleri ve `CameraView` API'si v57 dokümanından okundu, hatırlanmadı.
- `sharp`, `multer`, `firebase-admin`, `express` panelde zaten kurulu; bu plan
  **hiç yeni sunucu bağımlılığı eklemiyor**.
- Firestore kurallarının `get()` çağrısının istemci okuma iznine tabi olmadığı
  **burada doğrulanamıyor** (depoda kural koşturacak ortam yok). §2.8'deki prova
  bu yüzden fazın parçası, notu değil.
