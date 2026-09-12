# Doğrulama ve teklik — plan ve kurulum

Karar: **bir kişi = bir hesap.** Zorlanan üç alan var (e-posta, telefon,
öğrenci numarası); ad denetlenmiyor, ve bu bilinçli.

Doğrulama postası Firebase'den değil, kulübün kendi adresinden gidiyor.

---

## 1. Ne zorlanıyor, ne zorlanmıyor

| Alan | Nasıl | Nerede |
|---|---|---|
| E-posta | Firebase Auth zaten tek tutuyor (`auth/email-already-in-use`) | bedava |
| Telefon | `phoneClaims/{+90…}` — doküman kimliği değerin kendisi | `admin/claims.ts` |
| Öğrenci no | `studentClaims/{123456789}` — aynı kalıp | `admin/claims.ts` |
| **Ad soyad** | **denetlenmiyor** | — |

**Ad neden denetlenmiyor:** denetleyecek bir kaynak yok. "İki parça, 5–80
karakter" bir biçim kuralı, kimlik kuralı değil; `asdf qwer` her denetimden
geçer. Uydurma bir denetim yazmak, olmayan bir güvenceyi varmış gibi
göstermek olurdu — bu depoda "412 fotoğraf" maddesi tam olarak bunun kaydı.

**Bunun yerine ne var:** öğrenci numarası tek. Troll ad yazan kişi o adı
**kendi numarasıyla** yazıyor ve ikinci bir hesap açıp temiz bir sertifika
alamıyor. Yani denetim yerine maliyet: rozet kendi üstünde kalıyor.

**Zorlanmayan şey, numaranın gerçekten o kişiye ait olduğu.** Üniversiteye
soracak bir yer yok. Zorlanan tek şey aynı numaranın ikinci bir hesapta
kullanılamaması, ve sertifikanın dayandığı varsayım da sadece bu kadarı.

### Bilinen açık: numara kapma

Bir kişi başkasının öğrenci numarasını kendi hesabına yazabilir ve o numaranın
gerçek sahibi kayıt olamaz. Kapatmanın tek yolu numarayı doğrulamak, ve doğrulayacak
bir kaynak yok. Maliyeti yükselten iki şey var ve ikisi de kurulu:

- Sahiplenme **yalnızca e-postası doğrulanmış hesapta** oluyor, yani her kapma
  bir gerçek posta kutusu gerektiriyor.
- Panelden serbest bırakılabiliyor: gerçek sahibi kulübe yazar, kayıt silinir.

Toplu bir kapmayı bu ikisi durdurmuyor, pahalı hâle getiriyor. Firebase App
Check ayrı bir iş ve bu turda yok.

---

## 2. Doğrulama neden Firebase'in bağlantısı değil

Üç sebep, üçü de bağımsız:

1. **Posta spam'e düşüyor.** Gönderen `noreply@<proje>.firebaseapp.com` —
   kulübün sahip olmadığı bir alan adı, dolayısıyla `kouseng.com` için
   yayımlanan SPF/DKIM ile hizalanmıyor. Gmail bunu böyle değerlendiriyor ve
   gözlenen de bu oldu.
2. **Teklik kontrolünün bir sunucu anı olmak zorunda.** Telefon ve numara
   sahiplenmesi atomik olmalı (ikisi birden ya da hiçbiri) ve bu Admin SDK
   istiyor. Firebase'in bağlantı akışında kancalanacak bir an yok — nasıl olsa
   bir uç nokta yazılacaktı. Kod doğrulaması o uç noktanın kendisi.
3. **Bağlantı kullanıcıyı uygulamadan çıkarıyor.** Tarayıcıda açılıyor,
   uygulama olup bittiğini bilmiyor, kullanıcı geri dönüp elle tazeliyor
   (`refreshVerification` tam olarak bunun için yazılmıştı). Altı hane
   kullanıcıyı ekrandan hiç çıkarmıyor.

**Doğrulanmamış bir kolay yol:** Firebase Auth'un kendi şablonlarına Workspace
SMTP'si tanımlanabildiği iki kez yazıldı (Console → Authentication → Templates).
Firebase'in özel e-posta işleyici belgesi yalnızca *action handler*
özelleştirmesini anlatıyor, SMTP'yi değil, ve konsol bu depodan görülemiyor —
yani böyle bir ayarın varlığı **burada doğrulanamıyor**. Konsolu açan kişi
baksın: varsa sıfır kodla parola sıfırlama postasının gönderenini düzeltir,
yoksa tek yol o akışı da OTP hattına taşımak (§7). Bu, kod yazmadan
alınabilecek bir kazanç.

