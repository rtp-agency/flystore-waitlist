/**
 * Приём заявки на Vercel.
 *
 * Обычный JavaScript с явным расширением в импорте: функция запускается как
 * есть, без сборки, и путь без расширения в ней не резолвится. Первая выкладка
 * упала именно на этом, ответив страницей FUNCTION_INVOCATION_FAILED.
 *
 * Отсюда же общий try: неожиданная ошибка обязана вернуться человеку понятной
 * строкой, а не страницей хостинга, из которой не видно вообще ничего.
 */
import { handleLead, originAllowed, setting } from "../shared/lead.js";

export default async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      response.status(405).json({ error: { message: "Метод не поддерживается" } });
      return;
    }

    // Чужой домен, дёргающий нашу форму, это либо кража трафика, либо спам.
    // Настройка пустая значит проверки нет: так проще поднять на новом адресе.
    const origin = request.headers?.origin;
    const allowed = setting(process.env, "ALLOWED_ORIGIN");
    if (!originAllowed(typeof origin === "string" ? origin : null, allowed)) {
      response.status(403).json({ error: { message: "Заявки принимаются только с нашего сайта" } });
      return;
    }

    let body = request.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        response.status(400).json({ error: { message: "Не разобрали заявку. Попробуйте ещё раз" } });
        return;
      }
    }

    const answer = await handleLead(body, {
      token: setting(process.env, "TELEGRAM_BOT_TOKEN"),
      chats: setting(process.env, "TELEGRAM_CHAT_IDS"),
    });

    response.status(answer.status).json(answer.body);
  } catch (error) {
    console.error("функция упала:", error);
    response
      .status(500)
      .json({ error: { message: "Не получилось отправить. Попробуйте ещё раз через минуту" } });
  }
}
