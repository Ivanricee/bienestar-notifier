import { saveState, getState, clearState } from "./state.js";
import { getTemas, addTema, updateTema, deleteTema } from "../kv/temas.js";
import {
  getDestinatarios,
  addDestinatario,
  deleteDestinatario,
  saveDestinatarios,
} from "../kv/destinatarios.js";

async function sendMessage(chat_id, text, env, reply_markup = null) {
  try {
    const body = {
      chat_id,
      text,
      parse_mode: "HTML",
    };
    if (reply_markup) {
      body.reply_markup = reply_markup;
    }
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
  } catch (error) {
    console.error("Error al enviar mensaje de Telegram:", error);
  }
}

export async function handleCommand(chat_id, text, callback_data, env) {
  // Si hay callback_data, procesarlo
  if (callback_data) {
    await handleCallback(chat_id, callback_data, env);
    return;
  }

  const comando = (text || "").trim().toLowerCase();

  // Verificar si hay un estado conversacional activo
  const state = await getState(chat_id, env);
  if (state) {
    await handleStatefulInput(chat_id, text, state, env);
    return;
  }

  switch (comando) {
    case "/inicio":
    case "/ayuda":
    case "/start":
    case "/help":
      await cmdAyuda(chat_id, env);
      break;
    case "/vertemas":
      await cmdVerTemas(chat_id, env);
      break;
    case "/agregartema":
      await cmdAgregarTema(chat_id, env);
      break;
    case "/editarpalabras":
      await cmdEditarPalabras(chat_id, env);
      break;
    case "/eliminartema":
      await cmdEliminarTema(chat_id, env);
      break;
    case "/verdestinatarios":
      await cmdVerDestinatarios(chat_id, env);
      break;
    case "/agregardestinatario":
      await cmdAgregarDestinatario(chat_id, env);
      break;
    case "/suscribir":
      await cmdSuscribir(chat_id, env);
      break;
    case "/desuscribir":
      await cmdDesuscribir(chat_id, env);
      break;
    case "/eliminardestinatario":
      await cmdEliminarDestinatario(chat_id, env);
      break;
    default:
      await sendMessage(
        chat_id,
        "Comando no reconocido. Usa /ayuda para ver los comandos disponibles.",
        env
      );
  }
}

// ─── MENÚ PRINCIPAL ──────────────────────────────────────────

async function cmdAyuda(chat_id, env) {
  const msg =
    `<b>🤖 Bienestar Notifier - Comandos</b>\n\n` +
    `<b>TEMAS:</b>\n` +
    `/vertemas - Ver todos los temas\n` +
    `/agregartema - Agregar un nuevo tema\n` +
    `/editarpalabras - Editar palabras clave de un tema\n` +
    `/eliminartema - Eliminar un tema\n\n` +
    `<b>DESTINATARIOS:</b>\n` +
    `/verdestinatarios - Ver todos los destinatarios\n` +
    `/agregardestinatario - Agregar un destinatario\n` +
    `/suscribir - Suscribir destinatario a un tema\n` +
    `/desuscribir - Desuscribir destinatario de un tema\n` +
    `/eliminardestinatario - Eliminar un destinatario`;
  await sendMessage(chat_id, msg, env);
}

// ─── TEMAS ───────────────────────────────────────────────────

async function cmdVerTemas(chat_id, env) {
  const temas = await getTemas(env);
  if (temas.length === 0) {
    await sendMessage(chat_id, "No hay temas configurados.", env);
    return;
  }
  let msg = "<b>📋 Temas configurados:</b>\n\n";
  for (const t of temas) {
    msg += `<b>ID:</b> <code>${t.id}</code>\n`;
    msg += `<b>Palabras clave:</b> ${t.palabras_clave_deteccion.join(", ")}\n`;
    msg += `<b>Match por inicial:</b> ${t.match_por_inicial ? "Sí" : "No"}\n\n`;
  }
  await sendMessage(chat_id, msg, env);
}

async function cmdAgregarTema(chat_id, env) {
  await saveState(chat_id, { comando: "agregartema", paso: 1, datos_parciales: {} }, env);
  await sendMessage(
    chat_id,
    "¿Cuál será el <b>ID del tema</b>? (sin espacios, ej: <code>comunicado_salud</code>)",
    env
  );
}

