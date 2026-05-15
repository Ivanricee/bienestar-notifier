const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function sendMessage(chat_id: string, text: string): Promise<void> {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id,
      text,
      parse_mode: "HTML",
    }),
  });
  console.log("Debug TELEGRAM response------------------");
  console.log("response", response);
  console.log("---------------------------------------");
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Telegram sendMessage failed: ${JSON.stringify(error)}`);
  }
}

// enviar todos los mensajes del Step 4
export async function sendAllMessages(
  messages: { chat_id: string; template_msg: string }[]
): Promise<void> {
  for (const { chat_id, template_msg } of messages) {
    await sendMessage(chat_id, template_msg);
  }
}
