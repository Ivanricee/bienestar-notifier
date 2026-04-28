import { getTemaById } from "./kv/temas.js";

export async function enviarNotificaciones(matches, tema_id, env) {
  let enviados = 0;
  let fallidos = 0;

  try {
    const tema = await getTemaById(tema_id, env);
    if (!tema) {
      console.error(`Tema ${tema_id} no encontrado para envío`);
      return { enviados: 0, fallidos: matches.length };
    }

    const plantilla = tema.plantilla_mensaje || "{contenido}";

    for (const match of matches) {
      try {
        const { destinatario } = match;
        let mensajes = [];

        if (match.fechas_asignadas) {
          // Match por inicial: una notificación con todas las fechas
          const lineas = match.fechas_asignadas.map((f) => {
            return plantilla
              .replace(/\{nombre\}/g, destinatario.nombre)
              .replace(/\{fecha\}/g, f.fecha || "")
              .replace(/\{actividad\}/g, f.actividad || "");
          });
          mensajes.push(lineas.join("\n"));
        } else if (match.datos_completos) {
          // Match general: enviar datos completos
          const contenido =
            typeof match.datos_completos === "string"
              ? match.datos_completos
              : JSON.stringify(match.datos_completos, null, 2);
          const msg = plantilla
            .replace(/\{nombre\}/g, destinatario.nombre)
            .replace(/\{contenido\}/g, contenido);
          mensajes.push(msg);
        }

        for (const texto of mensajes) {
          const ok = await enviarMensajeTelegram(
            destinatario.chat_id,
            texto,
            env
          );
          if (ok) {
            enviados++;
          } else {
            fallidos++;
          }
        }
      } catch (error) {
        console.error(
          `Error enviando a ${match.destinatario.nombre}:`,
          error
        );
        fallidos++;
      }
    }
  } catch (error) {
    console.error("Error general en envío de notificaciones:", error);
  }

  console.log(`Notificaciones: ${enviados} enviadas, ${fallidos} fallidas`);
  return { enviados, fallidos };
}

async function enviarMensajeTelegram(chat_id, text, env) {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
          text,
          parse_mode: "HTML",
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Error Telegram API (${chat_id}):`, response.status, errorData);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error de red enviando a ${chat_id}:`, error);
    return false;
  }
}
