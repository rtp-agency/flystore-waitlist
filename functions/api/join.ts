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
import { commaList, handleLead, originAllowed } from "../../shared/lead";

type Env = {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_IDS?: string;
  ALLOWED_ORIGIN?: string;
};

type Context = { request: Request; env: Env };

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  // Чужой домен, дёргающий нашу форму, это либо кража трафика, либо спам.
  // Настройка пустая значит проверки нет: так проще поднять на новом адресе.
  if (!originAllowed(request.headers.get("origin"), env.ALLOWED_ORIGIN)) {
    return json(403, { error: { message: "Заявки принимаются только с нашего сайта" } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: { message: "Не разобрали заявку. Попробуйте ещё раз" } });
  }

  const answer = await handleLead(body, {
    token: env.TELEGRAM_BOT_TOKEN,
    chats: env.TELEGRAM_CHAT_IDS,
  });

  if (answer.status === 503 && commaList(env.TELEGRAM_CHAT_IDS).length === 0) {
    console.warn("заявка пришла, но TELEGRAM_CHAT_IDS пуст: отправлять некому");
  }

  return json(answer.status, answer.body);
}
