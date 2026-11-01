const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const admin = require('firebase-admin');
const { CryptoBotAPI } = require('crypto-bot-api');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID;
const CRYPTO_BOT_TOKEN = process.env.CRYPTO_BOT_TOKEN;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const cryptoBot = new CryptoBotAPI(CRYPTO_BOT_TOKEN, 'main');

function validateInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return calculatedHash === hash;
}

const authMiddleware = (req, res, next) => {
  const initData = req.headers['x-telegram-init-data'];
  if (!initData || !validateInitData(initData)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const params = new URLSearchParams(initData);
  const user = JSON.parse(params.get('user'));
  req.userId = user.id;
  req.userName = user.first_name;
  next();
};

app.get('/api/user', authMiddleware, async (req, res) => {
  try {
    const docRef = db.collection('users').doc(String(req.userId));
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      await docRef.set({ balance: 1000, userId: req.userId, lastActive: Date.now() });
      return res.json({ balance: 1000 });
    }
    await docRef.update({ lastActive: Date.now() });
    res.json({ balance: docSnap.data().balance });
  } catch (e) {
    res.status(500).json({ error: 'DB Error' });
  }
});

app.post('/api/deposit/crypto', authMiddleware, async (req, res) => {
  const { amount } = req.body; 
  try {
    const invoice = await cryptoBot.createInvoice({
      asset: 'USDT',
      amount: String(amount),
      description: `Пополнение GarisDrop на ${amount} RUB`,
      payload: `deposit_${req.userId}_${amount}`
    });
    res.json({ pay_url: invoice.bot_invoice_url });
  } catch (error) {
    res.status(500).json({ error: 'Crypto Error' });
  }
});

app.post('/api/withdraw', authMiddleware, async (req, res) => {
  const { amount, method, details } = req.body;
  try {
    const docRef = db.collection('users').doc(String(req.userId));
    const docSnap = await docRef.get();
    if (docSnap.data().balance < amount) return res.status(400).json({ error: 'Мало средств' });
    await docRef.update({ balance: admin.firestore.FieldValue.increment(-amount) });
    const msg = `🔔 *ЗАЯВКА НА ВЫВОД*\n👤 Игрок: ${req.userName} (${req.userId})\n💸 Сумма: ${amount}\n📝 Метод: ${method}\n📌 Реквизиты: ${details}`;
    bot.sendMessage(ADMIN_ID, msg, { parse_mode: 'Markdown' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Withdraw Error' });
  }
});

bot.on('pre_checkout_query', (query) => {
  bot.answerPreCheckoutQuery(query.id, true);
});

bot.on('successful_payment', async (msg) => {
  const { invoice_payload, total_amount } = msg.successful_payment;
  const userId = msg.chat.id;
  if (invoice_payload.startsWith('stars_')) {
    const stars = total_amount / 100;
    await db.collection('users').doc(String(userId)).update({
      balance: admin.firestore.FieldValue.increment(stars)
    });
    bot.sendMessage(userId, `✅ Баланс пополнен на ${stars} ⭐!`);
  }
});

app.post('/webhook/crypto', async (req, res) => {
  const { update_type, payload } = req.body;
  if (update_type === 'invoice_paid') {
    const [_, userId, amount] = payload.payload.split('_');
    await db.collection('users').doc(String(userId)).update({
      balance: admin.firestore.FieldValue.increment(Number(amount) * 1.5)
    });
    bot.sendMessage(userId, `✅ Баланс пополнен на ${amount} RUB!`);
  }
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер работает на порту ${PORT}`));
