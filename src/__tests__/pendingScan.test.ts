import AsyncStorage from '@react-native-async-storage/async-storage';

import { bekleyeniOku, bekleyeniSil, bekleyeniYaz } from '../pendingScan';

const GECERLI = { eventId: 'git-atolyesi', token: 'ABCDEFGHJKMN' };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('bekleyen yoklama', () => {
  it('yazılan geri okunuyor', async () => {
    await bekleyeniYaz(GECERLI);
    expect(await bekleyeniOku()).toEqual(GECERLI);
  });

  it('yokken null', async () => {
    expect(await bekleyeniOku()).toBeNull();
  });

  it('silinince gidiyor', async () => {
    await bekleyeniYaz(GECERLI);
    await bekleyeniSil();
    expect(await bekleyeniOku()).toBeNull();
  });

  // ASIL MESELE: diskte kalmış bozuk bir değer ekranı kilitlememeli. Eski bir
  // sürümden kalan ya da yarım yazılmış bir kayıt, her açılışta reddedilecek
  // bir yoklama denemesi üretirdi.
  it('bozuk değer sessizce atılıyor', async () => {
    for (const kotu of ['', 'sadecemetin', 'git-atolyesi.', '.ABCDEFGHJKMN', 'GIT.ABCDEFGHJKMN', 'git-atolyesi.kisa']) {
      await AsyncStorage.setItem('kyk.bekleyenYoklama.v1', kotu);
      expect(await bekleyeniOku()).toBeNull();
    }
  });

  it('bozuk değer okununca diskten de siliniyor', async () => {
    await AsyncStorage.setItem('kyk.bekleyenYoklama.v1', 'bozuk');
    await bekleyeniOku();
    expect(await AsyncStorage.getItem('kyk.bekleyenYoklama.v1')).toBeNull();
  });
});