async function cmdEditarPalabras(chat_id, env) {
  const temas = await getTemas(env);
  if (temas.length === 0) {
    await sendMessage(chat_id, "No hay temas configurados.", env);
    return;
  }
  const buttons = temas.map((t) => [
    { text: t.id, callback_data: `editarpalabras:${t.id}` },
  ]);
  await sendMessage(chat_id, "Selecciona el tema a editar:", env, {
    inline_keyboard: buttons,
  });
}

async function cmdEliminarTema(chat_id, env) {
  const temas = await getTemas(env);
  if (temas.length === 0) {
    await sendMessage(chat_id, "No hay temas configurados.", env);
    return;
  }
  const buttons = temas.map((t) => [
    { text: t.id, callback_data: `eliminartema:${t.id}` },
  ]);
  await sendMessage(chat_id, "Selecciona el tema a eliminar:", env, {
    inline_keyboard: buttons,
  });
}

// ─── DESTINATARIOS ───────────────────────────────────────────

async function cmdVerDestinatarios(chat_id, env) {
  const destinatarios = await getDestinatarios(env);
  if (destinatarios.length === 0) {
    await sendMessage(chat_id, "No hay destinatarios configurados.", env);
    return;
  }
  let msg = "<b>👥 Destinatarios configurados:</b>\n\n";
  for (const d of destinatarios) {
    msg += `<b>Nombre:</b> ${d.nombre}\n`;
    msg += `<b>Chat ID:</b> <code>${d.chat_id}</code>\n`;
    msg += `<b>Inicial:</b> ${d.inicial_apellido}\n`;
    msg += `<b>Temas:</b> ${d.temas_suscritos.join(", ") || "ninguno"}\n\n`;
  }
  await sendMessage(chat_id, msg, env);
}

async function cmdAgregarDestinatario(chat_id, env) {
  await saveState(
    chat_id,
    { comando: "agregardestinatario", paso: 1, datos_parciales: {} },
    env
  );
  await sendMessage(chat_id, "¿<b>Nombre</b> del destinatario?", env);
}

async function cmdSuscribir(chat_id, env) {
  const destinatarios = await getDestinatarios(env);
  if (destinatarios.length === 0) {
    await sendMessage(chat_id, "No hay destinatarios configurados.", env);
    return;
  }
  const buttons = destinatarios.map((d) => [
    { text: d.nombre, callback_data: `suscribir_dest:${d.chat_id}` },
  ]);
  await sendMessage(chat_id, "Selecciona el destinatario a suscribir:", env, {
    inline_keyboard: buttons,
  });
}

async function cmdDesuscribir(chat_id, env) {
  const destinatarios = await getDestinatarios(env);
  if (destinatarios.length === 0) {
    await sendMessage(chat_id, "No hay destinatarios configurados.", env);
    return;
  }
  const buttons = destinatarios.map((d) => [
    { text: d.nombre, callback_data: `desuscribir_dest:${d.chat_id}` },
  ]);
  await sendMessage(chat_id, "Selecciona el destinatario a desuscribir:", env, {
    inline_keyboard: buttons,
  });
}

async function cmdEliminarDestinatario(chat_id, env) {
  const destinatarios = await getDestinatarios(env);
  if (destinatarios.length === 0) {
    await sendMessage(chat_id, "No hay destinatarios configurados.", env);
    return;
  }
  const buttons = destinatarios.map((d) => [
    { text: d.nombre, callback_data: `eliminardestinatario:${d.chat_id}` },
  ]);
  await sendMessage(chat_id, "Selecciona el destinatario a eliminar:", env, {
    inline_keyboard: buttons,
  });
}

// ─── CALLBACKS (botones inline) ──────────────────────────────

