import { scrapeImagenes } from "./scraper.js";
import { clasificarImagen } from "./classifier.js";
import { extraerDatos } from "./extractor.js";
import { matchDestinatarios } from "./matcher.js";
import { enviarNotificaciones } from "./messenger.js";
import { handleWebhook } from "./bot/webhook.js";

export default {
  async scheduled(event, env, ctx) {
    console.log("=== Cron ejecutado:", new Date().toISOString(), "===");

    try {
      // F1-F2: Scraping de imágenes
      const imagenes = await scrapeImagenes(env);
      if (imagenes.length === 0) {
        console.log("No se encontraron imágenes. Fin del ciclo.");
        return;
      }
      console.log(`${imagenes.length} imágenes obtenidas del scraping.`);

      let totalEnviados = 0;
      let totalFallidos = 0;

      for (const imagen of imagenes) {
        // F3-F4: Clasificación con AI Vision
        const clasificacion = await clasificarImagen(imagen, env);
        if (!clasificacion.relevante) {
          continue;
        }

        // F5-F6: Deduplicación y extracción
        const extraccion = await extraerDatos(clasificacion, env);
        if (extraccion.duplicado) {
          console.log(`Imagen duplicada para tema ${clasificacion.tema_id}, saltando.`);
          continue;
        }
        if (extraccion.error) {
          console.error(`Error extrayendo datos de ${clasificacion.full_image_url}`);
          continue;
        }

        // F7: Match destinatarios
        const matches = await matchDestinatarios(extraccion, env);
        if (matches.length === 0) {
          console.log(`Sin destinatarios para tema ${extraccion.tema_id}`);
          continue;
        }

        // F8-F9: Enviar notificaciones
        const resultado = await enviarNotificaciones(matches, extraccion.tema_id, env);
        totalEnviados += resultado.enviados;
        totalFallidos += resultado.fallidos;
      }

      console.log(
        `=== Ciclo completado: ${totalEnviados} enviados, ${totalFallidos} fallidos ===`
      );
    } catch (error) {
      console.error("Error fatal en ciclo scheduled:", error);
    }
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/webhook" && request.method === "POST") {
      return handleWebhook(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};
