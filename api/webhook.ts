import { VercelRequest, VercelResponse } from "@vercel/node";
import { sendMessage } from "../src/lib/notifier.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const message = req.body?.message;
  const chatId = req.body?.chat_id;
  const action = req.body?.action;
  if (chatId !== process.env.TELEGRAM_CHAT_ID) return res.status(200).json({ ok: true });

  if (action === "/calendario") {
    //trigger workflow
    await sendMessage(chatId, "✅ Proceso iniciado. Te avisaré cuando termine.");
  }
  return res.status(200).json({ ok: true });
}
