# Devir notu — 5 Eylül 2026

Bu dosya bir oturumun sonunda, bir sonraki oturum için yazıldı. **Kalıcı kurallar
burada değil**: onlar `AGENTS.md`'nin why-log'unda ve `CLAUDE.md` üzerinden zaten
otomatik yükleniyor. Burada olan şey, o dosyalarda olmayan tek şey: **şu an nerede
durduğumuz, neyin canlıda doğrulandığı, neyin doğrulanmadığı ve neyin açık kaldığı.**

---

## 1. Nerede duruyoruz

| | |
|---|---|
| `main` | `7435364` |
| Sürüm | **1.1.1** (`app.json`, `package.json`, `package-lock.json`) |
| Açık PR | yok |
| Merge edilmemiş dal | yok |
| Çalışma ağacı | temiz |
| `npm run check:all` | yeşil — 39 sürüm kontrolü, 30 süit, 361 test |
| `npx expo export --platform ios --clear` | çıkış 0 |

Bu oturumda beş PR merge edildi: #38, #39, #40, #41, #42.

---

## 2. Bu oturumda ne yapıldı

### Apple çekiliş reddi (5.3.1 / 5.3.2) — PR #38

Uygulama çekiliş yüzünden reddedilmişti. Sebep mekanik değildi: uygulamada zaten
rastgele seçim yok, `raffleSchema.ts` aylardır bunu yazıyor. **Eksik olan beyandı.**

- `src/raffleLegal.ts` — düzenleyen, kapsam, ücretsizlik, rastgelelik, Apple feragati
  ve resmî kuralların tek kaynağı.
- `src/components/RaffleNotice.tsx` — etkinlik detayındaki çekiliş kartında ve
  katılım formunda çizilen sessiz beyan bloğu.
- `app/cekilis-kurallari.tsx` — on bölümlük Resmî Çekiliş Kuralları sayfası.

Düzenleyen adı **`Abdulkadir IVENC`** — App Store Connect'teki *takım* adı. Kişisel
Apple Account adı (`Abdülkadir İvenç`) **değil**; aksanlı hâle "düzeltmek" reddin
sebebini geri getirir ve test bunu ayrıca yasaklıyor.

### Haber okuma yüzeyi — PR #38

Cihazdan "txt dosyası gibi duruyor" geri bildirimi geldi. `toParagraphs` +
`ArticleBody`: paragraf, 16/27 punto-aralık, ~60 karakter satır, beyaz kart.

### AI Gündem akışı — PR #39

Zenginleştirme **talep güdümlüydü** ve bu hiçbir yerde yazmıyordu: `sync-feeds`
haberleri 15 dakikada bir çekiyor ama özet işi kuyruğa koymuyor; işi yaratan tek şey
istemcinin `request-enrichment` çağırması, ve worker 2 dakikada bir koşuyor. Yani bir
haberi **ilk açan kişi her zaman bekliyordu**.

- `src/gundem/enrichment/warmup.ts` + `useEnrichmentWarmup.ts` — akış yüklenince
  özeti olmayan en yeni haberler arka planda ısıtılıyor. Bütçe sunucudan okundu:
  miss 30/cihaz/gün, check 120/cihaz/saat → yükleniş başına 4, gün başına 20.
- `src/gundem/enrichment/gate.ts` — özeti olmayan **taze** haber akışa hiç girmiyor.
  Tavan 30 dakika: gövdesi olmayan haberin özeti hiç üretilemiyor, tavansız kapı onu
  ebediyen saklardı.
- `ContentNotice` artık sebebi söylüyor. Yapılandırması olmadan çıkmış bir sürüm
  derlemesinde "bağlantını kontrol et" demek yanlış yönlendirmeydi.

### Bildirim sistemi — PR #40 + #41

Tam envanter için `AGENTS.md` → "Bildirim otomasyonu" bölümü. Özet:

**Bulunan en büyük hata:** `devices` koleksiyonu çoğu kullanıcı için **hiç
yazılmıyordu.** Token bir `useRef`'teydi ve onu okuyan efektin bağımlılığı değildi;
token her zaman efektten sonra geliyor, ref yazmak render tetiklemiyor. Yani push
kimseye gitmiyordu ve hiçbir hata görünmüyordu.

**Otomasyon:** panel kaydettiği anda push gidiyor — yeni etkinlik, iptal, çekiliş
sonucu. Duyurular `api.kouseng.com`'dan 15 dakikada bir yoklanıyor.

**Sessiz saatler** artık atlama değil erteleme (`pendingPushes`, 08:00'de gönderim,
kuyruktan çıkarken yeniden doğrulama).

**`/bildirimler` sayfası** — kaç cihaz kayıtlı, son gönderimler, kuyruk, test düğmesi.

