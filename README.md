# Bienestar Notifier

Cloudflare Worker que monitorea [gob.mx/bienestar](https://www.gob.mx/bienestar), detecta imágenes relevantes según temas configurables, extrae información con IA y envía notificaciones personalizadas por Telegram.

## Prerrequisitos

- Cuenta de [Cloudflare](https://dash.cloudflare.com/) con Workers y Workers AI habilitados
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) instalado (`npm i -g wrangler`)
- Bot de Telegram creado con [@BotFather](https://t.me/BotFather)
- Tu `chat_id` personal (envía un mensaje a [@userinfobot](https://t.me/userinfobot))

## Instalación

### 1. Clonar y configurar variables

```bash
git clone <tu-repo>
cd bienestar-notifier
cp .env.example .env
# Edita .env con tus valores reales
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Crear KV Namespace

```bash
wrangler kv namespace create BIENESTAR_KV
```

Copia el `id` resultante y actualízalo en `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "BIENESTAR_KV"
id = "TU_ID_AQUI"
```

También agrégalo en `.env` como `KV_NAMESPACE_ID`.

### 4. Subir secrets

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_ADMIN_CHAT_ID
wrangler secret put CF_ACCOUNT_ID
wrangler secret put CF_API_TOKEN
```

### 5. Inicializar KV con datos de ejemplo

```bash
npm run init-kv
```

### 6. Desplegar

```bash
npm run deploy
```

### 7. Registrar webhook de Telegram

Sustituye `<BOT_TOKEN>` y `<WORKER_URL>` con tus valores:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>/webhook"
```

Ejemplo:
```
https://api.telegram.org/bot123:ABC/setWebhook?url=https://bienestar-notifier.tu-usuario.workers.dev/webhook
```

### 8. Verificar

- Revisa el Worker desplegado en el [dashboard de Cloudflare](https://dash.cloudflare.com/)
- Envía `/ayuda` a tu bot en Telegram

## Comandos del Bot

| Comando | Descripción |
|---------|-------------|
| `/inicio` `/ayuda` | Menú principal |
| `/vertemas` | Ver todos los temas configurados |
| `/agregartema` | Agregar un nuevo tema (flujo multi-paso) |
| `/editarpalabras` | Editar palabras clave de un tema |
| `/eliminartema` | Eliminar un tema |
| `/verdestinatarios` | Ver todos los destinatarios |
| `/agregardestinatario` | Agregar un destinatario (flujo multi-paso) |
| `/suscribir` | Suscribir un destinatario a un tema |
| `/desuscribir` | Desuscribir un destinatario de un tema |
| `/eliminardestinatario` | Eliminar un destinatario |

## Arquitectura

```
Cron Trigger (scheduled)
  → scraper.js      Scrape gob.mx/bienestar con Browser Rendering API
  → classifier.js   Clasificar thumbnails con Workers AI Vision
  → extractor.js    Deduplicar + extraer datos de full_image
  → matcher.js      Emparejar datos con destinatarios
  → messenger.js    Enviar notificaciones por Telegram

Webhook (fetch /webhook)
  → bot/webhook.js  Validar admin + parsear update
  → bot/commands.js Ejecutar comandos del bot
  → bot/state.js    Estado conversacional en KV con TTL
```

## Desarrollo local

```bash
npm run dev
```

## Licencia

MIT
