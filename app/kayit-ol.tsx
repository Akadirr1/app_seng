import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MIN_PASSWORD,
  digits,
  formatPhone,
  joinDate,
  normalizePhone,
  splitDate,
  validateSignup,
  type DateParts,
  type FieldErrors,
  type SignupInput,
} from '../src/accountSchema';
import { authErrorMessage, signUp } from '../src/auth';
import { useAuth } from '../src/authStore';
import { Consent, ErrorBanner, Field, Input } from '../src/components/AuthForm';
import { GlassButton, GradientHeader, PrimaryButton, Txt } from '../src/components/ui';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../src/data';
import { colors, gradients } from '../src/theme';

const BOS: SignupInput = {
  adSoyad: '',
  email: '',
  dogumTarihi: '',
  telefon: '',
  ogrenciNo: '',
  parola: '',
  kvkkOnay: false,
  kosullarOnay: false,
};

export default function SignupRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reloadProfile } = useAuth();

  const [form, setForm] = useState<SignupInput>(BOS);
  // Doğrulama hataları yalnızca gönderime basıldıktan sonra gösteriliyor:
  // ilk harfte kırmızıya boyanan bir form, henüz hata yapmamış birine hata
  // yaptığını söylüyor.
  const [errors, setErrors] = useState<FieldErrors>({});
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const set = <K extends keyof SignupInput>(key: K, value: SignupInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Düzeltilen alanın hatası anında kalkıyor; düzelttikten sonra da kırmızı
    // duran bir alan kullanıcıyı ne yaptığını anlamadan bırakıyor.
    setErrors((e) => (key in e ? { ...e, [key]: undefined } : e));
  };

  const submit = async () => {
    const bulunan = validateSignup(form, new Date());
    setErrors(bulunan);
    if (Object.keys(bulunan).length) return;

    setGonderiliyor(true);
    setHata(null);
    try {
      await signUp(form);
      await reloadProfile();
      // Doğrudan doğrulamaya: doğrulanmamış hesap etkinliğe katılamıyor, yani
      // kullanıcıyı hesap sekmesine bırakmak yarıda kalmış bir iş bırakmak.
      router.replace('/dogrula');
    } catch (err) {
      setHata(authErrorMessage(err));
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
            Hesap oluştur
          </Txt>
        </View>
        <Txt size={13} leading={1.5} color="rgba(255,255,255,0.82)" style={styles.headerSub}>
          Etkinliklere katılmak için bir kez hesap açman yeterli. Bilgilerin
          sonraki kayıtlara kendiliğinden geliyor.
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

          <Field label="Ad Soyad" error={errors.adSoyad}>
            <Input
              value={form.adSoyad}
              onChangeText={(v) => set('adSoyad', v)}
              placeholder="Elif Yılmaz"
              autoCapitalize="words"
              autoComplete="name"
              error={!!errors.adSoyad}
            />
          </Field>

          <Field label="E-posta" error={errors.email}>
            <Input
              value={form.email}
              onChangeText={(v) => set('email', v)}
              placeholder="elif@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              error={!!errors.email}
            />
          </Field>

          <Field label="Doğum Tarihi" error={errors.dogumTarihi}>
            <DateFields value={form.dogumTarihi} onChange={(v) => set('dogumTarihi', v)} />
          </Field>

          <Field label="Telefon" error={errors.telefon}>
            <Input
              value={form.telefon}
              onChangeText={(v) => set('telefon', v)}
              placeholder="0555 123 45 67"
              keyboardType="phone-pad"
              autoComplete="tel"
              error={!!errors.telefon}
            />
            {normalizePhone(form.telefon) ? (
              <Txt size={12} color={colors.muted} style={{ marginTop: 6 }}>
                {formatPhone(normalizePhone(form.telefon)!)} olarak kaydedilecek.
              </Txt>
            ) : null}
          </Field>

          <Field label="Öğrenci Numarası" error={errors.ogrenciNo}>
            <Input
              value={form.ogrenciNo}
              onChangeText={(v) => set('ogrenciNo', digits(v, 9))}
              placeholder="9 hane"
              keyboardType="number-pad"
              maxLength={9}
              error={!!errors.ogrenciNo}
            />
            {/* Numaranın hesaba bağlanması e-posta doğrulandığı anda oluyor
                (bkz. admin/claims.ts): bir numara tek hesapta kullanılabiliyor,
                yani aynı kişi ikinci bir hesapla ikinci sertifika alamıyor. */}
            <Txt size={12} color={colors.muted} style={{ marginTop: 6 }}>
              Katılım sertifikana bu numara yazılacak.
            </Txt>
          </Field>

          <Field label="Parola" error={errors.parola}>
            <Input
              value={form.parola}
              onChangeText={(v) => set('parola', v)}
              placeholder={`En az ${MIN_PASSWORD} karakter`}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              error={!!errors.parola}
            />
          </Field>

          <View style={{ gap: 14, marginTop: 4 }}>
            <Consent
              checked={form.kvkkOnay}
              onToggle={() => set('kvkkOnay', !form.kvkkOnay)}
              error={errors.kvkkOnay}
            >
              <Txt size={12.5} leading={1.5} color={colors.muted}>
                Kişisel verilerimin aydınlatma metnindeki şekilde işlenmesini kabul ediyorum.
              </Txt>
            </Consent>
            <LegalLink label="KVKK aydınlatma metni ve gizlilik politikası" url={PRIVACY_POLICY_URL} />

            <Consent
              checked={form.kosullarOnay}
              onToggle={() => set('kosullarOnay', !form.kosullarOnay)}
              error={errors.kosullarOnay}
            >
              <Txt size={12.5} leading={1.5} color={colors.muted}>
                Kullanım koşullarını okudum ve kabul ediyorum.
              </Txt>
            </Consent>
            {/* Taban adres tanımlı değilken koşullar sayfası yok; olmayan bir
                belgeye bağlantı vermektense hiç çizmemek doğru olan. */}
            {TERMS_URL ? <LegalLink label="Kullanım koşulları" url={TERMS_URL} /> : null}
          </View>

          <Pressable onPress={() => router.replace('/giris')} style={styles.altLink}>
            <Txt size={13} color={colors.muted}>
              Zaten hesabın var mı?{' '}
              <Txt weight="semibold" size={13} color={colors.blue500}>
                Giriş yap
              </Txt>
            </Txt>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.submitBar, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          label={gonderiliyor ? 'Oluşturuluyor…' : 'Hesabı oluştur'}
          onPress={submit}
          disabled={gonderiliyor}
        />
      </View>
    </View>
  );
}

