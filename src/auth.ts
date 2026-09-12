/**
 * Hesap katmanı — Firebase Auth ve `users/{uid}` profili.
 *
 * Sağlayıcı olarak yalnızca e-posta + parola var, ve bu bir karar: Apple'ın
 * 4.8 kuralı Sign in with Apple'ı ancak üçüncü taraf/sosyal giriş sunulduğunda
 * zorunlu kılıyor. "Yalnızca kendi hesap sistemi" istisnasında kalarak
 * `expo-apple-authentication`, entitlement ve prebuild'in tamamı düşüyor.
 * Google ile Giriş eklenirse bu istisna kaybolur — bkz. docs/giris-sistemi-plani.md.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  deleteUser,
  type Auth,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { normalizeEmail, toProfile, type Profile, type SignupInput } from './accountSchema';
import { COLLECTIONS, getDb, getFirebaseApp } from './firebase';

let auth: Auth | undefined;

/**
 * Auth örneği — **kalıcılık burada belirleniyor ve önemli.**
 *
 * `initializeAuth` çağrılmazsa React Native'de varsayılan kalıcılık bellek
 * oluyor: oturum uygulama kapanınca düşüyor ve kullanıcı her açılışta yeniden
 * giriş yapıyor. Bu bir hata olarak bildirilmiyor, "uygulama beni unutuyor"
 * diye bildiriliyor — ve sürüm derlemesinde konsol olmadığı için hiçbir uyarı
 * da görünmüyor.
 *
 * `getReactNativePersistence` tiplerde görünmüyor (bkz. firebaseAuthTypes.d.ts)
 * ve Jest/Node ortamında gerçekten yok. Yokluğunda çökmüyoruz — testler de bu
 * dosyayı içe aktarabilmeli — ama `check:release` cihaz derlemesinde var
 * olduğunu doğruluyor, yani sessizce belleğe düşmüş bir sürüm çıkamıyor.
 */
export function getAuthClient(): Auth {
  if (auth) return auth;
  const app = getFirebaseApp();

  const persistence =
    typeof getReactNativePersistence === 'function'
      ? getReactNativePersistence(AsyncStorage)
      : undefined;

  try {
    auth = persistence ? initializeAuth(app, { persistence }) : getAuth(app);
  } catch {
    // Fast Refresh aynı modülü yeniden çalıştırıyor; `initializeAuth` ikinci
    // çağrıda fırlatıyor, var olan örnek doğru cevap.
    auth = getAuth(app);
  }
  return auth;
}

export type { User };

export function watchAuth(onChange: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAuthClient(), onChange);
}

export function currentUser(): User | null {
  return getAuthClient().currentUser;
}

/**
 * Hesap açar, doğrulama e-postası gönderir, profili yazar.
 *
 * Sıra önemli: profil **kullanıcı oluştuktan sonra** yazılıyor, çünkü kurallar
 * `request.auth.uid == uid` istiyor ve o kimlik ancak hesap varken oluşuyor.
 *
 * Doğrulama e-postası hata verirse hesap yine duruyor — kullanıcı ekrandan
 * yeniden isteyebiliyor. Burada fırlatmak, açılmış bir hesabı "açılmadı" gibi
 * göstermek olurdu.
 */
export async function signUp(input: SignupInput, now = new Date()): Promise<User> {
  const client = getAuthClient();
  const cred = await createUserWithEmailAndPassword(
    client,
    normalizeEmail(input.email),
    input.parola,
  );

  const profile = toProfile(input, now);
  await setDoc(doc(getDb(), COLLECTIONS.users, cred.user.uid), {
    ...profile,
    createdAt: serverTimestamp(),
  });

  // Firebase'in doğrulama postası BİLEREK gönderilmiyor: gönderen
  // `noreply@<proje>.firebaseapp.com` ve o alan adı kulübün olmadığı için
  // SPF/DKIM hizalanmıyor — posta spam'e düşüyor, cihazda böyle gözlendi.
  // Kodu panel kulübün kendi adresinden gönderiyor (`src/otp.ts`).
  return cred.user;
}

