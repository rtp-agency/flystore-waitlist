/**
 * Заявка: разбор, проверка и отправка нам в Telegram.
 *
 * Лежит отдельно от обработчиков, потому что обработчиков два: один под Vercel,
 * второй под Cloudflare Pages. Отличаются они только тем, как получить тело
 * запроса и как ответить, а всё остальное обязано быть общим: разъехавшаяся
 * проверка это заявка, принятая на одном хостинге и отклонённая на другом.
 *
 * Тот же файл читает браузер: форма проверяет ввод теми же правилами, чтобы
 * человек узнавал про опечатку сразу, а не после круга по сети.
 *
 * Файл на обычном JavaScript, а не на TypeScript, и импортируется с явным
 * расширением. Так надо: на Vercel функция запускается как есть, без сборки,
 * и импорт «../shared/lead» без расширения там просто не находится. Первая
 * же выкладка ответила FUNCTION_INVOCATION_FAILED именно поэтому.
 *
 * @typedef {"telegram" | "phone"} ContactKind
 * @typedef {{name: string, contactKind: ContactKind, contact: string,
 *            email: string | null, source: string | null}} Lead
 */

// Юзернейм Telegram: латиница, цифры и подчёркивание, от пяти символов.
// Проверяем форму, а не существование: узнать второе можно только у Telegram.
const TELEGRAM = /^[a-zA-Z0-9_]{5,32}$/;
// Приставки, которые люди приносят из адресной строки и из чужой формы.
const PREFIXES = ["https://", "http://", "t.me/", "telegram.me/", "@"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** @param {string} value */
export function cleanName(value) {
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

/**
 * @param {string} value
 * @returns {string | null}
 */
export function normalizeTelegram(value) {
  let handle = value.trim();
  for (;;) {
    const found = PREFIXES.find((prefix) => handle.toLowerCase().startsWith(prefix));
    if (!found) break;
    handle = handle.slice(found.length);
  }
  handle = handle.replace(/\/+$/, "").split("?")[0];
  return TELEGRAM.test(handle) ? `@${handle}` : null;
}

/**
 * @param {string} value
 * @returns {string | null}
 */
export function normalizePhone(value) {
  let digits = value.replace(/\D/g, "");
  // Восьмёрка в начале это местная запись российского и казахстанского номера.
  if (digits.length === 11 && digits.startsWith("8")) digits = `7${digits.slice(1)}`;
  if (digits.length < 9 || digits.length > 15) return null;
  return `+${digits}`;
}

/**
 * Разбирает то, что пришло из формы. Никому на слово не верим: тело запроса
 * может прислать кто угодно, а не только наша страница.
 *
 * @param {unknown} raw
 * @returns {{ok: true, lead: Lead} | {ok: false, message: string}}
 */
export function checkLead(raw) {
  const body = raw ?? {};

  const name = cleanName(String(body.name ?? "")).slice(0, 80);
  if (name.length < 2) return { ok: false, message: "Напишите, как к вам обращаться" };

  const kind = body.contact_kind === "phone" ? "phone" : "telegram";
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

/** @param {string} value */
const escape = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Заявка так, как её читают с телефона: сначала контакт, потом остальное.
 * @param {Lead} lead
 */
export function leadMessage(lead) {
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

/**
 * Значение настройки из окружения.
 *
 * Обрезаем пробелы: значение попадает в панель хостинга вставкой из буфера,
 * а лишний перевод строки в токене это отказ Telegram без объяснений.
 *
 * @param {Record<string, string | undefined> | undefined} source
 * @param {string} name
 */
export function setting(source, name) {
  return String(source?.[name] ?? "").trim();
}

/**
 * Имена переменных этой страницы.
 *
 * Двойка на конце не описка и не запасной вариант. В этом аккаунте
 * `TELEGRAM_BOT_TOKEN` занят другим ботом под другие задачи, а переменная
 * с одним ключом в окружении может быть только одна. Читаем строго вторые
 * имена и в первые не заглядываем: заявки листа ожидания должны уходить
 * своим ботом, а не тем, который окажется в общей настройке.
 */
export const BOT_TOKEN = "TELEGRAM_BOT_TOKEN2";
export const CHAT_IDS = "TELEGRAM_CHAT_IDS2";

/**
 * Список через запятую: чаты в одной настройке, домены в другой.
 * @param {string | undefined} value
 */
export function commaList(value) {
  return (value ?? "")
    .split(",")
    .map((piece) => piece.trim())
    .filter(Boolean);
}

/**
 * Отправляет заявку во все наши чаты.
 *
 * Возвращает, кому дошло, а кому нет. Самая частая причина отказа не поломка,
 * а то, что получатель ни разу не нажал в боте «Старт»: Telegram запрещает боту
 * писать первым, и такая заявка пропала бы молча.
 *
 * @param {Lead} lead
 * @param {{token: string, chats: string[]}} env
 * @returns {Promise<{sent: number, failed: string[]}>}
 */
export async function sendLead(lead, env) {
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
        return { chat, ok: response.ok };
      } catch {
        return { chat, ok: false };
      }
    }),
  );

  return {
    sent: results.filter((item) => item.ok).length,
    failed: results.filter((item) => !item.ok).map((item) => item.chat),
  };
}

/**
 * Общий обработчик: из него собраны оба хостинговых.
 *
 * Приманку и слишком быструю отправку не отвергаем, а тихо принимаем: разница
 * в ответах это подсказка роботу, что именно нужно поменять.
 *
 * @param {unknown} raw
 * @param {{token?: string, chats?: string}} env
 * @returns {Promise<{status: number, body: Record<string, unknown>}>}
 */
export async function handleLead(raw, env) {
  const body = raw ?? {};

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
    console.error("заявка пришла, но бот не настроен: нет токена или списка чатов");
    return {
      status: 503,
      body: { error: { message: "Форма пока не настроена. Напишите нам, пожалуйста, в Telegram" } },
    };
  }

  const delivery = await sendLead(checked.lead, { token, chats });

  if (delivery.failed.length > 0) {
    console.warn(
      `не доставлено в чаты: ${delivery.failed.join(", ")}. ` +
        "Каждый получатель должен хотя бы раз нажать «Старт» в боте",
    );
  }

  if (delivery.sent === 0) {
    // Базы у страницы нет, и молча потерянная заявка теряется навсегда.
    // Пусть она хотя бы останется в журнале хостинга: оттуда её можно достать
    // руками, пока чат чинится.
    console.error(`заявка не доставлена никому: ${JSON.stringify(checked.lead)}`);
    return {
      status: 502,
      body: { error: { message: "Не получилось отправить. Попробуйте ещё раз через минуту" } },
    };
  }

  return { status: 201, body: { ok: true } };
}

/**
 * Чужой домен, постучавшийся в форму. Пусто в настройке значит «пускаем всех».
 *
 * @param {string | null} origin
 * @param {string | undefined} allowed
 */
export function originAllowed(origin, allowed) {
  const list = commaList(allowed);
  if (list.length === 0) return true;
  if (!origin) return false;
  return list.includes(origin);
}