/**
 * Doğum tarihi üç kutu: gün, ay, yıl.
 *
 * **Kutular kendi ham hanelerini tutuyor.** Önceki hâli birleştirilmiş
 * `YYYY-MM-DD` değerini tek doğru kaynak sayıp her tuş vuruşunda sıfırla
 * tamamlıyordu: yıla `2` yazınca değer `0002` oluyor, o dört hane kutuya geri
 * basılıyor ve `maxLength={4}` dolduğu için klavye beşinci haneyi kabul
 * etmiyordu. Alan kullanılamaz hâle geliyordu — `2005` ancak yapıştırılarak
 * girilebiliyordu. Doldurma artık yalnızca `joinDate` içinde ve yalnızca üç
 * kutu da doluyken oluyor.
 *
 * Yerel tarih seçici (`@react-native-community/datetimepicker`) yeni bir
 * native modül demek; üç sayısal kutu doğru çalıştığında aynı işi görüyor ve
 * doğum yılı için kaydırmaktan hızlı.
 */
function DateFields({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [parts, setParts] = useState<DateParts>(() => splitDate(value));
  const ayRef = useRef<TextInput>(null);
  const yilRef = useRef<TextInput>(null);

  const set = (key: keyof DateParts, raw: string, sonraki?: React.RefObject<TextInput | null>) => {
    const next = { ...parts, [key]: raw };
    setParts(next);
    onChange(joinDate(next));
    // Hane dolunca sıradaki kutuya geç: gün ve ay iki hane, kullanıcının üç
    // kez ayrı ayrı dokunmasına gerek yok.
    if (raw.length === 2 && sonraki) sonraki.current?.focus();
  };

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Input
        value={parts.gun}
        onChangeText={(v) => set('gun', digits(v, 2), ayRef)}
        placeholder="Gün"
        keyboardType="number-pad"
        maxLength={2}
        style={{ flex: 1 }}
      />
      <Input
        ref={ayRef}
        value={parts.ay}
        onChangeText={(v) => set('ay', digits(v, 2), yilRef)}
        placeholder="Ay"
        keyboardType="number-pad"
        maxLength={2}
        style={{ flex: 1 }}
      />
      <Input
        ref={yilRef}
        value={parts.yil}
        onChangeText={(v) => set('yil', digits(v, 4))}
        placeholder="Yıl"
        keyboardType="number-pad"
        maxLength={4}
        style={{ flex: 1.4 }}
      />
    </View>
  );
}

function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      onPress={() => {
        Linking.openURL(url).catch(() => {
          // Tarayıcı yok ya da adres ulaşılamıyor. Formu bozmamak dışında
          // yapılacak bir şey yok.
        });
      }}
      accessibilityRole="link"
      style={({ pressed }) => [styles.legalLink, pressed && { opacity: 0.6 }]}
    >
      <Txt weight="semibold" size={12.5} color={colors.blue500}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerSub: { marginTop: 12 },
  form: { paddingHorizontal: 20, paddingTop: 22, gap: 18 },
  legalLink: { paddingLeft: 33, paddingTop: 2, paddingBottom: 2, marginTop: -8 },
  altLink: { paddingVertical: 12, alignItems: 'center' },
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
