import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { digits } from '../src/accountSchema';
import { refreshVerification } from '../src/auth';
import { useAuth } from '../src/authStore';
import { ErrorBanner, Field, Input } from '../src/components/AuthForm';
import { GlassButton, GradientHeader, PrimaryButton, Txt } from '../src/components/ui';
import { OtpHata, kodDogrula, kodIste, otpMesaj } from '../src/otp';
import { colors, gradients, radius } from '../src/theme';

/** Kod uzunluğu — `admin/otp.ts` altı hane üretiyor. */
const UZUNLUK = 6;

/**
 * E-posta doğrulama ekranı.
 *
 * Kayıt biter bitmez buraya geliniyor: doğrulanmamış hesap etkinliğe
 * katılamıyor, yani kullanıcıyı hesap sekmesine bırakmak onu yarıda kalmış bir
 * işle baş başa bırakmak olurdu.
 *
 * **Çakışma bu ekranda düzeltiliyor.** Telefon ya da öğrenci numarası başka bir
 * hesapta kayıtlıysa sunucu hangi alan olduğunu söylüyor ve alan burada
 * açılıyor. Profili düzenleyecek başka bir ekran yok; olmayan bir ekrana
 * yönlendirmek hesabı kalıcı olarak doğrulanamaz bırakırdı.
 */
export default function VerifyRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, reloadProfile } = useAuth();

  const [kod, setKod] = useState('');
  const [bekleme, setBekleme] = useState(0);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  // Çakışan alan açıldığında düzeltme buraya yazılıyor.
  const [duzeltme, setDuzeltme] = useState<'telefon' | 'ogrenciNo' | null>(null);
  const [telefon, setTelefon] = useState('');
  const [ogrenciNo, setOgrenciNo] = useState('');

  // Ekran açılınca bir kez kod isteniyor. `useRef` gerekiyor çünkü React 19
  // geliştirme kipinde efektleri iki kez çalıştırıyor ve ikinci çağrı
  // sunucudan "60 saniye bekle" yerdi — kullanıcıya hata gibi görünürdü.
  const istendi = useRef(false);
  useEffect(() => {
    if (istendi.current) return;
    istendi.current = true;
    void gonder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bekleme <= 0) return;
    const t = setTimeout(() => setBekleme((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [bekleme]);

  const gonder = async () => {
    setHata(null);
    setBilgi(null);
    try {
      const durum = await kodIste();
      if (durum === 'zaten_dogrulandi') return void bitti();
      setBilgi('Kodu e-postana gönderdik. Gelmediyse spam klasörüne de bak.');
      setBekleme(60);
    } catch (err) {
      // "Bekle" bir hata değil, sayaç: ekran sayacı gösterip sussun.
      if (err instanceof OtpHata && err.kod === 'bekle') setBekleme(err.saniye ?? 60);
      else setHata(otpMesaj(err));
    }
  };

  const bitti = async () => {
    await refreshVerification().catch(() => {});
    await reloadProfile().catch(() => {});
    router.replace('/(tabs)/hesap');
  };

  const dogrula = async () => {
    if (kod.length !== UZUNLUK) {
      setHata(`Kod ${UZUNLUK} haneli.`);
      return;
    }
    setGonderiliyor(true);
    setHata(null);
    try {
      await kodDogrula(kod, {
        telefon: duzeltme === 'telefon' ? telefon : undefined,
        ogrenciNo: duzeltme === 'ogrenciNo' ? ogrenciNo : undefined,
      });
      await bitti();
    } catch (err) {
      setHata(otpMesaj(err));
      if (err instanceof OtpHata) {
        // Çakışmada alanı aç ve mevcut değerle doldur: kullanıcı neyin
        // çakıştığını görmeden düzeltemez.
        if (err.kod === 'telefon_kullanimda' || err.kod === 'telefon_gecersiz') {
          setDuzeltme('telefon');
          setTelefon((v) => v || profile?.telefon || '');
        }
        if (err.kod === 'numara_kullanimda' || err.kod === 'numara_gecersiz') {
          setDuzeltme('ogrenciNo');
          setOgrenciNo((v) => v || profile?.ogrenciNo || '');
        }
      }
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <View style={styles.screen}>
      <GradientHeader gradient={gradients.section}>
        <View style={styles.headerRow}>
          <GlassButton label="‹" accessibilityLabel="Geri" onPress={() => router.back()} size={36} />
          <Txt weight="extrabold" size={20} color="#fff" style={{ marginLeft: 12 }}>
            E-postanı doğrula
          </Txt>
        </View>
        <Txt size={13} leading={1.5} color="rgba(255,255,255,0.82)" style={{ marginTop: 12 }}>
          {user?.email
            ? `${user.email} adresine altı haneli bir kod gönderdik.`
            : 'Adresine altı haneli bir kod gönderdik.'}
        </Txt>
      </GradientHeader>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
        >
          <ErrorBanner message={hata} />

          {bilgi ? (
            <View style={styles.info}>
              <Txt size={13} leading={1.45} color={colors.textBody}>
                {bilgi}
              </Txt>
            </View>
          ) : null}

          <Field label="Doğrulama kodu">
            <Input
              value={kod}
              onChangeText={(v) => setKod(digits(v, UZUNLUK))}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={UZUNLUK}
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              style={styles.kod}
            />
          </Field>

          {duzeltme === 'telefon' ? (
            <Field label="Telefon">
              <Input
                value={telefon}
                onChangeText={setTelefon}
                placeholder="0555 123 45 67"
                keyboardType="phone-pad"
              />
            </Field>
          ) : null}

          {duzeltme === 'ogrenciNo' ? (
            <Field label="Öğrenci Numarası">
              <Input
                value={ogrenciNo}
                onChangeText={(v) => setOgrenciNo(digits(v, 9))}
                placeholder="9 hane"
                keyboardType="number-pad"
                maxLength={9}
              />
            </Field>
          ) : null}

          <Pressable
            onPress={() => void gonder()}
            disabled={bekleme > 0}
            style={styles.tekrar}
          >
            <Txt
              weight="semibold"
              size={13}
              color={bekleme > 0 ? colors.faint : colors.blue500}
            >
              {bekleme > 0 ? `Tekrar gönder (${bekleme})` : 'Kodu tekrar gönder'}
            </Txt>
          </Pressable>

          <Txt size={12.5} leading={1.55} color={colors.muted}>
            Kod on dakika geçerli. Posta gelmediyse spam klasörüne bak; sorun
            sürerse info@kouseng.com adresine yazabilirsin.
          </Txt>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.submitBar, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          label={gonderiliyor ? 'Doğrulanıyor…' : 'Doğrula'}
          onPress={dogrula}
          disabled={gonderiliyor}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  form: { paddingHorizontal: 20, paddingTop: 22, gap: 18 },
  kod: { fontSize: 24, letterSpacing: 8, textAlign: 'center' },
  tekrar: { paddingVertical: 6 },
  info: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  submitBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
});
