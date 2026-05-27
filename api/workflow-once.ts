// src/workflow.ts

// api/workflow-once.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { servePagesRouter } from "@upstash/workflow/nextjs";
import { sendAllMessages, sendMessage } from "../src/lib/notifier.js";
import { getClassifiedImages, saveNewItems } from "../src/lib/imgClassifier.js";
import { generateTemplates } from "../src/lib/reasoning.js";
import { analyzeImagesWithVision } from "../src/lib/vision.js";
import { scrapeImages } from "../src/lib/scraper.js";

const { handler } = servePagesRouter(async (context) => {
  const scrapedImages = await context.run("scrape", async () => {
    await sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID!, "✅ handler delivered");
    console.log("test scraped");
    return await scrapeImages("https://www.gob.mx/bienestar");
  });

  const classifiedImages = await context.run("classify", async () => {
    console.log(`test classified srapedtext: ${scrapedImages}`);
    //await sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID!, "✅ classifiedImages delivered");
    return await getClassifiedImages(scrapedImages);
  });

  if (!classifiedImages || classifiedImages.length === 0) {
    await context.run("notify-empty", async () => {
      // notificar al admin que no hubo nada nuevo
      await sendMessage(
        process.env.TELEGRAM_ADMIN_CHAT_ID!,
        "ℹ️ No se encontró información nueva."
      );
    });
    return;
  }

  const visionResults = await context.run("vision", async () => {
    await sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID!, "✅ visionResults delivered");
    console.log(`test vision  classified text: ${classifiedImages}`);
    return await analyzeImagesWithVision(classifiedImages);
  });

  if (visionResults.length === 0) {
    await context.run("notify-empty", async () => {
      await sendMessage(
        process.env.TELEGRAM_ADMIN_CHAT_ID!,
        "ℹ️ No se confirmó ninguna imagen relevante."
      );
    });
    return;
  }

  const messages = await context.run("template", async () => {
    console.log(`test template vision text: ${visionResults}`);
    await sendMessage(process.env.TELEGRAM_ADMIN_CHAT_ID!, "✅ messages delivered");
    return await generateTemplates(visionResults);
  });

  if (messages.length === 0) {
    await context.run("notify-empty", async () => {
      await sendMessage(
        process.env.TELEGRAM_ADMIN_CHAT_ID!,
        "ℹ️ No se generaron mensajes para los destinatarios."
      );
    });
    return;
  }

  await context.run("notify", async () => {
    await console.log(`send mesages: ${messages} \n save new items:  ${visionResults}`);
    await sendMessage(
      process.env.TELEGRAM_ADMIN_CHAT_ID!,
      "✅ notify messages delivered end of transmision"
    );
    await sendAllMessages(messages);
    await saveNewItems(visionResults);
  });
});

export default async function workflowOnceHandler(req: VercelRequest, res: VercelResponse) {
  await handler(req as any, res as any);
}
