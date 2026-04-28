Crea un proyecto completo de Cloudflare Worker llamado "bienestar-notifier" con toda su estructura de archivos y código funcional listo para desplegar.

## Contexto
Un Worker de Cloudflare que cada cierto tiempo (cron configurable) scrape la página https://www.gob.mx/bienestar, detecta imágenes relevantes según temas de interés configurables, extrae información con Workers AI Vision, y envía notificaciones personalizadas por Telegram Bot API.

## Stack tecnológico
- Cloudflare Workers (runtime nativo, sin Node.js)
- Cloudflare Browser Rendering REST API (endpoint /scrape)
- Cloudflare Workers AI (modelo @cf/meta/llama-3.2-11b-vision-instruct)
- Cloudflare Workers KV (almacenamiento de configuración e historial)
- Telegram Bot API (envío de mensajes y recepción de comandos)
- Wrangler CLI para despliegue
- JavaScript puro (sin frameworks, sin dependencias externas)

## Estructura de archivos a generar
bienestar-notifier/
├── wrangler.toml
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── src/
│   ├── index.js              # Entry point: exporta fetch handler y scheduled handler
│   ├── scraper.js            # F1-F2: scraping y límite de imágenes
│   ├── classifier.js         # F3-F4: clasificación de thumbnail con Workers AI
│   ├── extractor.js          # F5-F6: deduplicación y extracción de full_image
│   ├── matcher.js            # F7: match destinatario ↔ contenido extraído
│   ├── messenger.js          # F8-F9: generación de mensaje con plantilla y envío Telegram
│   ├── bot/
│   │   ├── webhook.js        # F11: recibe updates de Telegram, valida admin
│   │   ├── commands.js       # F12-F13: lógica de todos los comandos en español
│   │   └── state.js          # F14: gestión de estado conversacional en KV con TTL
│   └── kv/
│       ├── temas.js          # F15: CRUD de config:temas en KV
│       ├── destinatarios.js  # F15: CRUD de config:destinatarios en KV
│       └── historial.js      # F15: lectura y escritura de historial:{tema_id}
└── scripts/
└── init-kv.js            # F15: script para inicializar KV con datos de ejemplo

## Detalles de implementación por módulo

### wrangler.toml
- Nombre: bienestar-notifier
- Compatibility date actual
- Cron trigger: "0 8 * * 1" (lunes 8am UTC, comentar otras opciones frecuentes)
- KV namespace binding: BIENESTAR_KV
- Workers AI binding: AI
- Variables de entorno no sensibles: MAX_IMAGENES=15
- Secrets declarados como comentario explicativo: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, CF_ACCOUNT_ID, CF_API_TOKEN

### src/index.js
Exportar dos handlers:
1. `scheduled` → ejecuta el flujo completo del cron: scraper → classifier → extractor → matcher → messenger
2. `fetch` → si la URL es /webhook, delegar a bot/webhook.js. Cualquier otra ruta responde 404.

