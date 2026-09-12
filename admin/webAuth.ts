/**
 * Web silme sayfası için parola doğrulama.
 *
 * Admin SDK parola **doğrulayamıyor** ve bu bir eksiklik değil, tasarım:
 * ayrıcalıklı taraf kullanıcının parolasını hiç görmüyor. Doğrulamanın tek
 * yolu Identity Toolkit'in `signInWithPassword` uç noktası — uygulamanın
 * kullandığı akışın aynısı, yalnızca istemci yerine panelden çağrılıyor.
 *
 * Kullanılan anahtar `EXPO_PUBLIC_FIREBASE_API_KEY`: zaten uygulama paketinin
 * içinde, yani gizli değil. Firebase'in web API anahtarı bir yetki taşımıyor —
 * veriyi koruyan şey Firestore kuralları.
 */
const ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

export class WebAuthError extends Error {}

/** Doğruysa kullanıcının `uid`'i, değilse fırlatır. */
export async function verifyPassword(email: string, password: string): Promise<string> {
  const key = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  if (!key) {
    // Yapılandırma eksikse bunu "parola yanlış" diye göstermek operatörü
    // düzeltemeyeceği bir yere yollar; log ayrı, kullanıcı mesajı ayrı.
    console.error('[hesap-sil] EXPO_PUBLIC_FIREBASE_API_KEY tanımlı değil; doğrulama yapılamıyor.');
    throw new WebAuthError('yapılandırma eksik');
  }

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });

  if (!res.ok) throw new WebAuthError('kimlik doğrulanamadı');

  const body = (await res.json()) as { localId?: unknown };
  if (typeof body.localId !== 'string' || !body.localId) {
    // Uç nokta 200 dönüp beklenen alanı vermiyorsa bunu başarı saymak,
    // kimliği doğrulanmamış bir silme talebi kabul etmek olurdu.
    throw new WebAuthError('beklenmeyen cevap');
  }
  return body.localId;
}