---

## 3. Akış

```
kayıt formu ──► Firebase Auth hesabı + users/{uid}      (doğrulanmamış)
     │
     └─► /dogrula ──► POST /api/hesap/kod    ──► noreply@kouseng.com'dan 6 hane
                 └─► POST /api/hesap/dogrula ──► kod doğru mu
                                              ──► telefon + numara sahiplen (işlem)
                                              ──► emailVerified = true
```

Doğrulama ve sahiplenme **aynı çağrıda**. Ayrılsalardı doğrulanmış ama
numarası çakışan bir hesap ortaya çıkar ve onu kimin düzelteceği belirsiz
kalırdı.

**Çakışma aynı ekranda düzeltiliyor.** Sunucu hangi alanın çakıştığını
söylüyor, ekran o alanı açıyor, kullanıcı düzeltip aynı kodla tekrar
gönderiyor — çakışmada kod tüketilmiyor. Profili düzenleyecek başka bir ekran
yok; olmayan bir ekrana yönlendirmek hesabı kalıcı olarak doğrulanamaz
bırakırdı.

### Kodun kuralları

| | değer | neden |
|---|---|---|
| Uzunluk | 6 hane | `crypto.randomInt`, baştaki sıfır korunuyor |
| Ömür | 10 dk | postanın gelmesine yeter, çalınan ekran görüntüsüne yetmez |
| Yanlış deneme | 5 | 10⁶ ihtimali anlamsız kılıyor |
| Yeniden gönderim | 60 sn | düğmeye üst üste basmayı engelliyor |
| Saatlik tavan | 5 posta | **ayrı bir sınır**: 60 sn'lik bekleme tek başına saatte 60 posta demek |

Saklanan şey kodun kendisi değil, `sha256(uid.kod)` — doküman sızsa bile kod
okunmuyor. `uid` karışıma giriyor ki bir kaydın hash'i başka bir kullanıcıda
kullanılamasın.

**Süre ve kilit, yanlış koddan önce bakılıyor.** Tersi olsaydı süresi dolmuş
kodu giren kullanıcı "kod yanlış" görür ve doğru kodu aramaya başlardı; oysa
yapması gereken yeni kod istemek. `check:panel` bu sırayı ayrıca sınıyor
(bozulunca kırmızı verdiği görüldü).

**Önce kayıt, sonra gönderim** — `admin/push.ts`'teki kilit kuralının aynısı.
Gönderim patlarsa kayıt siliniyor, yoksa kullanıcı hiç posta almadan bir dakika
beklerdi.

---

## 4. Postanın gerçekten ulaşması — operatörün işi

**Bu adımlar bu depodan doğrulanamaz.** Panel doğru adresten gönderiyor; alan
adının bunu onaylaması DNS'te oluyor.

### 4.1 DNS

```
SPF     TXT  @        v=spf1 include:_spf.google.com ~all
DKIM    TXT  (Workspace'in verdiği ad)   (Workspace'in verdiği değer)
DMARC   TXT  _dmarc   v=DMARC1; p=none; rua=mailto:info@kouseng.com
```

DKIM anahtarı elle uydurulmuyor: Admin console → Apps → Google Workspace →
Gmail → **Authenticate email** → Generate new record → çıkan TXT'i ekle →
sonra **Start authentication**. Kaydı ekleyip bu son düğmeye basmamak, DKIM'in
hiç açılmaması demek ve dışarıdan "ekledim ama olmadı" gibi görünüyor.

DMARC `p=none` ile başlıyor. Doğrudan `p=reject` yazmak, hizalaması eksik
kalan bir kaynak varsa (eski bir form, bir bülten aracı) o postaların tamamını
sessizce yok eder.

### 4.2 Gönderen hesap

`noreply@kouseng.com` bir Workspace kutusu olacak, ve parola olarak **uygulama
parolası** kullanılacak — hesabın iki adımlı doğrulaması açık olmak zorunda,
yoksa uygulama parolası üretilemiyor.

