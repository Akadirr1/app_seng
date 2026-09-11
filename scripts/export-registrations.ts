/**
 * Kayıtları CSV'ye çıkarır — yoklama listesi için.
 *
 *   npm run export                      # tüm kayıtlar
 *   npm run export -- --event ev2       # tek etkinlik
 *   npm run export -- --out yoklama.csv # dosyaya yaz (varsayılan: ekrana)
 *
 * `registrations` koleksiyonu firestore.rules gereği istemciye kapalı — bu doğru
 * olan, kimse başkasının başvurusunu okuyamamalı. Bu yüzden script Admin SDK
 * kullanıyor ve `npm run push` ile aynı servis hesabı anahtarını istiyor.
 * Anahtar güvenlik kurallarını tamamen bypass eder; asla commit etmeyin.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import './load-env';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { csvCell } from '../admin/csv';

const COLUMNS = [
  // Firestore doküman kimliği: eventId__studentNo. İki dışa aktarım
  // birleştirilirken aynı kaydın iki kez sayılmaması buna bakarak anlaşılıyor.
  'regId',
  'eventId',
  'code',
  'name',
  'studentNo',
  'department',
  'year',
  'createdAt',
] as const;

function arg(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
}

function loadServiceAccount() {
  const path = resolve(process.env.FIREBASE_SERVICE_ACCOUNT ?? './service-account.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    console.error(
      `Servis hesabı anahtarı okunamadı: ${path}\n\n` +
        'Firebase Console → Project settings → Service accounts → Generate new key\n' +
        "ile indirip ./service-account.json olarak koyun ya da .env'e\n" +
        'FIREBASE_SERVICE_ACCOUNT=/tam/yol/anahtar.json yazın.',
    );
    process.exit(1);
  }
}


async function main() {
  initializeApp({ credential: cert(loadServiceAccount()) });
  const db = getFirestore();

  const eventId = arg('event');
  let query = db.collection('registrations') as FirebaseFirestore.Query;
  if (eventId) query = query.where('eventId', '==', eventId);

  const snapshot = await query.get();
  if (snapshot.empty) {
    console.error(eventId ? `"${eventId}" için kayıt yok.` : 'Hiç kayıt yok.');
    process.exit(0);
  }

  const rows = snapshot.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>;
    return COLUMNS.map((col) => {
      const value = d[col];
      // serverTimestamp okunabilir bir tarihe çevrilir.
      if (col === 'createdAt' && value && typeof (value as any).toDate === 'function') {
        return (value as any).toDate().toISOString();
      }
      return value;
    });
  });

  // Öğrenci numarasına göre sırala — yoklamada aranan alan bu.
  const studentNoIndex = COLUMNS.indexOf('studentNo');
  rows.sort((a, b) => String(a[studentNoIndex]).localeCompare(String(b[studentNoIndex]), 'tr'));

  const csv = [
    COLUMNS.join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\r\n');

  const out = arg('out');
  if (out) {
    // BOM olmadan Excel UTF-8'i Windows-1254 sanıp Türkçe karakterleri bozuyor.
    writeFileSync(resolve(out), '﻿' + csv, 'utf8');
    console.error(`${rows.length} kayıt yazıldı: ${resolve(out)}`);
  } else {
    // Sadece CSV stdout'a gider, böylece `npm run export > dosya.csv` çalışır.
    console.log(csv);
    console.error(`\n${rows.length} kayıt.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
