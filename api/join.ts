/**
 * Приём заявки на Vercel.
 *
 * То же самое, что и функция для Cloudflare, только вход и выход в стиле Node.
 * Оба файла лежат в проекте одновременно намеренно: хостинг видит свой и не
 * замечает чужого, а переезд с одного на другой не требует правок в коде.
 */
import { handleLead, originAllowed } from "../shared/lead";

// Типы Vercel тянуть в зависимости незачем: из запроса нам нужны три поля.
type Request = { body?: unknown; headers: Record<string, string | string[] | undefined> };
type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => void;
};

export default async function handler(request: Request, response: Response): Promise<void> {
  const origin = request.headers.origin;
  if (!originAllowed(typeof origin === "string" ? origin : null, process.env.ALLOWED_ORIGIN)) {
    response.status(403).json({ error: { message: "Заявки принимаются только с нашего сайта" } });
    return;
  }

  let body: unknown = request.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      response.status(400).json({ error: { message: "Не разобрали заявку. Попробуйте ещё раз" } });
      return;
    }
  }

  const answer = await handleLead(body, {
    token: process.env.TELEGRAM_BOT_TOKEN,
    chats: process.env.TELEGRAM_CHAT_IDS,
  });

  response.status(answer.status).json(answer.body);
}
