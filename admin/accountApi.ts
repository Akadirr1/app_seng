/**
 * Uygulamanın çağırdığı hesap uç noktaları — kod gönder, kodu doğrula.
 *
 * Panelin geri kalanı yönetici parolasıyla korunuyor; bunlar korunamaz, çünkü
 * çağıran öğrencinin kendisi. Kimlik yerine **Firebase kimlik jetonu**
 * doğrulanıyor (`Authorization: Bearer …`), yani istek ancak gerçekten giriş
 * yapmış bir hesaptan gelebiliyor. Rotalar bu yüzden `app.use(requireAuth)`'tan
 * önce kayıt ediliyor; `check:release` sırayı doğruluyor.
 *
 * Burada yapılan iki iş var ve **ikisi de aynı anda olmak zorunda**:
 * e-postanın doğrulanması ve telefon/öğrenci numarasının sahiplenilmesi.
 * Ayrılsalardı, doğrulanmış ama numarası çakışan bir hesap ortaya çıkardı ve
 * onu kimin düzelteceği belirsiz kalırdı.
 */
import type { Express, Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

import { FieldValue } from 'firebase-admin/firestore';

import { STUDENT_NO_RE, normalizePhone } from '../src/accountSchema';
import { loginLimiter } from './session';
import { claimIdentity, type Kimlik } from './claims';
import { sendMail, mailReady } from './mail';
import { otpMail } from './mailTemplate';
import {
  OTP_TTL_MS,
  decideSend,
  decideVerify,
  hashCode,
  type OtpRecord,
} from './otp';

const OTP_COLLECTION = 'emailOtp';

/**
 * IP başına posta sınırı — hesap başına olan sınırın kapatamadığı delik.
 *
 * `decideSend` bir hesabın saatte 5 postayla sınırlı olmasını sağlıyor, ama
 * **hesap açmak bedava**: elli hesap açan biri kulübün alan adından 250 posta
 * gönderebilir, ve bedeli alan adının itibarı olur. Sayaç bu yüzden istekle
 * birlikte gelen IP'ye de bağlı.
 *
 * `req.ip` ters proxy'nin yazdığı adres (`trust proxy 1`), yani Cloudflare
 * arkasında gerçek istemci adresi.
 */
const KOD_MAX = 20;
const KOD_PENCERE_MS = 60 * 60_000;
const kodLimiti = loginLimiter(Date.now, KOD_MAX, KOD_PENCERE_MS);

/** `Authorization: Bearer …` başlığından jetonu çıkarır. */
function bearer(req: Request): string | null {
  const raw = req.header('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m ? m[1] : null;
}

type Kim = { uid: string; email: string; dogrulanmis: boolean };

async function kimlikCoz(req: Request, res: Response): Promise<Kim | null> {
  const token = bearer(req);
  if (!token) {
    res.status(401).json({ hata: 'oturum_yok' });
    return null;
  }
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email ?? '',
      dogrulanmis: decoded.email_verified === true,
    };
  } catch {
    // Süresi dolmuş jeton ile sahte jeton ayrılmıyor: ikisinin de cevabı
    // aynı, istemci jetonu tazeleyip yeniden deniyor.
    res.status(401).json({ hata: 'oturum_yok' });
    return null;
  }
}

async function otpOku(db: Firestore, uid: string): Promise<OtpRecord | null> {
  const snap = await db.collection(OTP_COLLECTION).doc(uid).get();
  return snap.exists ? (snap.data() as OtpRecord) : null;
}