### 4.3 Panel ortam değişkenleri

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@kouseng.com
SMTP_PASS=<uygulama parolası>
MAIL_FROM=KOÜ Yazılım Kulübü <noreply@kouseng.com>
MAIL_REPLY_TO=info@kouseng.com
```

Panel açılışta hangi modda olduğunu yazıyor — yapılandırılmamış SMTP'nin tek
belirtisi "kod gelmiyor" olurdu ve o, operatörün bakmadığı yerde kalır:

```
[posta] SMTP hazır — doğrulama kodları gönderilebiliyor.
[posta] SMTP YAPILANDIRILMAMIŞ (eksik: SMTP_PASS). …
```

### 4.4 Gövdenin kendisi

Spam puanı yalnızca alan adından gelmiyor. Şablonda bilerek olan/olmayan
şeyler (`admin/mailTemplate.ts`):

- **Düz metin karşılığı var.** Yalnızca HTML gönderen posta puan alıyor.
- **Hiç görsel yok.** Logo bir `<img>` olsaydı çoğu istemci engelleyeceği için
  posta boş bir çerçeve olarak açılırdı; "yalnızca görsel" gövde ayrıca spam
  sinyali. Kelime markası metin.
- **Hiç bağlantı yok.** Kod postasında tıklanacak bir şey yok: bağlantı
  itibarına takılmıyor, ve kullanıcıya "bu tür postalardaki bağlantılara basma"
  demeyi mümkün kılıyor.
- Tablo düzeni, satır içi stil, 600 piksel, sistem fontları. Web fontu (Press
  Start 2P dâhil) postada çalışmıyor.

---

## 5. Sertifika şablonu

Sosyal medya ekibi standart bir **HTML** şablon üretiyor; etkinlik adı ve
sertifika sahibinin adı değişken. Bu, `docs/qr-yoklama-plani.md` §5'teki
kararla birebir örtüşüyor ve oradaki en büyük riski ortadan kaldırıyor:
sunucuda görsel üretilmiyor, dolayısıyla konteynerde font arayan bir yol yok.

Şablonun uyması gereken iki şey:

1. **Yer tutucular birebir** `{{ETKINLIK}}` ve `{{AD_SOYAD}}`.
2. **Değerler metin olarak basılıyor, HTML olarak değil.** Ad kullanıcıdan
   geliyor; kaçırılmadan basılırsa şablona kod sokulabilir. `check:html` zaten
   bu sınıf için kurulu.

Belge adresi rastgele bir jeton (`/sertifika/<no>`), `uid` ya da öğrenci
numarası değil — sayfa ad + etkinlik + tarih taşıyor.

Sertifikanın **postalanması** artık ayrı bir iş değil: gönderim hattı bu
turda kuruldu, kalan tek şey şablon ve gövde.

---

## 6. Bu turda yazılanlar

| Dosya | Ne |
|---|---|
| `admin/otp.ts` | kod üretimi, hash, gönderim ve doğrulama kararları (saf) |
| `admin/mail.ts` | SMTP taşıyıcı, ortam okuma, eksik ayarı adıyla söyleme |
| `admin/mailTemplate.ts` | postanın HTML + düz metin gövdesi |
| `admin/claims.ts` | teklik işlemi ve serbest bırakma |
| `admin/accountApi.ts` | `/api/hesap/kod`, `/api/hesap/dogrula` |
| `src/otp.ts` | istemci + hata cümleleri |
| `app/dogrula.tsx` | kod ekranı, çakışma düzeltmesi |
| `firestore.rules` | `emailOtp`, `phoneClaims`, `studentClaims` — üçü de kapalı |
| `admin/deletion.ts` | hesap silinince sahiplenmeleri serbest bırakıyor |

**Silme tarafı gözden kaçacak yerdi:** teklik kayıtlarının doküman kimliği
`uid` değil, değerin kendisi — silme yoklayıcısının iki listesine de
giremiyorlar. Atlansaydı hesap silinmiş görünür ama aynı kişi bir daha kayıt
olamazdı, çünkü numarası hâlâ kilitli olurdu. `check:panel` bunu doğruluyor
(kırılıp kırmızı verdiği görüldü).

## 7. Yapılmayanlar

- **Parola sıfırlama hâlâ Firebase'in postası.** Aynı OTP hattıyla
  değiştirilebilir (`purpose` alanı + parola belirleme uç noktası), ama ayrı
  bir ekran ve ayrı bir güvenlik yüzeyi. §2'deki SMTP ayarı bu arada
  gönderen sorununu çözüyor.
- **Mevcut hesaplar için geriye dönük sahiplenme.** Kurallar henüz
  yayınlanmadı ve üretimde doğrulanmış hesap yok; olsaydı bir defalık tarama
  gerekirdi.
- **Öğrenci numarası doğrulama.** Kaynak yok (§1).
- **Firebase App Check.** Kimliksiz istemcinin `registrations`'a spam
  yazabilmesi hâlâ açık ve cevabı bu; bir satırlık iş değil.
