const BASE_URL = "https://www.gob.mx";
const TARGET_URL = "https://www.gob.mx/bienestar";
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

export async function scrapeImagenes(env) {
  try {
    const maxImagenes = parseInt(env.MAX_IMAGENES) || 15;
    const scrapeUrl = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/scrape`;

    console.log("Iniciando scraping de", TARGET_URL);

    const response = await fetch(scrapeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
      },
      body: JSON.stringify({
        url: TARGET_URL,
        elements: [
          {
            selector: 'div.section[onclick]',
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error en Browser Rendering API:", response.status, errorText);
      return [];
    }

    const data = await response.json();

    if (!data.result || !data.result.length) {
      console.log("No se encontraron elementos en el scraping.");
      return [];
    }

    const elementos = data.result[0].results || [];
    console.log(`Se encontraron ${elementos.length} elementos con selector div.section[onclick]`);

    const imagenes = [];

    for (const el of elementos) {
      try {
        const html = el.html || "";
        const attributes = el.attributes || [];

        // Extraer thumbnail_url del primer <img> hijo
        const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        let thumbnail_url = imgMatch ? imgMatch[1] : null;

        // Extraer full_image_url del onclick
        const onclickAttr = attributes.find((a) => a.name === "onclick");
        const onclickValue = onclickAttr ? onclickAttr.value : "";
        const hrefMatch = onclickValue.match(/location\.href=["']([^"']+)["']/);
        let full_image_url = hrefMatch ? hrefMatch[1] : null;

        // Resolver URLs relativas a absolutas
        if (thumbnail_url && !thumbnail_url.startsWith("http")) {
          thumbnail_url = new URL(thumbnail_url, BASE_URL).href;
        }
        if (full_image_url && !full_image_url.startsWith("http")) {
          full_image_url = new URL(full_image_url, BASE_URL).href;
        }

        // Validar que ambas URLs existan y full_image_url sea una imagen
        if (!thumbnail_url || !full_image_url) continue;

        const esImagen = IMAGE_EXTENSIONS.some((ext) =>
          full_image_url.toLowerCase().endsWith(ext)
        );
        if (!esImagen) continue;

        imagenes.push({ thumbnail_url, full_image_url });
      } catch (error) {
        console.error("Error procesando elemento:", error);
        continue;
      }
    }

    const resultado = imagenes.slice(0, maxImagenes);
    console.log(`Retornando ${resultado.length} imágenes (límite: ${maxImagenes})`);
    return resultado;
  } catch (error) {
    console.error("Error general en scraping:", error);
    return [];
  }
}