async function handleCallback(chat_id, callback_data, env) {
  const [action, param] = callback_data.split(":");

  switch (action) {
    case "editarpalabras": {
      await saveState(
        chat_id,
        { comando: "editarpalabras", paso: 1, datos_parciales: { tema_id: param } },
        env
      );
      await sendMessage(
        chat_id,
        `Escribe las nuevas <b>palabras clave</b> para <code>${param}</code> (separadas por coma):`,
        env
      );
      break;
    }

    case "eliminartema": {
      await sendMessage(
        chat_id,
        `¿Seguro que quieres eliminar el tema <code>${param}</code>?`,
        env,
        {
          inline_keyboard: [
            [
              { text: "✅ Confirmar", callback_data: `confirmareliminartema:${param}` },
              { text: "❌ Cancelar", callback_data: "cancelar:" },
            ],
          ],
        }
      );
      break;
    }

    case "confirmareliminartema": {
      const eliminado = await deleteTema(param, env);
      await sendMessage(
        chat_id,
        eliminado
          ? `Tema <code>${param}</code> eliminado.`
          : `No se encontró el tema <code>${param}</code>.`,
        env
      );
      break;
    }

    case "suscribir_dest": {
      const temas = await getTemas(env);
      if (temas.length === 0) {
        await sendMessage(chat_id, "No hay temas disponibles.", env);
        return;
      }
      const buttons = temas.map((t) => [
        { text: t.id, callback_data: `suscribir_tema:${param}:${t.id}` },
      ]);
      await sendMessage(chat_id, "Selecciona el tema:", env, {
        inline_keyboard: buttons,
      });
      break;
    }

    case "suscribir_tema": {
      const [dest_chat_id, tema_id] = param.split(":");
      // Leer el segundo segmento del callback_data completo
      const parts = callback_data.split(":");
      const destId = parts[1];
      const temaId = parts[2];
      const destinatarios = await getDestinatarios(env);
      const dest = destinatarios.find((d) => d.chat_id === destId);
      if (!dest) {
        await sendMessage(chat_id, "Destinatario no encontrado.", env);
        return;
      }
      if (!dest.temas_suscritos.includes(temaId)) {
        dest.temas_suscritos.push(temaId);
        await saveDestinatarios(destinatarios, env);
        await sendMessage(
          chat_id,
          `${dest.nombre} suscrito a <code>${temaId}</code>.`,
          env
        );
      } else {
        await sendMessage(chat_id, `Ya está suscrito a <code>${temaId}</code>.`, env);
      }
      break;
    }

    case "desuscribir_dest": {
      const temas = await getTemas(env);
      if (temas.length === 0) {
        await sendMessage(chat_id, "No hay temas disponibles.", env);
        return;
      }
      const buttons = temas.map((t) => [
        { text: t.id, callback_data: `desuscribir_tema:${param}:${t.id}` },
      ]);
      await sendMessage(chat_id, "Selecciona el tema a desuscribir:", env, {
        inline_keyboard: buttons,
      });
      break;
    }

    case "desuscribir_tema": {
      const partsD = callback_data.split(":");
      const destIdD = partsD[1];
      const temaIdD = partsD[2];
      const destinatariosD = await getDestinatarios(env);
      const destD = destinatariosD.find((d) => d.chat_id === destIdD);
      if (!destD) {
        await sendMessage(chat_id, "Destinatario no encontrado.", env);
        return;
      }
      const idx = destD.temas_suscritos.indexOf(temaIdD);
      if (idx !== -1) {
        destD.temas_suscritos.splice(idx, 1);
        await saveDestinatarios(destinatariosD, env);
        await sendMessage(
          chat_id,
          `${destD.nombre} desuscrito de <code>${temaIdD}</code>.`,
          env
        );
      } else {
        await sendMessage(chat_id, `No estaba suscrito a <code>${temaIdD}</code>.`, env);
      }
      break;
    }

    case "eliminardestinatario": {
      const destinatariosE = await getDestinatarios(env);
      const destE = destinatariosE.find((d) => d.chat_id === param);
      const nombre = destE ? destE.nombre : param;
      await sendMessage(
        chat_id,
        `¿Seguro que quieres eliminar a <b>${nombre}</b>?`,
        env,
        {
          inline_keyboard: [
            [
              { text: "✅ Confirmar", callback_data: `confirmareliminardestinatario:${param}` },
              { text: "❌ Cancelar", callback_data: "cancelar:" },
            ],
          ],
        }
      );
      break;
    }

    case "confirmareliminardestinatario": {
      const eliminado = await deleteDestinatario(param, env);
      await sendMessage(
        chat_id,
        eliminado ? "Destinatario eliminado." : "No se encontró el destinatario.",
        env
      );
      break;
    }

    case "confirmar_tema": {
      const state = await getState(chat_id, env);
      if (state && state.comando === "agregartema") {
        await addTema(state.datos_parciales, env);
        await clearState(chat_id, env);
        await sendMessage(
          chat_id,
          `Tema <code>${state.datos_parciales.id}</code> agregado exitosamente.`,
          env
        );
      }
      break;
    }

    case "confirmar_destinatario": {
      const stateD = await getState(chat_id, env);
      if (stateD && stateD.comando === "agregardestinatario") {
        await addDestinatario(stateD.datos_parciales, env);
        await clearState(chat_id, env);
        await sendMessage(
          chat_id,
          `Destinatario <b>${stateD.datos_parciales.nombre}</b> agregado exitosamente.`,
          env
        );
      }
      break;
    }

    case "seleccionar_tema_dest": {
      // Multi-select de temas para agregar destinatario
      const stateS = await getState(chat_id, env);
      if (stateS && stateS.comando === "agregardestinatario" && stateS.paso === 4) {
        if (!stateS.datos_parciales.temas_suscritos) {
          stateS.datos_parciales.temas_suscritos = [];
        }
        if (stateS.datos_parciales.temas_suscritos.includes(param)) {
          stateS.datos_parciales.temas_suscritos =
            stateS.datos_parciales.temas_suscritos.filter((t) => t !== param);
        } else {
          stateS.datos_parciales.temas_suscritos.push(param);
        }
        await saveState(chat_id, stateS, env);
        // Mostrar botones actualizados
        const temas = await getTemas(env);
        const buttons = temas.map((t) => {
          const selected = stateS.datos_parciales.temas_suscritos.includes(t.id);
          return [
            {
              text: `${selected ? "✅" : "⬜"} ${t.id}`,
              callback_data: `seleccionar_tema_dest:${t.id}`,
            },
          ];
        });
        buttons.push([
          { text: "✅ Listo", callback_data: "temas_dest_listo:" },
        ]);
        await sendMessage(
          chat_id,
          `Temas seleccionados: ${stateS.datos_parciales.temas_suscritos.join(", ") || "ninguno"}`,
          env,
          { inline_keyboard: buttons }
        );
      }
      break;
    }

    case "temas_dest_listo": {
      const stateT = await getState(chat_id, env);
      if (stateT && stateT.comando === "agregardestinatario") {
        stateT.paso = 5;
        await saveState(chat_id, stateT, env);
        const d = stateT.datos_parciales;
        const resumen =
          `<b>Resumen del destinatario:</b>\n` +
          `<b>Nombre:</b> ${d.nombre}\n` +
          `<b>Chat ID:</b> <code>${d.chat_id}</code>\n` +
          `<b>Inicial:</b> ${d.inicial_apellido}\n` +
          `<b>Temas:</b> ${(d.temas_suscritos || []).join(", ") || "ninguno"}`;
        await sendMessage(chat_id, resumen, env, {
          inline_keyboard: [
            [
              { text: "✅ Confirmar", callback_data: "confirmar_destinatario:" },
              { text: "❌ Cancelar", callback_data: "cancelar:" },
            ],
          ],
        });
      }
      break;
    }

    case "cancelar": {
      await clearState(chat_id, env);
      await sendMessage(chat_id, "Operación cancelada.", env);
      break;
    }

    default:
      console.log("Callback no reconocido:", callback_data);
  }
}

