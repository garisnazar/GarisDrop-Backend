import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-telegram-init-data",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (!global.firebaseInit) {
        const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({ credential: cert(serviceAccount) });
        global.firebaseInit = true;
      }
      const db = getFirestore();

      const url = new URL(request.url);

      // API: Получить баланс (тестовый режим)
      if (url.pathname === "/api/user" && request.method === "GET") {
        return new Response(JSON.stringify({ balance: 1000 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // API: Создать заявку на вывод (для теста)
      if (url.pathname === "/api/withdraw" && request.method === "POST") {
        const body = await request.json();
        const { amount } = body;
        return new Response(JSON.stringify({ success: true, message: `Заявка на ${amount} создана` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "ok", message: "GarisDrop Backend is running on Cloudflare!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};