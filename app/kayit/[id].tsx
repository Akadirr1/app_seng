import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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

import { PixelIcon } from '../../src/components/Pixel';
import {
  GlassButton,
  GradientHeader,
  MissingEvent,
  PrimaryButton,
  Segmented,
  Txt,
} from '../../src/components/ui';
import { useAuth } from '../../src/authStore';
import { AuthGate } from '../../src/components/AuthGate';
import { useContent, useEvent } from '../../src/content';
import { isFull } from '../../src/eventSchema';
import { DEPARTMENTS, PRIVACY_POLICY_URL, YEARS } from '../../src/data';
import { useAppStore } from '../../src/store';
import { colors, fonts, gradients, radius } from '../../src/theme';

const STUDENT_NO_LENGTH = 9;

export default function RegistrationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const event = useEvent(id);
  const { registeredCount } = useContent();
  const { register, registrationFor } = useAppStore();
  const { user, profile, loading: authLoading, emailVerified } = useAuth();

  const [name, setName] = useState('');
  const [studentNo, setStudentNo] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [kvkk, setKvkk] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  // Ad soyad profilden geliyor: kullanıcı bunu hesap açarken bir kez yazdı.
  // `useEffect` çünkü profil ilk render'da henüz okunmamış olabiliyor —
  // başlangıç değeri olarak vermek, geç gelen profili hiç görmemek demek.
  useEffect(() => {
    if (profile?.adSoyad) setName((mevcut) => mevcut || profile.adSoyad);
  }, [profile]);

  // After every hook, so the early return cannot change the hook order.
  if (!event) return <MissingEvent onBack={() => router.replace('/(tabs)/takvim')} />;

  // Katılma hesap istiyor. Gezinme değil, yalnızca bu eylem — Apple 5.1.1(v)
  // hesap tabanlı olmayan içeriği giriş duvarının arkasına koymayı yasaklıyor.
  if (!authLoading && !user) {
    return (
      <AuthGate
        title="Katılmak için giriş yap"
        body="Etkinlik kaydı hesabına bağlanıyor: bilgilerini bir kez yazıyorsun, kaydın telefonun değişse de duruyor."
        primary="Giriş yap"
        onPrimary={() => router.replace(`/giris?next=/kayit/${encodeURIComponent(event.id)}`)}
        secondary="Hesap oluştur"
        onSecondary={() => router.replace('/kayit-ol')}
        onBack={() => router.back()}
      />
    );
  }

  // Doğrulanmamış e-posta kuralda da reddediliyor; kullanıcıya sebebini
  // burada söylemek, Firestore'dan dönen izin hatasını göstermekten iyi.
  if (user && !emailVerified) {
    return (
      <AuthGate
        title="Önce e-postanı doğrula"
        body={`${user.email} adresine gönderdiğimiz bağlantıya bastıktan sonra kaydını tamamlayabilirsin.`}
        primary="Hesabıma git"
        onPrimary={() => router.push('/hesap')}
        onBack={() => router.back()}
      />
    );
  }

  // Detay ekranı dolu etkinlikte düğmeyi göstermiyor ama bu ekrana derin
  // bağlantıyla da gelinebiliyor. Zaten kayıtlı olan öğrenci engellenmiyor:
  // kontenjan dolduğu için kendi kaydını tekrar göndermesi kapanmamalı.
  const full = isFull(event, registeredCount(event.id)) && !registrationFor(event.id);

  const noValid = new RegExp(`^\\d{${STUDENT_NO_LENGTH}}$`).test(studentNo);
  // Only complain once they have started typing.
  const noError = studentNo.length > 0 && !noValid;
  const valid = !full && name.trim().length > 2 && noValid && !!department && !!year && kvkk;

  const submit = () => {
    if (!valid) return;
    register({ eventId: event.id, name: name.trim(), studentNo, department, year });
    router.replace(`/kayit-basarili?id=${event.id}`);
  };

  const inputStyle = (key: string, error = false) => [
    styles.input,
    focused === key && styles.inputFocused,
    error && { borderColor: colors.dangerBorder },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 130 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <GradientHeader gradient={gradients.form} bottomRadius={20} style={{ paddingBottom: 20 }}>
          <GlassButton label="‹" accessibilityLabel="Geri" onPress={() => router.back()} size={36} />
          <Txt weight="extrabold" size={23} color="#fff" tracking={-0.4} style={{ marginTop: 16 }}>
            Etkinlik Kaydı
          </Txt>
          <Txt size={13} color={colors.blue200} style={{ marginTop: 4 }}>
            {event.title}
          </Txt>
        </GradientHeader>

        <View style={styles.form}>
          <Field label="Ad Soyad">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Elif Yılmaz"
              placeholderTextColor={colors.faint}
              autoCapitalize="words"
              autoComplete="name"
              onFocus={() => setFocused('name')}
              onBlur={() => setFocused(null)}
              style={inputStyle('name')}
            />
          </Field>

          <Field label="Öğrenci Numarası">
            <TextInput
              value={studentNo}
              // Students paste from all sorts of places — strip anything non-numeric
              // and cap the length rather than rejecting the whole entry.
              onChangeText={(t) => setStudentNo(t.replace(/\D/g, '').slice(0, STUDENT_NO_LENGTH))}
              placeholder="21xxxxxxx"
              placeholderTextColor={colors.faint}
              inputMode="numeric"
              keyboardType="number-pad"
              onFocus={() => setFocused('no')}
              onBlur={() => setFocused(null)}
              style={[inputStyle('no', noError), { letterSpacing: 0.5 }]}
            />
            {noError ? (
              <Txt weight="semibold" size={12} color={colors.danger} style={{ marginTop: 7 }}>
                Öğrenci numarası {STUDENT_NO_LENGTH} haneli olmalı.
              </Txt>
            ) : null}
          </Field>

          <Field label="Bölüm">
            <View style={styles.chips}>
              {DEPARTMENTS.map((d) => {
                const active = d === department;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setDepartment(d)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.deptChip,
                      {
                        borderColor: active ? colors.blue500 : colors.border,
                        backgroundColor: active ? colors.blue100 : colors.surface,
                      },
                    ]}
                  >
                    <Txt weight="semibold" size={13} color={active ? colors.navy700 : colors.muted}>
                      {d}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="Sınıf">
            <Segmented
              value={year}
              onChange={setYear}
              options={YEARS.map((y) => ({ label: y, value: y }))}
              style={styles.yearSegmented}
            />
          </Field>

          <Pressable
            onPress={() => setKvkk(!kvkk)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: kvkk }}
            style={styles.consent}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: kvkk ? colors.blue500 : colors.switchOff,
                  backgroundColor: kvkk ? colors.blue500 : colors.surface,
                },
              ]}
            >
              {kvkk ? <PixelIcon name="check" size={11} color="#fff" /> : null}
            </View>
            <Txt size={12.5} leading={1.5} color={colors.muted} style={{ flex: 1 }}>
              Kayıt için verdiğim bilgilerin kulüp tarafından işlenmesini kabul ediyorum.
            </Txt>
          </Pressable>

          {/* Its own Pressable rather than a link inside the consent row: nested
              inside it, tapping the link would also toggle the checkbox. */}
          <Pressable
            onPress={() => {
              Linking.openURL(PRIVACY_POLICY_URL).catch(() => {
                // No browser, or the link is unreachable. Nothing useful to do
                // beyond not crashing the form.
              });
            }}
            accessibilityRole="link"
            style={({ pressed }) => [styles.policyLink, pressed && { opacity: 0.6 }]}
          >
            <Txt weight="semibold" size={12.5} color={colors.blue500}>
              Gizlilik politikası ve KVKK aydınlatma metni
            </Txt>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.submitBar, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton
          label={full ? 'Kontenjan doldu' : valid ? 'Kaydımı Tamamla' : 'Alanları doldur'}
          onPress={submit}
          disabled={!valid}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Txt weight="bold" size={12.5} color={colors.textBody} style={{ marginBottom: 8 }}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  form: { paddingHorizontal: 20, paddingTop: 22, gap: 18 },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 15,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
  },
  inputFocused: { borderColor: colors.blue500 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deptChip: { borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 11 },

  yearSegmented: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },

  consent: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', paddingVertical: 2 },
  policyLink: { paddingLeft: 33, paddingTop: 2, paddingBottom: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
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
