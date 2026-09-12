/**
 * Giriş ve kayıt ekranlarının paylaştığı parçalar.
 *
 * Üç ekranda birebir aynı alan, onay kutusu ve hata şeridi vardı; üç kopya,
 * bir düzeltmeyi ikisinde unutmanın yoludur (bu defterde `csvCell` maddesi
 * aynı hatanın kaydı).
 */
import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { PixelIcon } from './Pixel';
import { Txt } from './ui';
import { colors, fonts, radius } from '../theme';

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Txt weight="bold" size={12.5} color={colors.textBody} style={{ marginBottom: 8 }}>
        {label}
      </Txt>
      {children}
      {error ? (
        <Txt size={12} color={colors.danger} style={{ marginTop: 6 }}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/**
 * Odak ve hata kenarlığını tek yerde tutan giriş kutusu.
 *
 * `ref` props'ta bilerek tanımlı: React 19'da fonksiyon bileşenleri için `ref`
 * sıradan bir prop, `forwardRef` gerekmiyor — ama tipte yazılmazsa geçmiyor.
 * Doğum tarihi kutuları hane dolunca sıradakine odaklanmak için kullanıyor.
 */
export function Input({
  error = false,
  ref,
  ...rest
}: TextInputProps & { error?: boolean; ref?: React.Ref<TextInput> }) {
  const [focused, setFocused] = React.useState(false);
  return (
    <TextInput
      ref={ref}
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        rest.onBlur?.(e);
      }}
      placeholderTextColor={colors.faint}
      style={[
        styles.input,
        focused && { borderColor: colors.blue500 },
        error && { borderColor: colors.dangerBorder },
        rest.style,
      ]}
    />
  );
}

/**
 * Onay kutusu.
 *
 * Metnin içindeki bağlantı ayrı bir `Pressable` olmak zorunda: iç içe
 * olsaydı bağlantıya basmak kutuyu da işaretlerdi — kullanıcının onayladığını
 * sanmadığı bir onay.
 */
export function Consent({
  checked,
  onToggle,
  children,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <View>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.consent}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: error && !checked ? colors.dangerBorder : checked ? colors.blue500 : colors.switchOff,
              backgroundColor: checked ? colors.blue500 : colors.surface,
            },
          ]}
        >
          {checked ? <PixelIcon name="check" size={11} color="#fff" /> : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Pressable>
      {error && !checked ? (
        <Txt size={12} color={colors.danger} style={{ marginTop: 4, paddingLeft: 33 }}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/** Sunucudan gelen hata. Boşken hiç çizilmiyor — boş bir kutu bir mesaj değil. */
export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.banner}>
      <Txt size={13} leading={1.45} color={colors.danger}>
        {message}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
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
  consent: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', paddingVertical: 2 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  banner: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
