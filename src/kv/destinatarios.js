export async function getDestinatarios(env) {
  try {
    const data = await env.BIENESTAR_KV.get("config:destinatarios");
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Error al obtener destinatarios de KV:", error);
    return [];
  }
}

export async function saveDestinatarios(destinatarios, env) {
  try {
    await env.BIENESTAR_KV.put("config:destinatarios", JSON.stringify(destinatarios));
  } catch (error) {
    console.error("Error al guardar destinatarios en KV:", error);
    throw error;
  }
}

export async function addDestinatario(destinatario, env) {
  const destinatarios = await getDestinatarios(env);
  destinatarios.push(destinatario);
  await saveDestinatarios(destinatarios, env);
}

export async function updateDestinatario(chat_id, cambios, env) {
  const destinatarios = await getDestinatarios(env);
  const index = destinatarios.findIndex((d) => d.chat_id === chat_id);
  if (index === -1) return false;
  destinatarios[index] = { ...destinatarios[index], ...cambios };
  await saveDestinatarios(destinatarios, env);
  return true;
}

export async function deleteDestinatario(chat_id, env) {
  const destinatarios = await getDestinatarios(env);
  const filtrados = destinatarios.filter((d) => d.chat_id !== chat_id);
  if (filtrados.length === destinatarios.length) return false;
  await saveDestinatarios(filtrados, env);
  return true;
}
