# Bienestar Notifier — Guía Completa y Curso Práctico

Este documento explica a detalle cómo funciona el proyecto, las decisiones técnicas detrás de cada módulo, y te enseña los conceptos de Cloudflare Workers, Telegram Bot API, Workers AI y KV Storage paso a paso.

---

## Tabla de Contenido

1. [¿Qué es un Cloudflare Worker?](#1-qué-es-un-cloudflare-worker)
2. [Diferencia entre Workers y Node.js](#2-diferencia-entre-workers-y-nodejs)
3. [Anatomía del proyecto](#3-anatomía-del-proyecto)
4. [Variables de entorno, Secrets y el archivo .env](#4-variables-de-entorno-secrets-y-el-archivo-env)
5. [wrangler.toml — El cerebro de la configuración](#5-wranglertoml--el-cerebro-de-la-configuración)
6. [Entry Point: src/index.js](#6-entry-point-srcindexjs)
7. [Cloudflare KV — Base de datos clave-valor](#7-cloudflare-kv--base-de-datos-clave-valor)
8. [Módulos KV: temas, destinatarios, historial](#8-módulos-kv-temas-destinatarios-historial)
9. [Browser Rendering API — Scraping sin Puppeteer](#9-browser-rendering-api--scraping-sin-puppeteer)
10. [Workers AI Vision — Clasificación y extracción](#10-workers-ai-vision--clasificación-y-extracción)
11. [Matcher — Lógica de emparejamiento](#11-matcher--lógica-de-emparejamiento)
12. [Messenger — Plantillas y envío por Telegram](#12-messenger--plantillas-y-envío-por-telegram)
13. [Telegram Bot API — Conceptos fundamentales](#13-telegram-bot-api--conceptos-fundamentales)
14. [Webhook del bot — Recibir mensajes](#14-webhook-del-bot--recibir-mensajes)
15. [Comandos y flujo conversacional](#15-comandos-y-flujo-conversacional)
16. [Estado conversacional con TTL](#16-estado-conversacional-con-ttl)
17. [Cron Triggers — Ejecución programada](#17-cron-triggers--ejecución-programada)
18. [Flujo completo del sistema](#18-flujo-completo-del-sistema)
19. [Decisiones de diseño y trade-offs](#19-decisiones-de-diseño-y-trade-offs)
20. [Posibles puntos de falla y cómo manejarlos](#20-posibles-puntos-de-falla-y-cómo-manejarlos)
21. [Glosario](#21-glosario)

---

## 1. ¿Qué es un Cloudflare Worker?

Un **Cloudflare Worker** es código JavaScript que se ejecuta en la red global de Cloudflare (más de 300 ciudades en el mundo). No es un servidor tradicional — es una función que responde a eventos.

### ¿Por qué es diferente a un servidor normal?

| Concepto | Servidor tradicional | Cloudflare Worker |
|----------|---------------------|-------------------|
| Infraestructura | Tú rentas/manejas un servidor | Cloudflare lo maneja todo |
| Escalado | Tú configuras auto-scaling | Automático, sin configuración |
| Ubicación | Un datacenter específico | Edge global (cerca del usuario) |
| Inicio | El servidor está siempre corriendo | Se "despierta" solo cuando hay un evento |
| Costo | Pagas aunque no haya tráfico | Plan gratuito: 100,000 requests/día |
| Runtime | Node.js, Python, etc. | Runtime propio basado en V8 (el motor de Chrome) |

### Los dos tipos de eventos que un Worker puede recibir

```javascript
export default {
  // Evento 1: Alguien hace una petición HTTP al Worker
  async fetch(request, env, ctx) {
    return new Response("Hola mundo");
  },

  // Evento 2: Un cron trigger se activa según el horario configurado
  async scheduled(event, env, ctx) {
    console.log("El cron se ejecutó");
  },
};
```

**En nuestro proyecto usamos ambos:**
- `fetch` → para recibir los webhooks de Telegram (cuando el admin envía un comando al bot)
- `scheduled` → para ejecutar el scraping automático cada lunes a las 8 AM

---

## 2. Diferencia entre Workers y Node.js

Esto es **crítico** entenderlo porque muchas cosas que funcionan en Node.js NO funcionan en Workers:

### Lo que SÍ tienes disponible
- `fetch()` — peticiones HTTP (nativo, no necesitas instalar nada)
- `JSON.parse()`, `JSON.stringify()` — manipulación de JSON
- `btoa()`, `atob()` — codificación/decodificación base64
- `URL`, `URLSearchParams` — manipulación de URLs
- `TextEncoder`, `TextDecoder` — manipulación de texto
- `crypto` — funciones criptográficas
- `console.log()`, `console.error()` — logging (visible en el dashboard de Cloudflare)
- `setTimeout` — pero limitado y diferente a Node.js
- `Promise`, `async/await` — programación asíncrona

### Lo que NO tienes disponible
- `fs` — no hay sistema de archivos
- `path` — no hay rutas del sistema
- `process.env` — no hay variables de entorno de proceso (se usan bindings)
- `require()` — no hay CommonJS (solo ESM con `import/export`)
- `Buffer` — no existe (se usa `Uint8Array` y `ArrayBuffer`)
- `npm packages` que dependan de Node.js — no funcionarán

### ¿Por qué elegí JavaScript puro sin dependencias?

Porque el runtime de Workers ya incluye todo lo que necesitamos:
- `fetch` para las APIs de Cloudflare, Telegram e imágenes
- `btoa` para convertir imágenes a base64
- El binding `env.AI` para Workers AI (no necesitas SDK)
- El binding `env.BIENESTAR_KV` para KV (no necesitas SDK)

Agregar dependencias npm solo complicaría el proyecto sin beneficio real.

---

## 3. Anatomía del proyecto

```
bienestar-notifier/
├── wrangler.toml          ← Configuración del Worker (nombre, cron, bindings)
├── .env.example           ← SOLO para el script local init-kv.js
├── .gitignore             ← Archivos a ignorar en git
├── package.json           ← Metadata y scripts npm
├── README.md              ← Guía rápida de instalación
├── CURSO.md               ← Este documento
├── src/
│   ├── index.js           ← Punto de entrada (fetch + scheduled)
│   ├── scraper.js         ← Obtener imágenes de gob.mx/bienestar
│   ├── classifier.js      ← ¿Esta imagen es relevante? (AI Vision)
│   ├── extractor.js       ← ¿Qué dice la imagen? (AI Vision)
│   ├── matcher.js         ← ¿A quién le interesa?
│   ├── messenger.js       ← Enviar mensaje por Telegram
│   ├── bot/
│   │   ├── webhook.js     ← Recibir updates de Telegram
│   │   ├── commands.js    ← Procesar comandos del admin
│   │   └── state.js       ← Estado de conversaciones multi-paso
│   └── kv/
│       ├── temas.js       ← CRUD de temas en KV
│       ├── destinatarios.js ← CRUD de destinatarios en KV
│       └── historial.js   ← Registro de imágenes ya procesadas
└── scripts/
    └── init-kv.js         ← Script Node.js local para inicializar datos
```

### ¿Por qué esta estructura de carpetas?

**Principio: Separación de responsabilidades.** Cada archivo hace UNA cosa:

- `kv/` — Todo lo que toca la base de datos KV está aquí. Si mañana cambias KV por D1 (SQL de Cloudflare), solo tocas estos 3 archivos.
- `bot/` — Todo lo relacionado con Telegram como bot. Si mañana quieres cambiar a WhatsApp, solo tocas estos 3 archivos.
- Los módulos raíz de `src/` son el "pipeline" del cron: scraper → classifier → extractor → matcher → messenger. Cada uno recibe datos del anterior y pasa datos al siguiente.

---

## 4. Variables de entorno, Secrets y el archivo .env

### Tu pregunta: ¿Para qué sirve el .env si Cloudflare no lo usa?

**Tienes razón.** El Worker de Cloudflare **NUNCA lee un archivo `.env`**. Cloudflare tiene su propio sistema. El `.env` que creamos es **SOLO para un propósito**: el script `scripts/init-kv.js`, que se ejecuta **localmente en tu computadora con Node.js**, no en Cloudflare.

Vamos a desglosar los 3 sistemas diferentes:

### Sistema 1: Variables no sensibles → `wrangler.toml` con `[vars]`

```toml
[vars]
MAX_IMAGENES = "15"
```

Esto crea `env.MAX_IMAGENES` disponible dentro del Worker. Es para valores que **no son secretos** y puedes commitear a git sin problema.

**Dentro del Worker se accede así:**
```javascript
const limite = parseInt(env.MAX_IMAGENES); // → 15
```

### Sistema 2: Secrets (datos sensibles) → `wrangler secret put`

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
# Te pide el valor en la terminal, no queda en ningún archivo
```

Esto sube el valor **cifrado** a Cloudflare. Nunca toca tu disco. Dentro del Worker se accede **exactamente igual** que una variable:

```javascript
const token = env.TELEGRAM_BOT_TOKEN; // → "123456:ABC..."
```

**Los secrets de este proyecto son:**
- `TELEGRAM_BOT_TOKEN` — Si alguien lo obtiene, controla tu bot
- `TELEGRAM_ADMIN_CHAT_ID` — Quién puede controlar el bot
- `CF_ACCOUNT_ID` — Tu ID de cuenta Cloudflare
- `CF_API_TOKEN` — Token con permisos para llamar a la API de Cloudflare

### Sistema 3: Bindings → Conexiones a servicios de Cloudflare

```toml
# KV Storage
[[kv_namespaces]]
binding = "BIENESTAR_KV"
id = "abc123..."

# Workers AI
[ai]
binding = "AI"
```

Los bindings son conexiones directas a servicios de Cloudflare. No son strings como las variables — son **objetos** con métodos:

```javascript
// KV: es un objeto con métodos get, put, delete, list
await env.BIENESTAR_KV.get("config:temas");
await env.BIENESTAR_KV.put("config:temas", "...");

// AI: es un objeto con el método run
await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", { ... });
```

### Entonces, ¿el archivo .env?

El `.env.example` es una **plantilla** para que copies a `.env` y la uses **solo** cuando ejecutas:

```bash
node scripts/init-kv.js
```

Ese script corre en **tu computadora con Node.js** (no en Cloudflare). Necesita los tokens para llamar a la API REST de Cloudflare y llenar el KV con datos iniciales. Después de ejecutarlo una vez, podrías borrar el `.env` si quisieras.

**Resumen visual:**

```
┌─────────────────────────────────┐
│  TU COMPUTADORA (Node.js)       │
│                                 │
│  scripts/init-kv.js             │
│  Lee → .env (local)             │
│  Llama → API REST de Cloudflare │
│  Para → llenar KV con datos     │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  CLOUDFLARE (Worker runtime)    │
│                                 │
│  src/index.js + módulos         │
│  Lee → env.VARIABLE (bindings)  │
│  NO lee → .env (no existe ahí)  │
│  Secrets → wrangler secret put  │
│  Vars → wrangler.toml [vars]    │
└─────────────────────────────────┘
```

---

## 5. wrangler.toml — El cerebro de la configuración

`wrangler.toml` es el archivo que Wrangler CLI lee para saber cómo desplegar tu Worker. Vamos línea por línea:

```toml
name = "bienestar-notifier"
```
El nombre del Worker. Este nombre determina tu URL: `https://bienestar-notifier.<tu-subdomain>.workers.dev`

```toml
main = "src/index.js"
```
El punto de entrada. Wrangler busca aquí el `export default { fetch, scheduled }`.

```toml
compatibility_date = "2024-12-01"
```
Le dice a Cloudflare qué versión del runtime usar. Cloudflare actualiza su runtime regularmente, y esta fecha "congela" el comportamiento para que tu Worker no se rompa si cambian algo.

```toml
[triggers]
crons = ["0 8 * * 1"]
```
Sintaxis cron estándar: `minuto hora día-del-mes mes día-de-la-semana`. Aquí: minuto 0, hora 8, cualquier día del mes, cualquier mes, lunes (1). Es decir: **Lunes a las 8:00 AM UTC**.

```toml
[[kv_namespaces]]
binding = "BIENESTAR_KV"
id = "<TU_KV_NAMESPACE_ID>"
```
Los dobles corchetes `[[...]]` significan "array de objetos" en TOML. Podrías tener múltiples namespaces KV. El `binding` es el nombre con el que accedes en código (`env.BIENESTAR_KV`). El `id` es el identificador único que Cloudflare te da cuando creas el namespace.

```toml
[ai]
binding = "AI"
```
Habilita Workers AI y lo hace disponible como `env.AI`.

---

## 6. Entry Point: src/index.js

Este es el "director de orquesta". Su trabajo es simple: **coordinar el flujo**.

```javascript
export default {
  async scheduled(event, env, ctx) { ... },
  async fetch(request, env, ctx) { ... },
};
```

### Los 3 parámetros que siempre recibes

1. **`event`/`request`** — El evento que disparó la ejecución
   - En `scheduled`: contiene `event.cron` (qué cron lo activó) y `event.scheduledTime`
   - En `fetch`: es un objeto `Request` estándar de la Web API con URL, método, headers, body
2. **`env`** — Todas tus variables, secrets y bindings. Es como tu "mochila" con todo lo que configuraste en `wrangler.toml`
3. **`ctx`** — El contexto de ejecución. Tiene `ctx.waitUntil(promise)` para mantener el Worker vivo mientras se completa una tarea en segundo plano

### Decisión de diseño: Pipeline secuencial

El flujo del cron es **secuencial a propósito**:

```
imagenes = scrape()
  ↓ por cada imagen
  clasificacion = clasificar(imagen)
    ↓ si es relevante
    extraccion = extraer(clasificacion)
      ↓ si no es duplicada
      matches = match(extraccion)
        ↓ si hay matches
        enviar(matches)
```

¿Por qué no procesar todas las imágenes en paralelo con `Promise.all`? Porque:
- Workers AI tiene **límites de concurrencia** — demasiadas llamadas simultáneas darán error
- Si procesamos una por una, podemos **detenernos temprano** si ya encontramos lo que buscamos
- El scraping devuelve máximo 15 imágenes, así que la diferencia de tiempo es aceptable

### El fetch handler

```javascript
async fetch(request, env, ctx) {
  const url = new URL(request.url);
  if (url.pathname === "/webhook" && request.method === "POST") {
    return handleWebhook(request, env);
  }
  return new Response("Not Found", { status: 404 });
}
```

Solo acepta POST en `/webhook`. Todo lo demás retorna 404. Esto es importante por seguridad: no expones endpoints innecesarios.

---

## 7. Cloudflare KV — Base de datos clave-valor

### ¿Qué es KV?

KV (Key-Value) es una base de datos **distribuida globalmente** de Cloudflare. Piensa en ella como un diccionario gigante:

```
clave → valor
"config:temas" → '[{"id": "calendario_bienestar", ...}]'
"config:destinatarios" → '[{"nombre": "Juan", ...}]'
"historial:calendario_bienestar" → '{"url": "https://...", "timestamp": 17...}'
"bot:estado:123456" → '{"comando": "agregartema", "paso": 2, ...}'
```

### Características importantes

| Propiedad | Detalle |
|-----------|---------|
| Latencia de lectura | ~10ms (está en caché global) |
| Latencia de escritura | ~60s para propagarse globalmente |
| Tamaño máximo de valor | 25 MB |
| Tamaño máximo de clave | 512 bytes |
| Consistencia | **Eventual** (no inmediata) |
| TTL | Puedes hacer que un valor expire automáticamente |

### ¿Qué significa "consistencia eventual"?

Si escribes un valor y lo lees inmediatamente, **podrías obtener el valor viejo** durante unos segundos. Para nuestro caso no es problema porque:
- El cron corre una vez por semana (hay tiempo de sobra para que se propague)
- Los comandos del bot son secuenciales (un admin escribiendo, no miles de usuarios simultáneos)

### Operaciones KV

```javascript
// Leer
const valor = await env.BIENESTAR_KV.get("mi-clave");
// → retorna string o null si no existe

// Escribir
await env.BIENESTAR_KV.put("mi-clave", "mi-valor");

// Escribir con TTL (expira en 600 segundos)
await env.BIENESTAR_KV.put("mi-clave", "mi-valor", { expirationTtl: 600 });

// Eliminar
await env.BIENESTAR_KV.delete("mi-clave");

// Listar claves
const keys = await env.BIENESTAR_KV.list({ prefix: "historial:" });
```

### Convención de claves que usamos

Usamos prefijos con `:` para organizar las claves como si fueran carpetas:

- `config:temas` — Configuración de temas (array JSON)
- `config:destinatarios` — Configuración de destinatarios (array JSON)
- `historial:{tema_id}` — Última imagen procesada por tema
- `bot:estado:{chat_id}` — Estado conversacional temporal del bot

---

## 8. Módulos KV: temas, destinatarios, historial

### ¿Por qué crear módulos separados y no usar KV directamente?

Podríamos hacer `await env.BIENESTAR_KV.get("config:temas")` en cada módulo que lo necesite. Pero creamos una capa intermedia por 3 razones:

1. **Evitar repetición** — El `JSON.parse` y manejo de `null` se escribe una sola vez
2. **Consistencia** — Si cambias la estructura de datos, solo tocas un archivo
3. **Manejo de errores centralizado** — Cada función tiene su try/catch

### Estructura de datos en KV

**Temas** (`config:temas`):
```json
[
  {
    "id": "calendario_bienestar",
    "palabras_clave_deteccion": ["calendario", "bienestar", "actividades"],
    "match_por_inicial": true,
    "prompt_extraccion": "Extrae las fechas y actividades...",
    "plantilla_mensaje": "Hola {nombre}, tu actividad: {fecha} - {actividad}"
  }
]
```

**Destinatarios** (`config:destinatarios`):
```json
[
  {
    "nombre": "Juan Pérez",
    "chat_id": "123456789",
    "inicial_apellido": "P",
    "temas_suscritos": ["calendario_bienestar"]
  }
]
```

**Historial** (`historial:calendario_bienestar`):
```json
{
  "url": "https://www.gob.mx/cms/uploads/image/file/12345/calendario.jpg",
  "timestamp": 1710000000000
}
```

### Decisión: ¿Por qué un solo JSON grande y no una clave por tema?

Almacenamos todos los temas en UNA clave (`config:temas`) como array JSON, en lugar de tener `tema:calendario_bienestar`, `tema:comunicado_salud`, etc.

**Ventaja:** Leer todos los temas es 1 operación KV (no N operaciones). Cuando el classifier necesita comparar una imagen contra TODOS los temas, hace un solo `get`.

**Desventaja:** Si tienes 1000 temas, el JSON sería grande. Pero para este proyecto, tener más de 20 temas sería raro.

---

## 9. Browser Rendering API — Scraping sin Puppeteer

### El problema

La página `gob.mx/bienestar` probablemente carga contenido dinámicamente con JavaScript. Un simple `fetch` de la URL te devolvería el HTML inicial sin el contenido renderizado.

### La solución tradicional (que NO usamos)

Instalar Puppeteer o Playwright, levantar un navegador headless, esperar a que la página cargue, y extraer el DOM. Pero esto:
- Requiere un servidor con recursos (RAM, CPU)
- Es lento (arrancar un navegador toma segundos)
- No funciona en Workers (no puedes instalar Chrome en el edge)

### La solución Cloudflare: Browser Rendering API

Cloudflare tiene su **propio servicio de navegador headless** que puedes llamar vía API REST. Tú le dices "renderiza esta URL y dame los elementos que matcheen este selector CSS", y Cloudflare hace el trabajo pesado.

### Cómo funciona en nuestro scraper.js

```javascript
// La petición que hacemos
const response = await fetch(scrapeUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.CF_API_TOKEN}`,
  },
  body: JSON.stringify({
    url: "https://www.gob.mx/bienestar",
    elements: [
      {
        selector: 'div.section[onclick]',    // Selector CSS
      },
    ],
  }),
});
```

### ¿Qué es el selector `div.section[onclick]`?

Es CSS selector syntax:
- `div` — elementos `<div>`
- `.section` — que tengan la clase `section`
- `[onclick]` — que tengan un atributo `onclick`

Esto busca específicamente los bloques de contenido de la página de Bienestar que son clickeables y llevan a las imágenes completas.

### Procesamiento de resultados

De cada elemento extraemos dos cosas:

1. **thumbnail_url** — La imagen pequeña de vista previa (del tag `<img>` dentro del div)
2. **full_image_url** — La URL de la imagen completa (extraída del atributo `onclick`)

```javascript
// Del HTML interno del elemento
const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
let thumbnail_url = imgMatch ? imgMatch[1] : null;

// Del atributo onclick: onclick='location.href="url-de-imagen"'
const hrefMatch = onclickValue.match(/location\.href=["']([^"']+)["']/);
let full_image_url = hrefMatch ? hrefMatch[1] : null;
```

### URLs relativas vs absolutas

Las URLs en la página pueden ser relativas (ej: `/cms/uploads/image/file/123/foto.jpg`). Antes de usarlas necesitamos convertirlas a absolutas:

```javascript
if (thumbnail_url && !thumbnail_url.startsWith("http")) {
  thumbnail_url = new URL(thumbnail_url, "https://www.gob.mx").href;
  // "/cms/uploads/foto.jpg" → "https://www.gob.mx/cms/uploads/foto.jpg"
}
```

### Filtro de extensiones de imagen

Solo nos interesan URLs que terminen en extensiones de imagen:

```javascript
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const esImagen = IMAGE_EXTENSIONS.some((ext) =>
  full_image_url.toLowerCase().endsWith(ext)
);
```

Esto filtra links que van a páginas HTML u otros recursos que no son imágenes.

---

## 10. Workers AI Vision — Clasificación y extracción

### ¿Qué es Workers AI?

Es el servicio de IA de Cloudflare que te permite ejecutar modelos de machine learning directamente en el edge, sin configurar GPUs ni servidores.

### El modelo que usamos

`@cf/meta/llama-3.2-11b-vision-instruct` — Es un modelo de Meta (Llama 3.2) con capacidad de **visión**: puede "ver" imágenes y responder preguntas sobre ellas.

### Dos usos diferentes del mismo modelo

**Uso 1: Clasificación (classifier.js)**
- Input: imagen thumbnail + lista de temas
- Pregunta: "¿Esta imagen se relaciona con alguno de estos temas?"
- Output esperado: `{"tema_id": "calendario_bienestar", "confianza": "alta", "razon": "..."}`

**Uso 2: Extracción (extractor.js)**
- Input: imagen completa + prompt específico del tema
- Pregunta: El prompt personalizado (ej: "Extrae las fechas y actividades de este calendario")
- Output esperado: Los datos estructurados que necesitamos

### Cómo se envía una imagen a Workers AI

```javascript
// 1. Descargar la imagen
const imgResponse = await fetch(imagen_url);
const arrayBuffer = await imgResponse.arrayBuffer();

// 2. Convertir a base64
const base64 = arrayBufferToBase64(arrayBuffer);

// 3. Enviar al modelo
const aiResponse = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
  messages: [{ role: "user", content: "Tu prompt aquí" }],
  image: base64,
});
```

### ¿Por qué base64?

Las imágenes son datos binarios. No puedes meterlos directamente en JSON. Base64 es una codificación que convierte bytes binarios a texto ASCII. Es ~33% más grande que el original, pero es la forma estándar de incluir binarios en mensajes de texto.

```javascript
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

**Nota:** Esta función está duplicada en `classifier.js` y `extractor.js`. Es intencional para mantener cada módulo independiente (sin crear un `utils.js` que agregue otra capa de abstracción para algo tan pequeño).

### El truco del "JSON mode"

Los modelos de IA son impredecibles en formato. Pueden responder:
```
Claro, aquí está el JSON:
```json
{"tema_id": "calendario"}
```
```

Para forzar que respondan solo JSON:

```javascript
const prompt = "... Responde SOLO en JSON válido, sin texto adicional, sin markdown, sin bloques de código.";
```

Y aún así, siempre envolvemos el parse en try/catch con un fallback que intenta extraer JSON de la respuesta:

```javascript
try {
  resultado = JSON.parse(responseText);
} catch (parseError) {
  // Plan B: buscar algo que parezca JSON en la respuesta
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    resultado = JSON.parse(jsonMatch[0]);
  }
}
```

### Decisión: ¿Por qué dos llamadas a AI en vez de una?

Podríamos analizar directamente la imagen completa. Pero:

1. **Las imágenes completas son pesadas** — Descargar y procesar 15 imágenes grandes consume tiempo y recursos
2. **Los thumbnails son rápidos** — Son imágenes pequeñas, la clasificación es rápida
3. **La mayoría NO será relevante** — Si solo 1 de 15 es relevante, ahorramos 14 descargas de imágenes grandes
4. **Prompts diferentes** — La clasificación es genérica ("¿de qué tema es?"), la extracción es específica ("extrae fechas y actividades")

Es un patrón clásico de **filtrado progresivo**: primero filtras barato, luego procesas caro.

---

## 11. Matcher — Lógica de emparejamiento

### ¿Qué problema resuelve?

Ya tenemos datos extraídos (ej: fechas y actividades de un calendario). Ahora necesitamos saber **a quién enviarle qué**.

### Dos modos de matching

**Modo 1: Match por inicial de apellido** (`match_por_inicial: true`)

Para calendarios donde aparecen listas de personas con su inicial:
```
Lunes 15: Actividad X - Pérez (P)
Martes 16: Actividad Y - García (G)
```

La AI extrae un array como:
```json
[
  {"fecha": "Lunes 15", "actividad": "Actividad X", "inicial_apellido": "P"},
  {"fecha": "Martes 16", "actividad": "Actividad Y", "inicial_apellido": "G"}
]
```

El matcher busca destinatarios cuya `inicial_apellido` coincida y estén suscritos al tema. Así cada persona solo recibe SUS fechas.

**Modo 2: Match general** (`match_por_inicial: false`)

Para temas donde todos los suscritos deben recibir la misma información. Simplemente filtra destinatarios por suscripción y les envía los datos completos.

### ¿Por qué un Map para agrupar?

```javascript
const matches = new Map();
// ... por cada entrada, acumular fechas por destinatario
```

Un destinatario puede tener múltiples fechas asignadas. Con un Map indexado por `chat_id`, agrupamos todo y enviamos UN solo mensaje con todas sus fechas, en vez de bombardearlo con un mensaje por fecha.

---

## 12. Messenger — Plantillas y envío por Telegram

### Sistema de plantillas

Cada tema tiene una `plantilla_mensaje` con variables que se reemplazan:

```
Hola {nombre}, tienes una actividad programada:
📅 Fecha: {fecha}
📋 Actividad: {actividad}
```

Se convierte en:

```
Hola Juan Pérez, tienes una actividad programada:
📅 Fecha: Lunes 15
📋 Actividad: Revisión de documentos
```

### Envío Telegram

```javascript
await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: "123456789",
    text: "Tu mensaje aquí",
    parse_mode: "HTML",  // Permite <b>, <i>, <code>, <a>, etc.
  }),
});
```

### Decisión: `parse_mode: "HTML"` en vez de "Markdown"

Telegram soporta dos modos: HTML y MarkdownV2. Elegí HTML porque:
- Es más intuitivo (`<b>negrita</b>` vs `*negrita*`)
- MarkdownV2 requiere escapar muchos caracteres (`.`, `!`, `(`, `)`, etc.)
- Los datos extraídos por AI podrían contener caracteres que rompen Markdown

### Tolerancia a fallos

```javascript
for (const match of matches) {
  try {
    // enviar...
    enviados++;
  } catch (error) {
    console.error(`Error enviando a ${match.destinatario.nombre}:`, error);
    fallidos++;
    // NO hacemos throw — continuamos con los demás
  }
}
```

Si falla el envío a Juan, María sigue recibiendo su notificación. Nunca dejamos que un error individual detenga el flujo completo.

---

## 13. Telegram Bot API — Conceptos fundamentales

### ¿Qué es un bot de Telegram?

Es una cuenta especial de Telegram que no es operada por una persona sino por código. Se crea con [@BotFather](https://t.me/BotFather) y te da un **token** como `123456789:ABCdef...`.

### ¿Cómo recibe mensajes un bot?

Hay dos métodos:

**Método 1: Polling (getUpdates)**
Tu código llama repetidamente a la API preguntando "¿hay mensajes nuevos?". Simple pero ineficiente.

**Método 2: Webhook (lo que usamos)**
Le dices a Telegram "cuando alguien envíe un mensaje, haz un POST a esta URL". Telegram envía los updates a tu URL automáticamente.

```bash
# Registrar webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://bienestar-notifier.tu-user.workers.dev/webhook"
```

### ¿Por qué webhook y no polling?

- Workers no pueden estar "siempre corriendo" haciendo polling
- Con webhook, el Worker solo se activa cuando llega un mensaje
- Es más eficiente y encaja perfectamente con el modelo de Workers

### Estructura de un Update de Telegram

Cuando alguien envía un mensaje, Telegram hace POST con algo así:

```json
{
  "update_id": 123456,
  "message": {
    "message_id": 789,
    "chat": {
      "id": 123456789,
      "type": "private"
    },
    "text": "/vertemas",
    "from": {
      "id": 123456789,
      "first_name": "Juan"
    }
  }
}
```

Cuando alguien presiona un botón inline:

```json
{
  "update_id": 123457,
  "callback_query": {
    "id": "abc123",
    "message": {
      "chat": { "id": 123456789 }
    },
    "data": "eliminartema:calendario_bienestar"
  }
}
```

### Inline Keyboards (botones)

```javascript
await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    chat_id: "123456789",
    text: "Selecciona el tema:",
    reply_markup: {
      inline_keyboard: [
        [{ text: "calendario_bienestar", callback_data: "eliminartema:calendario_bienestar" }],
        [{ text: "comunicado_salud", callback_data: "eliminartema:comunicado_salud" }],
      ],
    },
  }),
});
```

Cada fila del `inline_keyboard` es un array de botones. El `callback_data` es lo que recibes cuando el usuario presiona el botón.

### Convención de callback_data

Usamos el formato `accion:parametro` para facilitar el parsing:

```javascript
const [action, param] = callback_data.split(":");
// "eliminartema:calendario_bienestar" → action="eliminartema", param="calendario_bienestar"
```

Para acciones que necesitan más parámetros:
```
"suscribir_tema:123456789:calendario_bienestar"
// action="suscribir_tema", luego split por ":" para obtener ambos params
```

---

## 14. Webhook del bot — Recibir mensajes

### Seguridad: Solo el admin

```javascript
if (chat_id !== String(env.TELEGRAM_ADMIN_CHAT_ID)) {
  console.log(`Mensaje ignorado de chat_id no autorizado: ${chat_id}`);
  return new Response("OK", { status: 200 });
}
```

Solo el `TELEGRAM_ADMIN_CHAT_ID` puede interactuar con el bot. Cualquier otro usuario es ignorado silenciosamente (sin mensaje de error, para no revelar que el bot existe).

### ¿Por qué siempre retornar 200 OK?

Telegram requiere que tu webhook responda con status 200. Si respondes con error (4xx, 5xx), Telegram **reintentará** el envío del update, causando un bucle infinito de errores. Por eso, incluso si hay un error interno, respondemos 200:

```javascript
} catch (error) {
  console.error("Error en webhook:", error);
  return new Response("OK", { status: 200 }); // Siempre 200
}
```

### answerCallbackQuery

Cuando el usuario presiona un botón inline, Telegram muestra un "reloj" de carga. Para quitarlo:

```javascript
await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ callback_query_id: update.callback_query.id }),
});
```

---

## 15. Comandos y flujo conversacional

### Comandos simples vs multi-paso

**Simple** (`/vertemas`): Un comando → una respuesta. Sin estado.

**Multi-paso** (`/agregartema`): Un comando → pregunta 1 → respuesta → pregunta 2 → respuesta → ... → confirmación. Requiere "recordar" en qué paso estamos.

### El switch central

```javascript
switch (comando) {
  case "/vertemas":
    await cmdVerTemas(chat_id, env);
    break;
  case "/agregartema":
    await cmdAgregarTema(chat_id, env);
    break;
  // ...
}
```

### Flujo de agregar tema (5 pasos)

```
Admin: /agregartema
Bot: ¿Cuál será el ID del tema?
Admin: calendario_salud
Bot: ¿Cuáles son las palabras clave?
Admin: calendario, salud, programa
Bot: ¿El prompt de extracción?
Admin: Extrae las fechas y actividades del calendario
Bot: ¿Usa match por inicial?
Admin: sí
Bot: ¿Cuál es la plantilla del mensaje?
Admin: Hola {nombre}, tu actividad: {fecha}
Bot: [Resumen] [Confirmar] [Cancelar]
Admin: [presiona Confirmar]
Bot: Tema agregado exitosamente
```

Cada paso se maneja en `flujoAgregarTema()` con un switch por número de paso.

---

## 16. Estado conversacional con TTL

### El problema

Los Workers son **stateless** — cada invocación es independiente. Cuando el admin escribe "calendario_salud" como respuesta al paso 1, el Worker no sabe que estaba en el paso 1 de "agregar tema" porque ya olvidó todo.

### La solución: KV como memoria temporal

```javascript
// Guardar estado
await env.BIENESTAR_KV.put(
  `bot:estado:123456789`,           // clave única por usuario
  '{"comando":"agregartema","paso":2,"datos_parciales":{"id":"calendario_salud"}}',
  { expirationTtl: 600 }           // expira en 10 minutos
);
```

### ¿Por qué TTL de 10 minutos?

Si el admin empieza a agregar un tema y se distrae, el estado queda "colgado" en KV. Con TTL de 600 segundos, Cloudflare lo elimina automáticamente. Así:
- No acumulas estados huérfanos
- Si el admin vuelve después de 10 min, simplemente le pedirá que empiece de nuevo
- 10 minutos es suficiente para completar cualquier flujo multi-paso

### Flujo de decisión al recibir un mensaje

```
¿Es un callback_query (botón presionado)?
  → Sí → handleCallback()
  → No ↓

¿Hay estado guardado en KV para este chat_id?
  → Sí → handleStatefulInput() (continuar el flujo multi-paso)
  → No → interpretar como comando nuevo (/vertemas, /agregartema, etc.)
```

---

## 17. Cron Triggers — Ejecución programada

### Sintaxis cron

```
┌───────────── minuto (0-59)
│ ┌───────────── hora (0-23)
│ │ ┌───────────── día del mes (1-31)
│ │ │ ┌───────────── mes (1-12)
│ │ │ │ ┌───────────── día de la semana (0-7, donde 0 y 7 = domingo)
│ │ │ │ │
* * * * *
```

Ejemplos:
| Expresión | Significado |
|-----------|-------------|
| `0 8 * * 1` | Lunes a las 8:00 AM UTC |
| `0 8 * * 1-5` | Lunes a Viernes a las 8:00 AM UTC |
| `0 */6 * * *` | Cada 6 horas |
| `*/30 * * * *` | Cada 30 minutos |

### Zona horaria

Los cron de Cloudflare están en **UTC**. Si estás en CDMX (UTC-6), las 8 AM UTC son las 2 AM hora local. Ajusta según necesites:
- 8 AM CDMX = `0 14 * * 1` (14:00 UTC)

### Límites

- Máximo 3 cron triggers por Worker (plan gratuito)
- Tiempo máximo de ejecución: 30 segundos (plan gratuito) o 15 minutos (plan de pago)

---

## 18. Flujo completo del sistema

```
CADA LUNES 8AM UTC (cron trigger)
│
├─ 1. SCRAPING
│  └─ POST a Browser Rendering API
│     └─ Selector: div.section[onclick]
│     └─ Resultado: [{thumbnail_url, full_image_url}, ...]
│     └─ Limitar a MAX_IMAGENES (15)
│
├─ 2. POR CADA IMAGEN:
│  │
│  ├─ 2.1 CLASIFICACIÓN (thumbnail)
│  │  └─ Descargar thumbnail → base64
│  │  └─ AI Vision: "¿Relevante para algún tema?"
│  │  └─ Si confianza baja o sin tema → SALTAR
│  │
│  ├─ 2.2 DEDUPLICACIÓN
│  │  └─ Revisar historial:{tema_id} en KV
│  │  └─ Si misma URL → SALTAR (ya procesada)
│  │
│  ├─ 2.3 EXTRACCIÓN (full_image)
│  │  └─ Descargar imagen completa → base64
│  │  └─ AI Vision con prompt específico del tema
│  │  └─ Guardar en historial:{tema_id}
│  │
│  ├─ 2.4 MATCHING
│  │  └─ Si match_por_inicial: emparejar por letra
│  │  └─ Si no: todos los suscritos al tema
│  │
│  └─ 2.5 ENVÍO
│     └─ Aplicar plantilla con datos
│     └─ POST a Telegram sendMessage por cada destinatario
│
└─ FIN: Log de enviados/fallidos

CUANDO LLEGA UN WEBHOOK DE TELEGRAM
│
├─ Verificar que sea el admin
├─ ¿Es callback_query? → procesar botón
├─ ¿Hay estado activo? → continuar flujo multi-paso
└─ Interpretar como comando nuevo
```

---

## 19. Decisiones de diseño y trade-offs

### 1. JavaScript puro vs framework (Hono, itty-router)

**Decisión:** JavaScript puro.
**Razón:** El routing es trivial (solo `/webhook`). Un framework agregaría complejidad sin beneficio real.

### 2. Un namespace KV vs múltiples

**Decisión:** Un solo namespace con prefijos en las claves.
**Razón:** Simplicidad. Múltiples namespaces requieren múltiples bindings y complican el deployment. Los prefijos (`config:`, `historial:`, `bot:`) logran la misma organización.

### 3. Admin único vs multi-admin

**Decisión:** Un solo admin.
**Razón:** Simplicidad. Si necesitas múltiples admins, puedes cambiar la validación para leer una lista de chat_ids desde KV.

### 4. Respuesta secuencial vs paralela en AI

**Decisión:** Procesar imágenes una por una.
**Razón:** Evitar rate limits de Workers AI y permitir early exit.

### 5. Deduplicación por URL vs por hash

**Decisión:** Comparar URLs.
**Razón:** Si la URL cambió, el contenido probablemente cambió. No necesitamos descargar la imagen para comparar hashes. Es más rápido y barato.

### 6. Estado en KV vs en memoria

**Decisión:** KV con TTL.
**Razón:** Los Workers no tienen memoria persistente entre invocaciones. KV es la única opción para estado que sobreviva entre requests.

---

## 20. Posibles puntos de falla y cómo manejarlos

### 1. La página de gob.mx cambia su estructura HTML
**Síntoma:** El scraper devuelve 0 imágenes.
**Solución:** Inspeccionar la página manualmente, actualizar el selector CSS en `scraper.js`, y ajustar los regex de extracción.

### 2. Workers AI no responde JSON válido
**Síntoma:** Errores de parseo en logs.
**Solución:** Ya tenemos el fallback con regex (`responseText.match(/\{[\s\S]*\}/)`). Si sigue fallando, ajustar el prompt para ser más explícito.

### 3. La imagen es demasiado grande para Workers AI
**Síntoma:** Error de timeout o payload too large.
**Solución:** Considerar redimensionar la imagen antes de enviarla, o usar solo el thumbnail para extracción.

### 4. El cron excede el tiempo límite (30s en plan gratuito)
**Síntoma:** El Worker se corta antes de terminar.
**Solución:** Reducir MAX_IMAGENES, o upgrade al plan de pago (15 min de tiempo límite).

### 5. Rate limit de Telegram (30 mensajes/segundo a distintos chats)
**Síntoma:** Errores 429 en el envío.
**Solución:** Para pocos destinatarios no es problema. Si crece, agregar un delay entre envíos.

### 6. KV consistencia eventual
**Síntoma:** Un dato recién guardado no aparece en la siguiente lectura.
**Solución:** Para este proyecto no es un problema real (las operaciones no son tan rápidas). Si lo fuera, usar Durable Objects en su lugar.

---

## 21. Glosario

| Término | Definición |
|---------|-----------|
| **Worker** | Función JavaScript que se ejecuta en la red global de Cloudflare |
| **Edge** | Los servidores de Cloudflare distribuidos mundialmente, cerca del usuario |
| **KV** | Key-Value store distribuido de Cloudflare |
| **Binding** | Conexión declarativa entre un Worker y un servicio de Cloudflare |
| **Secret** | Variable de entorno cifrada, no visible en el código ni en git |
| **Cron Trigger** | Evento programado que activa un Worker según un horario |
| **Webhook** | URL que un servicio externo llama cuando ocurre un evento |
| **Inline Keyboard** | Botones que aparecen debajo de un mensaje de Telegram |
| **callback_data** | El string que Telegram envía cuando se presiona un botón inline |
| **TTL** | Time To Live — tiempo en segundos antes de que un dato expire |
| **Base64** | Codificación que convierte datos binarios a texto ASCII |
| **Scraping** | Extraer datos de una página web de forma automatizada |
| **Headless browser** | Navegador sin interfaz gráfica, controlado por código |
| **ESM** | ECMAScript Modules — sistema de importación con `import/export` |
| **Pipeline** | Cadena de procesamiento donde la salida de uno es la entrada del siguiente |
| **Stateless** | Sin estado persistente entre ejecuciones |
| **Rate limit** | Límite de peticiones por unidad de tiempo que un servicio permite |
| **parse_mode** | Formato de texto en Telegram (HTML o MarkdownV2) |
| **Consistencia eventual** | Los datos se propagan gradualmente, no instantáneamente |
