import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serve as workflowServe } from "@upstash/workflow/hono";
import { type ScrapeImagesType, scrapeImages } from "../src/lib/scraper.ts";
import { getClassifiedImages } from "../src/lib/imgClassifier.ts";
import { analyzeImagesWithVision } from "../src/lib/vision.ts";
import { reasoningGenerateTemplate } from "../src/lib/reasoning.ts";

/*import { analyzeImages, Vision } from "../src/lib/vision.ts";
import { makeDecision } from "../src/lib/reasoning.ts";
import { sendTelegram } from "../src/lib/notifier.ts";
import { isNewArticle, markAsSeen } from "../src/lib/storage.ts";*/
/**
 * ```
 * ---
 * obtener la url onclick y la imagen thubnail si tiene:
 * realizar una busqueda a un llm para ver si esa informacion concuerda con los temas que queremos notificar
 * si coincide, verificar si ya fue notificada y existe en el historial
 * si no, procesar la imagen y revisar nuevamente si es informacion relevante que se quiera notificar en los temas de intenres.
 * si es, notificar en telegram a las personas que tenan esos temas de intenres.
 * ---
imagenes = scrape()
  ↓ por cada imagen
  clasificacion = clasificar(imagen)
    ↓ si es relevante
    extraccion = extraer(clasificacion)
      ↓ si no es duplicada
      matches = match(extraccion)
        ↓ si hay matches

 */
const app = new Hono();

app.post(
  "/api/workflow",
  workflowServe(async (context) => {
    // En dev cambia esta variable a 10 para probar con 10 segundos
    //const SLEEP = 10; //Number(process.env.SLEEP_SECONDS ?? 60 * 60 * 24 * 7);
    const week = 0;
    const scraped: ScrapeImagesType[] = await context.run(`scrape-week-${week}`, async () => {
      return await scrapeImages("https://www.gob.mx/bienestar");
    });
    console.log({ scraped });

    /*for (let week = 0; week < 3; week++) {

      const vision: Vision[] = await context.run(`vision-week-${week}`, async () => {
        return await analyzeImages(scraped.imageUrls);
      });

      const decision = await context.run(`decision-week-${week}`, async () => {
        return await makeDecision(vision);
      });

      const isNew = await context.run(`check-new-week-${week}`, async () => {
        if (!decision.found) return false;
        return await isNewArticle(decision.articleId);
      });

      if (isNew) {
        await context.run(`notify-week-${week}`, async () => {
          await sendTelegram(`📢 Nuevo artículo: ${decision.title}`);
          await markAsSeen(decision.articleId);
        });
        return;
      }

      if (week < 2) {
        await context.sleep(`week-${week}-sleep`, SLEEP);
      }
    }*/
  })
);
app.get("/api/scrape", async (c) => {
  const scraped: ScrapeImagesType[] = await scrapeImages("https://www.gob.mx/bienestar");
  return c.json(scraped);
});
app.get("/api/classify", async (c) => {
  const imageMatched = await getClassifiedImages(/*recibe scraped images */);
  return c.json(imageMatched);
});
app.get("api/vision", async (v) => {
  const visionResult = await analyzeImagesWithVision();
  console.log("Debug 4 visionResult------------------");
  console.log("visionResult", visionResult);
  console.log("---------------------------------------");
  return v.json(visionResult);
});
app.get("api/template", async (t) => {
  const templateResult = await reasoningGenerateTemplate(/*visionResult*/);
  return t.json(templateResult);
});
//extractor: ¿Qué dice la imagen? (AI Vision)
//endpoint to extract the info from the given image
//if calendario get onclick url image otherwise thumbnail image.
// extract the string data (maybe a double check to confirm thats the needed data)

//messenger endpoint to send data via telegram

app.get("/api/health", (c) => c.json({ status: "ok" }));
if (process.env.NODE_ENV !== "production") {
  serve({ fetch: app.fetch, port: 3000 }, () => {
    console.log("Server corriendo en http://localhost:3000");
  });
}

export default app;
