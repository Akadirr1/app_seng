/**
 * Panelin herkese açık sayfaları: gizlilik, kullanım koşulları, hesap silme.
 *
 * Neden panelde: hesap sistemi olan bir uygulamanın bu metinleri web'de
 * yayınlaması gerekiyor, ve Play ayrıca **uygulamaya erişemeyen** biri için
 * web'den çalışan bir hesap silme adresi şart koşuyor (Data safety formunda
 * beyan ediliyor). Panel zaten bir alan adında HTTPS ile koşuyor; ikinci bir
 * site ayağa kaldırmanın karşılığı yok.
 *
 * **Bu rotalar `requireAuth`'tan ÖNCE kayıt edilmek zorunda.** Sonra
 * kaydedilirlerse yönetici parolası isterler, ki o hâlde Play'in istediği şey
 * — uygulamaya erişemeyen kullanıcının silme talebi — imkânsız olur.
 * `check:release` sıranın korunduğunu doğruluyor.
 */
import { esc, page } from './views';

/** Kulübün mağaza listelerinde görünen adı; metinlerde de aynısı geçmeli. */
const CLUB = 'KOÜ Yazılım Kulübü';
const APP = 'KOÜ Yazılım Kulübü uygulaması';
const CONTACT = 'kouyazilimkulubu@gmail.com';

function legalPage(title: string, bodyHtml: string): string {
  return page(title, `<div class="card legal">${bodyHtml}</div>`, { nav: false });
}

export function privacyPage(): string {
  return legalPage(
    'Gizlilik Politikası',
    `<h2>Gizlilik Politikası ve KVKK Aydınlatma Metni</h2>
     <p class="hint">Son güncelleme: ${new Date().getFullYear()}</p>

     <h3>Veri sorumlusu</h3>
     <p>${esc(CLUB)}. İletişim: <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a></p>

     <h3>İşlenen veriler</h3>
     <p>Hesap oluşturduğunuzda ad soyad, e-posta adresi, doğum tarihi ve telefon
        numaranız işlenir. Bir etkinliğe kaydolduğunuzda ayrıca öğrenci
        numaranız, bölümünüz ve sınıfınız işlenir. Bildirim izni verdiyseniz
        cihazınızın bildirim jetonu saklanır.</p>

     <h3>İşleme amacı</h3>
     <p>Etkinlik kayıtlarının yürütülmesi, kontenjan takibi, çekiliş
        katılımlarının kaydı ve etkinlik duyurularının iletilmesi. Veriler
        reklam amacıyla kullanılmaz ve üçüncü taraflara satılmaz.</p>

     <h3>Saklama ve silme</h3>
     <p>Veriler hesabınız var olduğu sürece saklanır. Hesabınızı uygulama
        içinden (Hesabım → Hesabımı sil) veya
        <a href="/hesap-sil">bu sayfadan</a> silebilirsiniz; hesabınız ve
        ilişkili kişisel verileriniz kalıcı olarak silinir.</p>

     <h3>Haklarınız</h3>
     <p>KVKK 11. madde kapsamında verilerinize erişme, düzeltilmesini veya
        silinmesini isteme haklarına sahipsiniz. Talepleriniz için yukarıdaki
        e-posta adresine yazabilirsiniz.</p>`,
  );
}

export function termsPage(): string {
  return legalPage(
    'Kullanım Koşulları',
    `<h2>Kullanım Koşulları</h2>
     <p class="hint">Son güncelleme: ${new Date().getFullYear()}</p>

     <h3>Hizmet</h3>
     <p>${esc(APP)}, kulübün etkinliklerini duyurmak, etkinlik kaydı almak ve
        çekiliş katılımlarını toplamak için sunulur. Uygulamanın içeriğini
        görmek için hesap gerekmez; yalnızca etkinliğe katılmak için hesap
        açmanız gerekir.</p>

     <h3>Hesap</h3>
     <p>Hesap açarken verdiğiniz bilgilerin doğru olmasından siz sorumlusunuz.
        Bir hesabı başkası adına açamazsınız. Parolanızın gizliliğini korumak
        size aittir.</p>

     <h3>Etkinlik kayıtları ve çekilişler</h3>
     <p>Etkinlik kaydı kontenjanla sınırlıdır. Çekilişler ${esc(CLUB)}
        tarafından düzenlenir; katılım ücretsizdir ve Apple ile Google'ın
        çekilişle hiçbir ilgisi yoktur. Kazananlar kulüp tarafından elle
        belirlenir ve uygulamada duyurulur.</p>

     <h3>Kabul edilmeyen kullanım</h3>
     <p>Sahte kayıt oluşturmak, başkasının bilgileriyle kaydolmak veya sistemi
        aşırı istekle meşgul etmek hesabın kapatılmasıyla sonuçlanabilir.</p>

     <h3>Değişiklikler</h3>
     <p>Koşullar değişirse bu sayfa güncellenir. Uygulamayı kullanmaya devam
        etmeniz güncel koşulları kabul ettiğiniz anlamına gelir.</p>`,
  );
}

/**
 * Hesap silme sayfası.
 *
 * Play'in şartı bu sayfanın **çalışır**, kapsamı doğru ve hesap silmenin
 * belirgin olması. Form e-posta ve parola istiyor: kimliğini doğrulamadan
 * silme kabul etmek, bir e-posta adresini bilen herkese başkasının hesabını
 * sildirmek olurdu.
 */
export function deleteAccountPage(opts: { error?: string; done?: boolean } = {}): string {
  if (opts.done) {
    return legalPage(
      'Hesap silme talebi alındı',
      `<h2>Talebiniz alındı</h2>
       <p>Hesabınız ve ilişkili kişisel verileriniz en geç <strong>24 saat</strong>
          içinde kalıcı olarak silinecek. Silme tamamlandığında hesabınızla
          giriş yapılamaz.</p>
       <p class="hint">Bir sorunuz olursa
          <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a> adresine yazabilirsiniz.</p>`,
    );
  }

  return legalPage(
    'Hesabımı sil',
    `<h2>${esc(APP)} — hesap silme</h2>
     <p>Hesabınızı ve tüm kişisel verilerinizi kalıcı olarak silmek için
        aşağıdaki bilgileri girin. Bu işlem <strong>geri alınamaz</strong>.</p>
     <p class="hint">Uygulamayı kullanabiliyorsanız aynı işlemi
        <strong>Hesabım → Hesabımı sil</strong> adımından da yapabilirsiniz.</p>

     <h3>Silinecek veriler</h3>
     <ul>
       <li>Hesabınız ve giriş bilgileriniz</li>
       <li>Ad soyad, e-posta, doğum tarihi, telefon numarası</li>
       <li>Etkinlik kayıtlarınız ve çekiliş katılımlarınız</li>
       <li>Bildirim kaydınız</li>
     </ul>

     ${opts.error ? `<div class="banner">${esc(opts.error)}</div>` : ''}

     <form method="post" action="/hesap-sil">
       <label>E-posta
         <input type="email" name="email" required autocomplete="email">
       </label>
       <label>Parola
         <input type="password" name="password" required autocomplete="current-password">
       </label>
       <button type="submit" class="btn-danger">Hesabımı kalıcı olarak sil</button>
     </form>

     <p class="hint">Sorularınız için
        <a href="mailto:${esc(CONTACT)}">${esc(CONTACT)}</a></p>`,
  );
}
