type responseScrape = {
  onclick: string;
  images: string[];
};
export interface ScrapeImagesType {
  id: string;
  onclick: string;
  raw_url: string;
  thumbnail_url: string;
}
/**
 *  Obtener imágenes de gob.mx/bienestar
 * @param url The URL to scrape
 * @returns The scraped images and image URLs
 */

export const scrapeImages = async (url: string): Promise<ScrapeImagesType[]> => {
  console.log("Scraping articles from:", url);
  const response = await fetch(
    `https://production-sfo.browserless.io/chromium/bql?token=${process.env.BROWSERLESS_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
        mutation GetAllDivsWithOnclick {
          goto(url: "${url}", waitUntil: domContentLoaded, timeout: 30000) {
            status
          }

          scroll1: scroll(y: 1000) {
            time
          }

          wait1: waitForTimeout(time: 2000) {
            time
          }

          scroll2: scroll(y: 3000) {
            time
          }

          wait2: waitForTimeout(time: 2000) {
            time
          }

          scroll3: scroll(y: 6000) {
            time
          }

          wait3: waitForTimeout(time: 2000) {
            time
          }

          scroll4: scroll(y: 10000) {
            time
          }

          wait4: waitForTimeout(time: 3000) {
            time
          }

          divs: mapSelector(selector: "div.section[onclick]") {
            onclickValue: attribute(name: "onclick") {
              value
            }
            image: mapSelector(selector: "img") {
              src: attribute(name: "src") {
                value
              }
            }
          }
        }
        `,
      }),
    }
  );
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  const data = await response.json();
  const divs = data.data.divs;

  const results: responseScrape[] = divs.map((div: any) => ({
    onclick: div.onclickValue?.value,
    images: div.image?.map((img: any) => img.src?.value) ?? [],
  }));
  const imageUrls = processBanner(results);
  console.log("imageUrls: ", imageUrls);
  return imageUrls;
};

function processBanner(banners: responseScrape[]): ScrapeImagesType[] {
  const bannersArr = [] as ScrapeImagesType[];

  for (const itemBanner of banners) {
    // 1. Extraer y limpiar la URL del onclick
    const match = itemBanner.onclick.match(/location\.href\s*=\s*['"]([^'"]+)['"]/);
    const cleanOnclick = match ? match[1] : null;
    // 2. Procesar la imagen
    const thumbnail_url = itemBanner.images[0] ? getCloudinaryImg(itemBanner.images[0]) : null;
    if (!thumbnail_url || !cleanOnclick) continue;
    // 3. Agregar al resultado
    bannersArr.push({
      id: crypto.randomUUID(),
      onclick: cleanOnclick,
      raw_url: itemBanner.images[0],
      thumbnail_url,
    });
  }
  return bannersArr;
}

function getCloudinaryImg(urlImage: string) {
  const baseUrl = "https://www.gob.mx";
  const cloudinaryUrl = "https://res.cloudinary.com/ivanrice-c/image/fetch/";
  const cloudinaryTransformation = "c_limit,w_1120,h_1120,f_webp,q_auto/";
  return `${cloudinaryUrl}${cloudinaryTransformation}${baseUrl}${urlImage}`;
}
