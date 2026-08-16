/**
 * Заявка: разбор, проверка и отправка нам в Telegram.
 *
 * Лежит отдельно от обработчиков, потому что обработчиков два: один под
 * Cloudflare Pages, второй под Vercel. Отличаются они только тем, как получить
 * тело запроса и как ответить, а всё остальное обязано быть общим: разъехавшаяся
 * проверка это заявка, которая принята на одном хостинге и отклонена на другом.
 *
 * Тот же файл читает браузер: форма проверяет ввод теми же правилами, чтобы
 * человек узнавал про опечатку сразу, а не после круга по сети.
 */

export type ContactKind = "telegram" | "phone";

export type Lead = {
  name: string;
  contactKind: ContactKind;
  contact: string;
  email: string | null;
  source: string | null;
};

// Юзернейм Telegram: латиница, цифры и подчёркивание, от пяти символов.
// Проверяем форму, а не существование: узнать второе можно только у Telegram.
const TELEGRAM = /^[a-zA-Z0-9_]{5,32}$/;
// Приставки, которые люди приносят из адресной строки и из чужой формы.
const PREFIXES = ["https://", "http://", "t.me/", "telegram.me/", "@"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function cleanName(value: string): string {
  // Управляющие символы вырезаем по номеру, а не регуляркой с диапазоном: сами
  // эти символы в исходнике невидимы, и любая правка файла их однажды съест.
  // В Telegram перевод строки внутри поля превращает одно сообщение в подделку
  // под несколько.
  const plain = Array.from(value, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return code < 32 || code === 127 ? " " : ch;
  }).join("");
  return plain.replace(/\s+/g, " ").trim();
}

export function normalizeTelegram(value: string): string | null {
  let handle = value.trim();
  for (;;) {
    const found = PREFIXES.find((prefix) => handle.toLowerCase().startsWith(prefix));
    if (!found) break;
    handle = handle.slice(found.length);
  }
  handle = handle.replace(/\/+$/, "").split("?")[0];
  return TELEGRAM.test(handle) ? `@${handle}` : null;
}

export function normalizePhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  // Восьмёрка в начале это местная запись российского и казахстанского номера.
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length < 9 || digits.length > 15) return null;
  return `+${digits}`;
}

export type Check = { ok: true; lead: Lead } | { ok: false; message: string };

/** Разбирает то, что пришло из формы. Никому на слово не верим: тело запроса
 *  может прислать кто угодно, а не только наша страница. */
export function checkLead(raw: unknown): Check {
  const body = (raw ?? {}) as Record<string, unknown>;

  const name = cleanName(String(body.name ?? "")).slice(0, 80);
  if (name.length < 2) return { ok: false, message: "Напишите, как к вам обращаться" };

  const kind: ContactKind = body.contact_kind === "phone" ? "phone" : "telegram";
  const given = String(body.contact ?? "").slice(0, 120);
  const contact = kind === "telegram" ? normalizeTelegram(given) : normalizePhone(given);
  if (!contact) {
    return {
      ok: false,
      message:
        kind === "telegram"
          ? "Юзернейм состоит из латиницы, цифр и подчёркиваний"
          : "Номер нужен с кодом страны и целиком",
    };
  }

  const post = String(body.email ?? "")
    .trim()
    .slice(0, 255);
  if (post && !EMAIL.test(post)) return { ok: false, message: "Почта с опечаткой" };

  const source = String(body.source ?? "")
    .trim()
    .slice(0, 200);

  return {
    ok: true,
    lead: { name, contactKind: kind, contact, email: post || null, source: source || null },
  };
}

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Заявка так, как её читают с телефона: сначала контакт, потом остальное. */
export function leadMessage(lead: Lead): string {
  const lines = [
    "<b>Заявка в лист ожидания</b>",
    "",
    `Имя: ${escape(lead.name)}`,
    lead.contactKind === "telegram"
      ? `Telegram: ${escape(lead.contact)}`
      : `Телефон: ${escape(lead.contact)}`,
  ];
  if (lead.email) lines.push(`Почта: ${escape(lead.email)}`);
  if (lead.source) lines.push(`Источник: ${escape(lead.source)}`);
  return lines.join("\n");
}

/** Список через запятую: чаты в одной настройке, домены в другой. */
export function commaList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);
}

/**
 * Отправляет заявку во все наши чаты.
 *
 * Возвращает, дошло ли хоть куда-то. Если не дошло никуда, человеку честно
 * говорим «попробуйте ещё раз»: базы у этой страницы нет, и потерянная заявка
 * теряется навсегда.
 */
export async function sendLead(
  lead: Lead,
  env: { token: string; chats: string[] },
): Promise<boolean> {
  const text = leadMessage(lead);
  const markup =
    lead.contactKind === "telegram"
      ? {
          inline_keyboard: [
            [{ text: `Написать ${lead.contact}`, url: `https://t.me/${lead.contact.slice(1)}` }],
          ],
        }
      : undefined;

  const results = await Promise.all(
    env.chats.map(async (chat) => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${env.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chat,
            text,
            parse_mode: "HTML",
            reply_markup: markup,
          }),
        });
        return response.ok;
      } catch {
        return false;
      }
    }),
  );

  return results.some(Boolean);
}

/**
 * Общий обработчик: из него собраны оба хостинговых.
 *
 * Приманку и слишком быструю отправку не отвергаем, а тихо принимаем: разница
 * в ответах это подсказка роботу, что именно нужно поменять.
 */
export async function handleLead(
  raw: unknown,
  env: { token?: string; chats?: string },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const body = (raw ?? {}) as Record<string, unknown>;

  if (String(body.company ?? "").trim()) return { status: 200, body: { ok: true } };
  // Человек не заполняет три поля за полторы секунды. Робот заполняет.
  if (typeof body.elapsed === "number" && body.elapsed >= 0 && body.elapsed < 1500) {
    return { status: 200, body: { ok: true } };
  }

  const checked = checkLead(body);
  if (!checked.ok) return { status: 422, body: { error: { message: checked.message } } };

  const token = env.token ?? "";
  const chats = commaList(env.chats);
  if (!token || chats.length === 0) {
    return {
      status: 503,
      body: { error: { message: "Форма пока не настроена. Напишите нам, пожалуйста, в Telegram" } },
    };
  }

  const delivered = await sendLead(checked.lead, { token, chats });
  if (!delivered) {
    return {
      status: 502,
      body: { error: { message: "Не получилось отправить. Попробуйте ещё раз через минуту" } },
    };
  }

  return { status: 201, body: { ok: true } };
}

/** Чужой домен, постучавшийся в форму. Пусто в настройке значит «пускаем всех». */
export function originAllowed(origin: string | null, allowed: string | undefined): boolean {
  const list = commaList(allowed);
  if (list.length === 0) return true;
  if (!origin) return false;
  return list.includes(origin);
}
