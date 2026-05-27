// api/telegram/webhook.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Client } from "@upstash/workflow";
import { sendMessage } from "../src/lib/notifier.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  // Verificar que viene de Telegram
  const telegramSecret = req.headers["x-telegram-bot-api-secret-token"];
  console.log({ haeders: req.headers, env: process.env.TELEGRAM_WEBHOOK_SECRET });
  if (telegramSecret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).send("Unauthorized");
  }

  const message = req.body?.message;
  const chatId = message?.chat?.id?.toString();
  const action = message?.text;

  //verificar que es el administrador
  if (chatId !== process.env.TELEGRAM_ADMIN_CHAT_ID) {
    return res.status(200).json({ ok: true });
  }

  if (action === "/calendario") {
    const client = new Client({ token: process.env.QSTASH_TOKEN! });
    await client.trigger({
      url: "https://bienestar-notifier.vercel.app/api/workflow-once",
    });
    await sendMessage(chatId, "✅ Proceso iniciado. Te avisaré cuando termine.");
  }

  return res.status(200).json({ ok: true });
}