### src/scraper.js
- Hacer POST a https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/browser-rendering/scrape
- Selector: "div.section[onclick]"
- Extraer de cada resultado:
  - thumbnail_url: atributo src del primer <img> hijo (puede ser relativo, resolver a URL absoluta con base https://www.gob.mx)
  - full_image_url: extraer con regex la URL dentro de onclick='location.href="..."'
- Filtrar pares donde ambas URLs existan y full_image_url termine en extensión de imagen (.jpg, .jpeg, .png, .webp)
- Aplicar límite MAX_IMAGENES tomando solo los primeros N resultados
- Retornar array de objetos {thumbnail_url, full_image_url}

### src/classifier.js
- Recibe {thumbnail_url, full_image_url} y la lista de temas de KV
- Descargar thumbnail_url con fetch, convertir ArrayBuffer a base64
- Llamar a env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct") con prompt:
  "Analiza esta imagen. Los temas de interés son: {lista de temas con sus palabras_clave_deteccion}. ¿Esta imagen hace referencia a alguno de estos temas? Responde SOLO en JSON válido con esta estructura exacta: {\"tema_id\": \"string o null\", \"confianza\": \"alta o baja\", \"razon\": \"string corto\"}"
- Si confianza es "baja" o tema_id es null: retornar {relevante: false, baja_confianza: true}
- Si hay error en el fetch de la imagen o en Workers AI: retornar {relevante: false, error: true}
- Si relevante y confianza alta: retornar {relevante: true, tema_id, full_image_url}

### src/extractor.js
- Recibe {tema_id, full_image_url} y los temas de KV
- Consultar historial:{tema_id} en KV
  - Si existe y full_image_url es igual al guardado: retornar {duplicado: true}
  - Si no existe o es diferente: continuar
- Descargar full_image_url, convertir a base64
- Llamar a Workers AI con el prompt_extraccion del tema encontrado en KV
- El prompt debe pedir respuesta SOLO en JSON válido
- Si la respuesta no es JSON parseable o hay error: retornar {error: true, full_image_url, tema_id}
- Si éxito: actualizar historial:{tema_id} en KV con la nueva full_image_url y timestamp
- Retornar {datos: objeto_extraido, tema_id}

### src/matcher.js
- Recibe {datos, tema_id} y la lista de destinatarios de KV
- Obtener el tema de KV para leer match_por_inicial
- Si match_por_inicial es true:
  - Los datos extraídos contienen array de {fecha, actividad, inicial_apellido}
  - Por cada entrada, buscar destinatarios donde inicial_apellido coincida (case insensitive) y tema_id esté en temas_suscritos
  - Agrupar por destinatario: un destinatario puede tener múltiples fechas
  - Retornar array de {destinatario, fechas_asignadas}
- Si match_por_inicial es false:
  - Filtrar destinatarios que tengan tema_id en temas_suscritos
  - Retornar array de {destinatario, datos_completos}

### src/messenger.js
- Recibe array de matches del matcher
- Por cada match, obtener la plantilla del tema desde KV
- Reemplazar variables en la plantilla:
  - {nombre} → destinatario.nombre
  - {fecha} → fecha formateada
  - {actividad} → actividad
  - {contenido} → para temas sin match por inicial
- Hacer fetch a https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage con {chat_id, text, parse_mode: "HTML"}
- Si el fetch falla: loguear error con console.error pero continuar con los demás
- Retornar {enviados: n, fallidos: n}

### src/bot/webhook.js
- Parsear el body JSON del request de Telegram
- Extraer chat_id del mensaje
- Si chat_id !== env.TELEGRAM_ADMIN_CHAT_ID: responder 200 OK sin hacer nada (silencioso)
- Si es admin: extraer texto del mensaje y delegar a commands.js
- Siempre responder 200 OK a Telegram (requisito de la plataforma)

### src/bot/commands.js
Implementar flujo conversacional en español. El bot responde con botones inline de Telegram (inline_keyboard) cuando hay opciones a elegir. Comandos disponibles:

/inicio o /ayuda → menú principal con todos los comandos disponibles

TEMAS:
/vertemas → lista todos los temas con id y palabras clave
/agregartema → inicia flujo multi-paso:
  Paso 1: "¿Cuál será el ID del tema? (sin espacios, ej: comunicado_salud)"
  Paso 2: "¿Cuáles son las palabras clave de detección? (separadas por coma)"
  Paso 3: "¿El prompt de extracción para la IA? (describe qué extraer de la imagen)"
  Paso 4: "¿Usa match por inicial de apellido? (sí/no)"
  Paso 5: "¿Cuál es la plantilla del mensaje? Variables disponibles: {nombre} {fecha} {actividad} {contenido}"
  Confirmación: mostrar resumen y botones inline [Confirmar] [Cancelar]
/editarpalabras → botones inline con lista de temas → pedir nuevas palabras clave
/eliminartema → botones inline con lista de temas → pedir confirmación

DESTINATARIOS:
/verdestinatarios → lista todos con nombre, inicial y temas suscritos
/agregardestinatario → flujo multi-paso:
  Paso 1: "¿Nombre del destinatario?"
  Paso 2: "¿Chat ID de Telegram?"
  Paso 3: "¿Inicial del apellido? (una letra)"
  Paso 4: botones inline con temas disponibles para seleccionar suscripciones (multi-select)
  Confirmación con botones [Confirmar] [Cancelar]
/suscribir → botones inline: elegir destinatario → elegir tema
/desuscribir → botones inline: elegir destinatario → elegir tema
/eliminardestinatario → botones inline con lista → confirmación

### src/bot/state.js
- saveState(chat_id, state, env): guarda en KV la clave bot:estado:{chat_id} con el objeto state y TTL de 600 segundos (10 minutos)
- getState(chat_id, env): obtiene el estado actual o null si no existe o expiró
- clearState(chat_id, env): elimina bot:estado:{chat_id}
- El objeto state tiene forma: {comando, paso, datos_parciales}

### src/kv/temas.js
- getTemas(env): obtener y parsear config:temas, retornar [] si no existe
- saveTemas(temas, env): serializar y guardar config:temas
- getTemaById(id, env): buscar tema por id
- addTema(tema, env): agregar al array y guardar
- updateTema(id, cambios, env): actualizar tema existente
- deleteTema(id, env): eliminar por id

### src/kv/destinatarios.js
- getDestinatarios(env): obtener y parsear config:destinatarios, retornar [] si no existe
- saveDestinatarios(destinatarios, env): serializar y guardar
- addDestinatario(destinatario, env): agregar y guardar
- updateDestinatario(chat_id, cambios, env): actualizar por chat_id
- deleteDestinatario(chat_id, env): eliminar por chat_id

### src/kv/historial.js
- getHistorial(tema_id, env): obtener historial:{tema_id}, retornar null si no existe
- saveHistorial(tema_id, full_image_url, env): guardar {url: full_image_url, timestamp: Date.now()}

### scripts/init-kv.js
Script Node.js standalone (no Worker) que usa fetch a la API REST de Cloudflare KV para inicializar los datos de ejemplo. Incluir:
- Un tema de ejemplo: calendario_bienestar con palabras clave ["calendario", "bienestar", "actividades", "programa"], match_por_inicial true, prompt de extracción detallado, plantilla de mensaje
- Un destinatario de ejemplo con datos placeholder
- Instrucciones en comentarios sobre cómo ejecutarlo con: node scripts/init-kv.js

### .env.example
Documentar todas las variables con descripción:
- CF_ACCOUNT_ID: ID de tu cuenta Cloudflare
- CF_API_TOKEN: Token con permisos de Workers y KV
- TELEGRAM_BOT_TOKEN: Token del bot obtenido de @BotFather
- TELEGRAM_ADMIN_CHAT_ID: Tu chat_id personal de Telegram
- KV_NAMESPACE_ID: ID del namespace KV creado en Cloudflare

### .gitignore
Ignorar .env, node_modules, .wrangler, dist

### README.md
Documentar paso a paso:
1. Prerrequisitos (cuenta Cloudflare, Wrangler CLI instalado, bot de Telegram creado)
2. Clonar y configurar variables
3. Crear KV namespace con wrangler y actualizar wrangler.toml
4. Subir secrets con wrangler secret put
5. Ejecutar script de inicialización
6. Registrar webhook de Telegram (URL del Worker desplegado)
7. Desplegar con wrangler deploy
8. Verificar en dashboard de Cloudflare
9. Lista de todos los comandos del bot disponibles

## Reglas generales de implementación
- Todo el código en JavaScript puro, sin dependencias npm excepto wrangler como devDependency
- Manejo de errores con try/catch en cada módulo, nunca dejar que un error de un módulo rompa el flujo completo
- console.log para info del flujo, console.error para errores, ambos visibles en Cloudflare dashboard
- Todos los accesos a KV con await y manejo de null
- Las URLs relativas del scraping siempre resolverlas a absolutas con base https://www.gob.mx antes de cualquier operación
- El JSON mode de Workers AI: siempre incluir en el prompt la instrucción "Responde SOLO en JSON válido, sin texto adicional, sin markdown, sin bloques de código"
- Al parsear respuestas de Workers AI: siempre envolver en try/catch, si falla el parse tratar como error de lectura
- Los botones inline de Telegram usar callback_data con formato "comando:parametro" para fácil parsing