// ─── FLUJO MULTI-PASO (stateful) ────────────────────────────

async function handleStatefulInput(chat_id, text, state, env) {
  const input = (text || "").trim();

  if (input.toLowerCase() === "/cancelar") {
    await clearState(chat_id, env);
    await sendMessage(chat_id, "Operación cancelada.", env);
    return;
  }

  switch (state.comando) {
    case "agregartema":
      await flujoAgregarTema(chat_id, input, state, env);
      break;
    case "editarpalabras":
      await flujoEditarPalabras(chat_id, input, state, env);
      break;
    case "agregardestinatario":
      await flujoAgregarDestinatario(chat_id, input, state, env);
      break;
    default:
      await clearState(chat_id, env);
      await sendMessage(chat_id, "Estado no reconocido. Operación cancelada.", env);
  }
}

async function flujoAgregarTema(chat_id, input, state, env) {
  switch (state.paso) {
    case 1: {
      if (!input || input.includes(" ")) {
        await sendMessage(
          chat_id,
          "El ID no puede tener espacios. Intenta de nuevo:",
          env
        );
        return;
      }
      state.datos_parciales.id = input;
      state.paso = 2;
      await saveState(chat_id, state, env);
      await sendMessage(
        chat_id,
        "¿Cuáles son las <b>palabras clave de detección</b>? (separadas por coma)",
        env
      );
      break;
    }
    case 2: {
      state.datos_parciales.palabras_clave_deteccion = input
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      state.paso = 3;
      await saveState(chat_id, state, env);
      await sendMessage(
        chat_id,
        "¿Cuál es el <b>prompt de extracción</b> para la IA? (describe qué extraer de la imagen)",
        env
      );
      break;
    }
    case 3: {
      state.datos_parciales.prompt_extraccion = input;
      state.paso = 4;
      await saveState(chat_id, state, env);
      await sendMessage(
        chat_id,
        "¿Usa <b>match por inicial de apellido</b>? (sí/no)",
        env
      );
      break;
    }
    case 4: {
      const respuesta = input.toLowerCase();
      state.datos_parciales.match_por_inicial =
        respuesta === "sí" || respuesta === "si" || respuesta === "s";
      state.paso = 5;
      await saveState(chat_id, state, env);
      await sendMessage(
        chat_id,
        "¿Cuál es la <b>plantilla del mensaje</b>?\nVariables disponibles: <code>{nombre}</code> <code>{fecha}</code> <code>{actividad}</code> <code>{contenido}</code>",
        env
      );
      break;
    }
    case 5: {
      state.datos_parciales.plantilla_mensaje = input;
      state.paso = 6;
      await saveState(chat_id, state, env);
      const d = state.datos_parciales;
      const resumen =
        `<b>Resumen del tema:</b>\n` +
        `<b>ID:</b> <code>${d.id}</code>\n` +
        `<b>Palabras clave:</b> ${d.palabras_clave_deteccion.join(", ")}\n` +
        `<b>Prompt:</b> ${d.prompt_extraccion}\n` +
        `<b>Match por inicial:</b> ${d.match_por_inicial ? "Sí" : "No"}\n` +
        `<b>Plantilla:</b> ${d.plantilla_mensaje}`;
      await sendMessage(chat_id, resumen, env, {
        inline_keyboard: [
          [
            { text: "✅ Confirmar", callback_data: "confirmar_tema:" },
            { text: "❌ Cancelar", callback_data: "cancelar:" },
          ],
        ],
      });
      break;
    }
  }
}

