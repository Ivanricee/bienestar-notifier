// api/workflow.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { servePagesRouter } from "@upstash/workflow/nextjs";
import { CONFIG } from "../src/lib/webhook.config.js";
import { scrapeImages } from "../src/lib/scraper.js";
import { getClassifiedImages, saveNewItems } from "../src/lib/imgClassifier.js";
import { analyzeImagesWithVision } from "../src/lib/vision.js";
import { generateTemplates } from "../src/lib/reasoning.js";
import { sendAllMessages } from "../src/lib/notifier.js";

const { handler } = servePagesRouter(async (context) => {
  let attempt = 0;
  let found = false;

  while (attempt < CONFIG.MAX_ATTEMPTS && !found) {
    attempt++;
    //scrape
    const scrapedImages = await context.run(`scrape-${attempt}`, async () => {
      return await scrapeImages("https://www.gob.mx/bienestar");
    });
    //classify by url semantic and stored url id
    const classifiedImages = await context.run(`classify-${attempt}`, async () => {
      return await getClassifiedImages(scrapedImages);
    });
    //sleep if no images found
    if (!classifiedImages || classifiedImages.length === 0) {
      if (attempt < CONFIG.MAX_ATTEMPTS) {
        console.log("sleep no images found");
        await context.sleep(`sleep-${attempt}`, CONFIG.SLEEP_BETWEEN_SEARCHES);
      }
      continue;
    }
    //recognize images data related with topics of interest
    const visionResults = await context.run(`vision-${attempt}`, async () => {
      console.log("-------------visionResults: -----------------");
      return await analyzeImagesWithVision(classifiedImages);
    });
    //sleep if no images data found
    if (visionResults.length === 0) {
      if (attempt < CONFIG.MAX_ATTEMPTS) {
        console.log("sleep no images data found");
        await context.sleep(`sleep-${attempt}`, CONFIG.SLEEP_BETWEEN_SEARCHES);
      }
      continue;
    }
    //Generate messages based on vision results and prompt_template for telegram
    const messages = await context.run(`template-${attempt}`, async () => {
      console.log("-------------visionResults: -----------------");
      return await generateTemplates(visionResults);
    });

    //if no message generated, sleep
    if (messages.length === 0) {
      if (attempt < CONFIG.MAX_ATTEMPTS) {
        console.log("mensajes sin generar");
        await context.sleep(`sleep-${attempt}`, CONFIG.SLEEP_BETWEEN_SEARCHES);
      }
      continue;
    }

    //notify telegram and store id in redis
    await context.run(`notify-${attempt}`, async () => {
      console.log("-------------send messages: -----------------");
      await sendAllMessages(messages);
      await saveNewItems(visionResults);
    });

    found = true;
  }
});

export default async function workflowHandler(req: VercelRequest, res: VercelResponse) {
  await handler(req as any, res as any);
}
// api/workflow.ts
/*import type { VercelRequest, VercelResponse } from "@vercel/node";
import { servePagesRouter } from "@upstash/workflow/nextjs";
import { CONFIG } from "../src/lib/webhook.config.js";

const { handler } = servePagesRouter(async (context) => {
  let attempt = 0;
  let found = false;

  while (attempt < CONFIG.MAX_ATTEMPTS && !found) {
    attempt++;
    console.log(`[TEST] attempt ${attempt} of ${CONFIG.MAX_ATTEMPTS}`);

    const result = await context.run(`step-${attempt}`, async () => {
      // simula que encuentra en el intento 3
      const didFind = attempt === 3;
      console.log(`[TEST] step-${attempt}: found=${didFind}`);
      return didFind;
    });

    if (result) {
      found = true;
      console.log(`[TEST] encontro en intento ${attempt} — termina`);
      continue;
    }

    if (attempt < CONFIG.MAX_ATTEMPTS) {
      console.log(`[TEST] no encontro — durmiendo ${CONFIG.SLEEP_BETWEEN_SEARCHES}s`);
      await context.sleep(`sleep-${attempt}`, CONFIG.SLEEP_BETWEEN_SEARCHES);
      console.log(`[TEST] desperto del sleep ${attempt}`);
    }
  }

  console.log(`[TEST] workflow terminado. found=${found}`);
});

export default async function workflowTestHandler(req: VercelRequest, res: VercelResponse) {
  await handler(req as any, res as any);
}
*/