### Sürüm 1.1.1 — PR #42

1.1.0 App Store'da yayımlandı, aynı numarayla ikinci sürüm çıkarılamıyor.

---

## 3. Canlıda ne doğrulandı, ne doğrulanmadı

Bu ayrım önemli — depo kuralı: **gözlemlenmeyen sonuç iddia edilmez.**

### Cihazda çalıştığı görüldü ✅

- Yeni etkinlik bildirimi
- Etkinlik iptal bildirimi

Kullanıcı TestFlight sürümüyle test etti ve ikisinin de geldiğini bildirdi. Bu aynı
zamanda `devices` düzeltmesinin, panel gönderiminin ve Expo teslimatının çalıştığını
kanıtlıyor — zincirin tamamı.

### Henüz canlıda görülmedi ❓

| ne | neden görülmedi |
|---|---|
| Çekiliş sonucu push'u | panelden kazanan girilmedi |
| Duyuru yoklaması | ilk tur **hiçbir şey göndermez** (defter kurulumu); bildirim ancak sonraki yeni duyuruyla gelir |
| Sessiz saat kuyruğu | 23:00–08:00 arasında etkinlik oluşturulmadı |
| `/bildirimler` sayfası | son deploydan **sonra** merge edildi |
| 1.1.1 derlemesi | henüz alınmadı |

`/bildirimler` ve kilit geri verme düzeltmesi `main`'de ama **kullanıcının son
deployundan sonra** girdi. Bir sonraki panel deployuyla gelecekler.

### Kurulu TestFlight sürümü

`claude/bildirim-otomasyonu` dalından alındı. PR #41 yalnızca paneli, #42 yalnızca
sürüm numarasını değiştirdi — yani **uygulama tarafında davranış farkı yok**. Yeni
build almadan da bildirim testine devam edilebilir.

---

## 4. Dağıtım tarafında bilinmesi gerekenler

Bu oturumun kodu iki yere gidiyor ve ikisinin de gereksinimleri farklı.

### `firestore.rules` bu oturumda değişti — ama yayımlanması gerekmiyor

`18d3aaf` iki blok ekledi: `pushLog` ve `pendingPushes`, ikisi de `allow read,
write: if false`. **Yayımlamak şart değil**, çünkü dosyanın sonundaki catch-all
onları zaten kapatıyor ve bu defterleri yalnızca panel (Admin SDK) yazıyor —
Admin SDK kuralları hiç görmüyor. Bloklar açıkça yazıldı ki bir gün "istemci de
okusun" diyen biri neden okumaması gerektiğini orada görsün.

Yani `npm run rules:deploy` bu değişiklik için **gerekmiyor**. (Depo kuralı hâlâ
geçerli: repodaki dosya canlıda ne olduğunu söylemez, yalnızca ne yazıldığını.)

### Panelin bildirim otomasyonu yeni bir ortam değişkeni İSTEMİYOR

`ADMIN_AUTO_PUSH` bilerek `.env.example`'da yok: **varsayılan AÇIK.** Kapalı
varsayılan, bu defterdeki "sessizce çalışmayan özellik" maddesinin bir örneği
daha olurdu. `ADMIN_AUTO_PUSH=off` yalnızca yerelde çalışırken gerçek
kullanıcılara push gitmesin diye var — Coolify'da tanımlanmamalı.

Panel zaten sahip olduğu şeylerle çalışıyor: `FIREBASE_SERVICE_ACCOUNT` (push
göndermek için `devices` okuması ve `pushLog` yazması gerekiyor) ve dışa dönük
ağ (Expo Push API + `api.kouseng.com`).

### Zamanlayıcılar panel sürecinin içinde

Ayrı bir cron yok; ikisi de `setInterval`:

| ne | sıklık | nerede |
|---|---|---|
| Sessiz saat kuyruğunu boşaltma | 10 dk | `startPushFlusher` |
| Duyuru yoklaması (`api.kouseng.com`) | 15 dk | `startAnnouncementPoller` |

Sonucu: **panel yeniden başlatıldığında sayaçlar sıfırlanır**, ve panel kapalıyken
hiçbir şey olmaz. Duyuru tarafında bu bilerek zararsız: yaş sınırı 24 saat, yani
uzun bir kesintiden sonra dönen panel birikmiş listeyi herkese göndermiyor.
Kuyruk tarafında da zararsız: `pendingPushes` Firestore'da duruyor, bellekte
değil.

---

## 5. Açık işler

Öncelik sırasına göre. Hiçbiri acil değil; hiçbiri bozuk değil.

### 5.1 Canlı doğrulama (kod işi değil)

Yukarıdaki "henüz görülmedi" tablosu. Panel bir kez daha deploy edilince
`/bildirimler` sayfasından hepsi görünür hâle geliyor.

