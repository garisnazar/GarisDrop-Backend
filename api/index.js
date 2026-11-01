const admin = require('firebase-admin');

// Инициализация Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();

export default async function handler(req, res) {
  // Разрешаем запросы с твоего сайта
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-telegram-init-data');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Простейший API для получения баланса (демо)
  if (req.url === '/api/user' && req.method === 'GET') {
    return res.status(200).json({ balance: 1000 });
  }

  // Здесь будет логика вебхука для Telegram Stars
  return res.status(200).json({ status: 'ok' });
}