async function flujoEditarPalabras(chat_id, input, state, env) {
  const nuevas = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const actualizado = await updateTema(
    state.datos_parciales.tema_id,
    { palabras_clave_deteccion: nuevas },
    env
  );
  await clearState(chat_id, env);
  await sendMessage(
    chat_id,
    actualizado
      ? `Palabras clave de <code>${state.datos_parciales.tema_id}</code> actualizadas.`
      : "No se encontró el tema.",
    env
  );
}

async function flujoAgregarDestinatario(chat_id, input, state, env) {
  switch (state.paso) {
    case 1: {
      state.datos_parciales.nombre = input;
      state.paso = 2;
      await saveState(chat_id, state, env);
      await sendMessage(chat_id, "¿<b>Chat ID</b> de Telegram?", env);
      break;
    }
    case 2: {
      state.datos_parciales.chat_id = input;
      state.paso = 3;
      await saveState(chat_id, state, env);
      await sendMessage(
        chat_id,
        "¿<b>Inicial del apellido</b>? (una letra)",
        env
      );
      break;
    }
    case 3: {
      state.datos_parciales.inicial_apellido = input.toUpperCase().charAt(0);
      state.datos_parciales.temas_suscritos = [];
      state.paso = 4;
      await saveState(chat_id, state, env);
      const temas = await getTemas(env);
      if (temas.length === 0) {
        state.paso = 5;
        await saveState(chat_id, state, env);
        const d = state.datos_parciales;
        const resumen =
          `<b>Resumen del destinatario:</b>\n` +
          `<b>Nombre:</b> ${d.nombre}\n` +
          `<b>Chat ID:</b> <code>${d.chat_id}</code>\n` +
          `<b>Inicial:</b> ${d.inicial_apellido}\n` +
          `<b>Temas:</b> ninguno (no hay temas configurados)`;
        await sendMessage(chat_id, resumen, env, {
          inline_keyboard: [
            [
              { text: "✅ Confirmar", callback_data: "confirmar_destinatario:" },
              { text: "❌ Cancelar", callback_data: "cancelar:" },
            ],
          ],
        });
        return;
      }
      const buttons = temas.map((t) => [
        { text: `⬜ ${t.id}`, callback_data: `seleccionar_tema_dest:${t.id}` },
      ]);
      buttons.push([{ text: "✅ Listo", callback_data: "temas_dest_listo:" }]);
      await sendMessage(
        chat_id,
        "Selecciona los temas a suscribir (puedes seleccionar varios):",
        env,
        { inline_keyboard: buttons }
      );
      break;
    }
  }
}
