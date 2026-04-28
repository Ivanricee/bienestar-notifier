import { getTemas } from "./kv/temas.js";

export async function clasificarImagen(imagen, env) {
  try {
    const temas = await getTemas(env);
    if (temas.length === 0) {
      console.log("No hay temas configurados, saltando clasificación.");
      return { relevante: false, sin_temas: true };
    }

    // Descargar thumbnail y convertir a base64
    const imgResponse = await fetch(imagen.thumbnail_url);
    if (!imgResponse.ok) {
      console.error(`Error descargando thumbnail ${imagen.thumbnail_url}: ${imgResponse.status}`);
      return { relevante: false, error: true };
    }

    const arrayBuffer = await imgResponse.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);

    // Construir lista de temas para el prompt
    const listaTemas = temas
      .map((t) => `- ${t.id}: palabras clave [${t.palabras_clave_deteccion.join(", ")}]`)
      .join("\n");

    const prompt = `Analiza esta imagen. Los temas de interés son:\n${listaTemas}\n\n¿Esta imagen hace referencia a alguno de estos temas? Responde SOLO en JSON válido, sin texto adicional, sin markdown, sin bloques de código. Usa esta estructura exacta: {"tema_id": "string o null", "confianza": "alta o baja", "razon": "string corto"}`;

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

    let resultado;
    try {
      resultado = JSON.parse(responseText);
    } catch (parseError) {
      // Intentar extraer JSON de la respuesta
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        resultado = JSON.parse(jsonMatch[0]);
      } else {
        console.error("No se pudo parsear respuesta de AI:", responseText);
        return { relevante: false, error: true };
      }
    }

    if (resultado.confianza === "baja" || !resultado.tema_id || resultado.tema_id === "null") {
      console.log(`Imagen no relevante (confianza: ${resultado.confianza}): ${resultado.razon}`);
      return { relevante: false, baja_confianza: true };
    }

    console.log(`Imagen relevante para tema ${resultado.tema_id}: ${resultado.razon}`);
    return {
      relevante: true,
      tema_id: resultado.tema_id,
      full_image_url: imagen.full_image_url,
    };
  } catch (error) {
    console.error("Error en clasificación:", error);
    return { relevante: false, error: true };
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
