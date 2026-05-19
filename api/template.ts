import type { VercelRequest, VercelResponse } from "@vercel/node";
import { reasoningGenerateTemplate } from "../src/lib/reasoning.js";
import { sendAllMessages } from "../src/lib/notifier.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const templateMessages = await reasoningGenerateTemplate();
  await sendAllMessages(templateMessages);
  res.json(templateMessages);
}
