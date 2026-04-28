const TTL_SECONDS = 600; // 10 minutos

export async function saveState(chat_id, state, env) {
  try {
    await env.BIENESTAR_KV.put(
      `bot:estado:${chat_id}`,
      JSON.stringify(state),
      { expirationTtl: TTL_SECONDS }
    );
  } catch (error) {
    console.error(`Error al guardar estado de ${chat_id}:`, error);
  }
}

export async function getState(chat_id, env) {
  try {
    const data = await env.BIENESTAR_KV.get(`bot:estado:${chat_id}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error al obtener estado de ${chat_id}:`, error);
    return null;
  }
}

export async function clearState(chat_id, env) {
  try {
    await env.BIENESTAR_KV.delete(`bot:estado:${chat_id}`);
  } catch (error) {
    console.error(`Error al limpiar estado de ${chat_id}:`, error);
  }
}
