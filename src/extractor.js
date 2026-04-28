import { getTemaById } from "./kv/temas.js";
import { getHistorial, saveHistorial } from "./kv/historial.js";

export async function extraerDatos(clasificacion, env) {
  const { tema_id, full_image_url } = clasificacion;

  try {
    // Verificar duplicado en historial
    const historial = await getHistorial(tema_id, env);
    if (historial && historial.url === full_image_url) {
      console.log(`Imagen duplicada para tema ${tema_id}: ${full_image_url}`);
      return { duplicado: true };
    }

    // Obtener tema para el prompt de extracción
    const tema = await getTemaById(tema_id, env);
    if (!tema) {
      console.error(`Tema ${tema_id} no encontrado en KV`);
      return { error: true, full_image_url, tema_id };
    }

    // Descargar full_image_url y convertir a base64
    const imgResponse = await fetch(full_image_url);
    if (!imgResponse.ok) {
      console.error(`Error descargando full_image ${full_image_url}: ${imgResponse.status}`);
      return { error: true, full_image_url, tema_id };
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    const prompt = `${tema.prompt_extraccion}\n\nResponde SOLO en JSON válido, sin texto adicional, sin markdown, sin bloques de código.`;

    const aiResponse = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      image: base64,
    });

    const responseText = typeof aiResponse.response === "string"
      ? aiResponse.response
      : JSON.stringify(aiResponse.response);

    let datos;
    try {
      datos = JSON.parse(responseText);
    } catch (parseError) {
      // Intentar extraer JSON de la respuesta
      const jsonMatch = responseText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        datos = JSON.parse(jsonMatch[0]);
      } else {
        console.error("No se pudo parsear extracción de AI:", responseText);
        return { error: true, full_image_url, tema_id };
      }
    }

    // Actualizar historial
    await saveHistorial(tema_id, full_image_url, env);
    console.log(`Datos extraídos exitosamente para tema ${tema_id}`);

    return { datos, tema_id };
  } catch (error) {
    console.error("Error en extracción:", error);
    return { error: true, full_image_url, tema_id };
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
