/**
 * Oturum durumu.
 *
 * `AppStoreProvider` kayıtları ve bildirim tercihlerini tutuyor; bu ayrı
 * duruyor çünkü kaynağı cihaz değil sunucu: `onAuthStateChanged` ne derse o.
 * İkisini birleştirmek, AsyncStorage'dan gelen bir durumla Firebase'den gelen
 * bir durumu aynı `hydrated` bayrağının arkasına koymak olurdu.
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import type { Profile } from './accountSchema';
import { loadProfile, watchAuth, type User } from './auth';
import { isFirebaseConfigured } from './firebaseConfig';

type AuthState = {
  user: User | null;
  profile: Profile | null;
  /** İlk cevap gelene kadar true. Bu bitmeden "giriş yapılmamış" denemez. */
  loading: boolean;
  emailVerified: boolean;
  /** Profil sunucudan yeniden okunur — kayıt ekranı yazdıktan sonra gerekiyor. */
  reloadProfile: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // Yapılandırma yoksa Firebase hiç başlamıyor; sonsuza kadar yüklenen bir
  // ekran yerine hemen "oturum yok" demek doğru cevap.
  const [loading, setLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return watchAuth((next) => {
      setUser(next);
      setLoading(false);
    });
  }, []);

  // Profil kullanıcıya bağlı: kullanıcı değişince eskisi ekranda kalmamalı.
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    loadProfile(user.uid)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      // `.catch` olmadan reddedilen bir okuma yakalanmamış promise reddi
      // bırakıyor ve profil sonsuza kadar null kalıyor — bu defterde
      // `useLoaded` maddesi aynı hatanın kaydı.
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      profile,
      loading,
      emailVerified: !!user?.emailVerified,
      reloadProfile: async () => {
        if (!user) return;
        setProfile(await loadProfile(user.uid).catch(() => null));
      },
    }),
    [user, profile, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