### 5.2 Bülten bildirimi içeriğe bakmıyor

Yerel bir günlük zamanlayıcı, kurulduğu gün yarının bülteninin var olup olmadığını
bilemez. Metin artık iddia etmiyor ("Bülten sekmesine göz atma vakti") ama bülten
üretilmemişse kullanıcı boş bir sekmeye düşüyor.

**Doğru çözüm:** sunucudan, seçilen saate göre gönderilen bir push. Cihaz dokümanına
`digestHour` eklemek ve panelin saat başında (07/08/09 kulüp saati) o saati seçmiş
cihazlara, **o gün bülten gerçekten varsa** göndermesi gerekir. Panel zaten AI Gündem
Supabase'ini anon anahtarla okuyabilir.

Kullanıcı "sabah bir bildirim yeterli" dedi, o yüzden yapılmadı.

### 5.3 Sürüm otomatik artmıyor — ve artamaz

`eas.json`'da `appVersionSource: "remote"`. eas-cli bu modda sürüm artırmayı **sabit
olarak kapatıyor**:

```js
// eas-cli build/build/android/build.js
localAutoIncrement: appVersionSource === REMOTE ? false : buildProfile.autoIncrement
```

Yani `ios.autoIncrement: "version"` yazmak remote modda `true` ile birebir aynı
davranır — yalnızca build numarasını artırır. Build numarası zaten otomatik.

Kullanıcı bunu duyduktan sonra **"gerekirse ben yükseltirim"** dedi; araç kurulmadı.
Bir sonraki mağaza sürümünde `app.json` + `package.json` + `package-lock.json`
üçünde birden elle artırmak gerekiyor (`check:release` ilk ikisinin eşitliğini
doğruluyor, kilidi doğrulamıyor).

### 5.4 AI Gündem'de bilinen üç eksik

`docs/ai-gundem-port.md` içinde kayıtlı, bilerek bırakıldı:

- `SavedView` akışın yalnızca ilk sayfasını çekiyor, ve kaynaklar etkinken
  `FeedView`'dan farklı bir sorgu anahtarı kullanıyor.
- `unseenCount` ölü kod — yalnızca kendi testi çağırıyor.
- `poll_after_seconds` yoksayılıyor; `pollAfterSeconds()` yazıldı ama hiç çağrılmıyor.

### 5.5 Backend deposu emekli

`Akadirr1/follow-ai` emekliye ayrıldı ama **dağıtılmış Edge fonksiyonları çalışmaya
devam ediyor.** Doğru düzeltme (`sync-feeds` yeni haberi eklerken özet işini de
kuyruğa koysun) oraya yazılamıyor; PR #39 sorunu uygulamanın kaldıraç sahibi olduğu
yerde çözdü.

Backend kaynağı gerekirse (bu konteynerde yok, yeni oturumda klonlanmalı):

```
add_repo owner=Akadirr1 repo=follow-ai
git clone … /home/user/akadirr1/follow-ai
```

Depo herkese açık. Sunucu sözleşmesini **tahmin etmeyin, kaynağı okuyun** — bu
oturumda bir alan adı uyuşmazlığı (`summary_tr` vs `bullets`) tam olarak böyle
bulundu.

---

## 6. Bir sonraki oturumun ilk beş dakikası

```bash
git log --oneline -1              # 7435364 bekleniyor
npm ci                            # pull sonrası node_modules geride kalır
npm run check:all                 # yeşil olmalı
```

`graphify` her oturumda yeniden kurulmalı (`graphify-out/` gitignored, konteyner
sıfırlanıyor). Kurarken hariç tutulacaklar `AGENTS.md`'de yazıyor: `assets/*.png`,
`.claude/skills/*`, ve özellikle **`design-source/`**.

---

## 7. Çalışma tarzına dair, bu oturumda oturan şeyler

- **Her iş kendi dalında.** Bu oturumun başında aylardır tek bir dalda çalışılıyordu;
  kullanıcı bunu düzeltmemi istedi. Dal adları: `claude/<kısa-konu>`.
- **CI durumu saat başı sorulmuyor.** Bir PR açıldıktan sonra bir kez bakılır, kırmızı
  olursa düzeltilir; düzenli yoklama istenmedi.
- **Merge'ü ben yapıyorum**, deploy'u kullanıcı.
- **Kullanıcı Türkçe yazıyor ve Türkçe cevap bekliyor.** Kod yorumları ve commit
  mesajları da Türkçe (mevcut İngilizce yorumlar korunuyor, yenileri Türkçe).
- **Simülatörde push test edilemez.** iOS Simulator'da APNs yok; Expo Go SDK 53'ten
  beri uzaktan push'u desteklemiyor. Yerel bildirimler simülatörde çalışır.