export function registerAccountApi(app: Express, db: Firestore): void {
  /**
   * Kod gönder.
   *
   * Sıra: önce kayıt, sonra gönderim — `admin/push.ts`'teki kilit kuralının
   * aynısı. Gönderim patlarsa kayıt **siliniyor**, yoksa kullanıcı hiç posta
   * almadan bir dakika beklemek zorunda kalırdı.
   */
  app.post('/api/hesap/kod', async (req, res) => {
    const kim = await kimlikCoz(req, res);
    if (!kim) return;
    if (kim.dogrulanmis) return res.json({ durum: 'zaten_dogrulandi' });
    if (!kim.email) return res.status(400).json({ hata: 'eposta_yok' });

    const kilit = kodLimiti.lockedFor(req.ip ?? '');
    if (kilit > 0) {
      return res.status(429).json({ hata: 'cok_fazla', saniye: Math.ceil(kilit / 1000) });
    }

    if (!mailReady()) {
      // Sessizce "gönderildi" demek, kullanıcıyı gelmeyecek bir postayı
      // beklemeye mahkûm ederdi.
      return res.status(503).json({ hata: 'posta_yapilandirilmamis' });
    }

    const now = Date.now();
    const karar = decideSend(await otpOku(db, kim.uid), now);
    if (!karar.ok) {
      return res.status(429).json({ hata: karar.reason, saniye: karar.saniye });
    }

    const ref = db.collection(OTP_COLLECTION).doc(kim.uid);
    const kayit: OtpRecord = { ...karar.record, hash: hashCode(kim.uid, karar.code) };
    await ref.set(kayit);

    try {
      const sonuc = await sendMail({
        to: kim.email,
        ...otpMail(karar.code, Math.round(OTP_TTL_MS / 60_000)),
      });
      // BAŞARILI GÖNDERİM DE YAZILIYOR, ve bu bir ayrıntı değil: eskiden
      // yalnızca hata yazılıyordu, dolayısıyla "kod gelmedi" diyen bir
      // kullanıcıda log BOŞTU ve bu "istek hiç ulaşmadı" gibi okunuyordu —
      // oysa gönderim yapılmış olabilir. Kod satıra YAZILMIYOR; yazılan şey
      // postanın kabul edilip edilmediği.
      console.log(
        `[posta] doğrulama kodu → ${kim.email} · kabul: ${sonuc.accepted.join(', ') || 'yok'}` +
          (sonuc.rejected.length ? ` · RED: ${sonuc.rejected.join(', ')}` : '') +
          ` · zarf göndereni: ${sonuc.envelopeFrom}`,
      );
      kodLimiti.fail(req.ip ?? '');
      if (!sonuc.accepted.length) {
        // Sunucu bağlantıyı kabul edip alıcıyı reddettiğinde `sendMail`
        // fırlatmıyor. İstemciye "gönderildi" demek yanlış olurdu.
        await ref.delete().catch(() => {});
        return res.status(502).json({ hata: 'posta_gonderilemedi' });
      }
    } catch (err) {
      await ref.delete().catch(() => {});
      console.error('[posta] doğrulama kodu gönderilemedi:', err);
      return res.status(502).json({ hata: 'posta_gonderilemedi' });
    }

    res.json({ durum: 'gonderildi', saniye: Math.round(OTP_TTL_MS / 1000) });
  });

  /**
   * Kodu doğrula, aynı işlemde telefonu ve öğrenci numarasını sahiplen.
   *
   * Gövde çakışma düzeltmesini de taşıyor (`telefon`, `ogrenciNo`): numarası
   * başkasında olan kullanıcının onu değiştirebileceği başka bir ekran yok, ve
   * olmayan bir ekrana yönlendirmek hesabı kalıcı olarak doğrulanamaz bırakır.
   */
  app.post('/api/hesap/dogrula', async (req, res) => {
    const kim = await kimlikCoz(req, res);
    if (!kim) return;
    if (kim.dogrulanmis) return res.json({ durum: 'zaten_dogrulandi' });

    const govde0 = (req.body ?? {}) as Record<string, unknown>;
    const code = String(govde0.code ?? '').trim();
    const ref = db.collection(OTP_COLLECTION).doc(kim.uid);
    const kayit = await otpOku(db, kim.uid);

    const karar = decideVerify(kayit, kim.uid, code, Date.now());
    if (!karar.ok) {
      // Yanlış denemeler sayılıyor; süresi dolmuş ya da hiç olmayan kodda
      // sayacı artırmak anlamsız (artıracak bir kayıt da yok).
      if (karar.reason === 'yanlis' && kayit) {
        // `attempts + 1` DEĞİL: iki eşzamanlı yanlış deneme aynı değeri okur
        // ve ikisi de 1 yazar, yani beş denemelik tavan paralel isteklerle
        // aşılabilirdi. Bu, deponun "increment kullanma" maddesinin TERSİ
        // durum — orada yeniden denenen idempotent bir yazma sayıyı
        // şişiriyordu, burada her deneme gerçekten sayılmalı.
        await ref.update({ attempts: FieldValue.increment(1) });
      }
      return res.status(400).json({ hata: karar.reason, kalan: karar.kalan });
    }

    // Profil paneldeki kaynaktan okunuyor; gövdeden gelen değerler yalnızca
    // düzeltme. İstemcinin gönderdiğine körü körüne güvenilmiyor, ikisi de
    // burada yeniden doğrulanıyor.
    const kullanici = (await db.collection('users').doc(kim.uid).get()).data() ?? {};
    const govde = govde0;

    const telefonHam = String(govde.telefon ?? kullanici.telefon ?? '');
    const ogrenciHam = String(govde.ogrenciNo ?? kullanici.ogrenciNo ?? '').trim();

    const telefon = normalizePhone(telefonHam);
    if (!telefon) return res.status(400).json({ hata: 'telefon_gecersiz' });
    if (!STUDENT_NO_RE.test(ogrenciHam)) return res.status(400).json({ hata: 'numara_gecersiz' });

    const yeni: Kimlik = { telefon, ogrenciNo: ogrenciHam };
    const eski: Partial<Kimlik> = {
      telefon: typeof kullanici.telefon === 'string' ? kullanici.telefon : undefined,
      ogrenciNo: typeof kullanici.ogrenciNo === 'string' ? kullanici.ogrenciNo : undefined,
    };

    const sonuc = await claimIdentity(db, kim.uid, yeni, eski);
    if (!sonuc.ok) {
      // Kod TÜKETİLMİYOR: kullanıcı alanı düzeltip aynı kodla tekrar
      // gönderebilmeli, yoksa her çakışmada yeni posta beklemek gerekirdi.
      return res.status(409).json({
        hata: sonuc.alan === 'telefon' ? 'telefon_kullanimda' : 'numara_kullanimda',
      });
    }

    await db.collection('users').doc(kim.uid).set(yeni, { merge: true });
    await getAuth().updateUser(kim.uid, { emailVerified: true });
    await ref.delete().catch(() => {});

    res.json({ durum: 'dogrulandi' });
  });
}