export async function signIn(email: string, parola: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getAuthClient(), normalizeEmail(email), parola);
  return cred.user;
}

export function signOut(): Promise<void> {
  return fbSignOut(getAuthClient());
}

export function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(getAuthClient(), normalizeEmail(email));
}

/**
 * Doğrulama durumunu sunucudan tazeler.
 *
 * `user.emailVerified` jetonun içinden geliyor, yani kullanıcı e-postadaki
 * bağlantıya bastığında **kendiliğinden değişmiyor**; uygulama açıkken
 * sonsuza kadar `false` görünür. Ekran bu yüzden elle tazeliyor.
 */
export async function refreshVerification(): Promise<boolean> {
  const user = currentUser();
  if (!user) return false;
  await user.reload();
  await user.getIdToken(true);
  return user.emailVerified;
}

export async function loadProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.users, uid));
  return snap.exists() ? (snap.data() as Profile) : null;
}

/**
 * Hesap silme talebi.
 *
 * Neden iki adım: Firestore'daki veriyi istemci silemiyor (başkasının
 * koltuk kaydına dokunması gerekirdi) ve Cloud Functions bu projede yok —
 * Blaze istiyor. Talep bir dokümana yazılıyor, paneldeki yoklayıcı Admin
 * SDK ile temizliyor.
 *
 * Auth kaydı **en sona** kalıyor: önce silinirse istemci kendi talebinin
 * bittiğini okuyamaz ve Apple'ın istediği "tamamlandı" onayı verilemez.
 * Kullanıcı uygulamayı kapatırsa panel zaman aşımıyla kendisi siliyor.
 */
export async function requestAccountDeletion(parola: string): Promise<void> {
  const user = currentUser();
  if (!user?.email) throw new Error('Oturum açık değil.');

  // Apple "yeniden kimlik doğrulama" adımına izin veriyor ve Firebase zaten
  // yakın zamanda giriş yapılmasını şart koşuyor.
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, parola));

  await setDoc(doc(getDb(), COLLECTIONS.deletionRequests, user.uid), {
    uid: user.uid,
    email: user.email,
    status: 'pending',
    requestedAt: serverTimestamp(),
  });
}

/** Panel temizliği bitti mi. */
export async function deletionDone(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.deletionRequests, uid));
  return snap.exists() && (snap.data() as { status?: string }).status === 'done';
}

/** Temizlik bittikten sonra Auth kaydını siler. Zincirin son halkası. */
export async function finishAccountDeletion(): Promise<void> {
  const user = currentUser();
  if (user) await deleteUser(user);
}

/**
 * Firebase'in hata kodlarını Türkçeye çevirir.
 *
 * Ham kod (`auth/invalid-credential`) kullanıcıya hiçbir şey söylemiyor ve
 * ekranda İngilizce duruyor. Tanınmayan kod olduğu gibi geçmiyor: içinde
 * teşhis var, ve o teşhis bize lazım.
 */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.';
    case 'auth/invalid-email':
      return 'E-posta adresi geçerli görünmüyor.';
    case 'auth/weak-password':
      return 'Parola çok zayıf.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      // Üçü bilerek aynı cümle: hangisinin yanlış olduğunu söylemek, bir
      // e-postanın kayıtlı olup olmadığını dışarıdan sorulabilir hâle getirir.
      return 'E-posta veya parola hatalı.';
    case 'auth/too-many-requests':
      return 'Çok fazla deneme yapıldı. Bir süre sonra tekrar deneyin.';
    case 'auth/network-request-failed':
      return 'Bağlantı kurulamadı. İnternetinizi kontrol edin.';
    case 'auth/requires-recent-login':
      return 'Bu işlem için yeniden giriş yapmanız gerekiyor.';
    default:
      return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
  }
}
