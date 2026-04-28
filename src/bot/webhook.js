import { handleCommand } from "./commands.js";

export async function handleWebhook(request, env) {
  try {
    const update = await request.json();

    let chat_id, text, callback_data;

    if (update.callback_query) {
      chat_id = String(update.callback_query.message.chat.id);
      callback_data = update.callback_query.data;
      // Responder al callback para quitar el "loading" del botón
      await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: update.callback_query.id }),
        }
      );
    } else if (update.message) {
      chat_id = String(update.message.chat.id);
      text = update.message.text || "";
    } else {
      return new Response("OK", { status: 200 });
    }

    // Validar que sea admin
    if (chat_id !== String(env.TELEGRAM_ADMIN_CHAT_ID)) {
      console.log(`Mensaje ignorado de chat_id no autorizado: ${chat_id}`);
      return new Response("OK", { status: 200 });
    }

    await handleCommand(chat_id, text, callback_data, env);

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Error en webhook:", error);
    return new Response("OK", { status: 200 });
  }
}
