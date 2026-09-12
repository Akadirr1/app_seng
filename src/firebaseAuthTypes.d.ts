/**
 * `getReactNativePersistence` için tip bildirimi.
 *
 * Fonksiyon **var** ve cihazda çalışıyor; görünmeyen şey yalnızca tipi.
 * Ölçülen sebep: `@firebase/auth`'un `exports` haritasında `"types"` anahtarı
 * `"react-native"` koşulundan ÖNCE geliyor, TypeScript ilk eşleşeni alıyor ve
 * paylaşılan `auth-public.d.ts`'e düşüyor — o dosyada bu ihracat yok. Expo
 * tabanından gelen `customConditions: ["react-native"]` bunu değiştirmiyor.
 *
 * Çalışma zamanında neden var: `firebase/auth`'un varsayılan derlemesi tek
 * satır — `export * from '@firebase/auth'`. Metro o iç içe isteği
 * `react-native` koşuluyla çözüyor (Expo SDK 57'de iOS/Android koşul kümesi
 * tam olarak `["react-native"]`, ve `unstable_enablePackageExports` açık),
 * dolayısıyla `@firebase/auth/dist/rn/index.js` yükleniyor. O derleme
 * fonksiyonu ihraç ediyor; ölçüldü.
 *
 * Node/Jest'te ise `node` koşulu kazanıyor ve fonksiyon **yok**. Testler bu
 * yüzden buna dayanamaz; `src/auth.ts` yokluğunu sessizce tolere ediyor ve
 * `check:release` cihaz derlemesinde var olduğunu ayrıca doğruluyor.
 */
import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}

// Bu dosyanın bir modül olması gerekiyor, yoksa yukarıdaki `declare module`
// genişletme değil yeniden tanım sayılır.
export type { Persistence, ReactNativeAsyncStorage };
