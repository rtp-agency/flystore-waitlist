/**
 * Приём заявки на Cloudflare Pages.
 *
 * Функция лежит рядом со статикой и поднимается вместе с ней: отдельного
 * сервера у страницы нет и не нужно. Токен бота живёт в переменных окружения
 * Pages и в браузер не попадает никогда: с токеном в клиентском скрипте чужой
 * человек читает нашу переписку и пишет от имени бота.
 *
 * Разбор и отправка общие с версией для Vercel, здесь только вход и выход.
 */
import { BOT_TOKEN, CHAT_IDS, handleLead, originAllowed, setting } from "../../shared/lead.js";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export async function onRequestPost({ request, env }) {
  try {
    if (!originAllowed(request.headers.get("origin"), setting(env, "ALLOWED_ORIGIN"))) {
      return json(403, { error: { message: "Заявки принимаются только с нашего сайта" } });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: { message: "Не разобрали заявку. Попробуйте ещё раз" } });
    }

    const answer = await handleLead(body, {
      token: setting(env, BOT_TOKEN),
      chats: setting(env, CHAT_IDS),
    });

    return json(answer.status, answer.body);
  } catch (error) {
    console.error("функция упала:", error);
    return json(500, {
      error: { message: "Не получилось отправить. Попробуйте ещё раз через минуту" },
    });
  }
}
