/**
 * Okutulmuş ama henüz yazılamamış QR.
 *
 * İki durum için var ve ikisi de kapı önünde yaşanıyor:
 *
 * 1. **Oturum yokken okutma.** Okut → giriş ekranına at → geri dön → jeton
 *    kayboldu. Bu deponun defterinde aynı sınıfta kayıtlar var: kullanıcıyı
 *    yarıda kalmış bir işle baş başa bırakmak.
 * 2. **Salonun interneti.** Yoklamanın en yoğun anı ile ağın en kötü anı aynı.
 *    Yazma başarısızsa jeton duruyor ve bir sonraki açılışta yeniden deneniyor
 *    — pencere gün sonuna kadar açık olduğu için o deneme hâlâ geçerli.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { isEventId, isQrToken, type QrOkuma } from './qrSchema';

const KEY = 'kyk.bekleyenYoklama.v1';

export async function bekleyeniYaz(okuma: QrOkuma): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, `${okuma.eventId}.${okuma.token}`);
  } catch {
    // Disk yazılamıyorsa yapacak bir şey yok; akışı bozmuyor.
  }
}

/**
 * Bekleyeni okur. Bozuk değer **sessizce atılıyor**: diskteki bir kalıntının
 * ekranı kilitlemesindense hiç olmaması iyi.
 */
export async function bekleyeniOku(): Promise<QrOkuma | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const [eventId, token] = raw.split('.');
    if (!eventId || !token || !isEventId(eventId) || !isQrToken(token)) {
      await bekleyeniSil();
      return null;
    }
    return { eventId, token };
  } catch {
    return null;
  }
}

export async function bekleyeniSil(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // yok sayılıyor
  }
}
