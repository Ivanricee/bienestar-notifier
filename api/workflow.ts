/*app.post(
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
/* })
);*/
