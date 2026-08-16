/**
 * Локальная проверка перед выкладкой.
 *
 * `astro dev` отдаёт страницу, но не функцию: на боевом хостинге её поднимает
 * сам хостинг, а на своей машине поднимать некому. Этот сервер отдаёт собранную
 * статику и обрабатывает `/api/join` тем же кодом, что и обе боевые функции.
 * Так видно главное: доходит ли заявка в чат с вашим токеном.
 *
 * Запуск: npm run local. Токен и чаты берутся из .env рядом с проектом.
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

import { handleLead } from "../shared/lead.js";

const ROOT = new URL("../dist/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PORT = Number(process.env.PORT ?? 4321);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

const readBody = (request) =>
  new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      // Тело формы это несколько сотен байт. Всё, что больше, это не форма.
      if (raw.length > 8192) request.destroy();
    });
    request.on("end", () => resolve(raw));
  });

const server = createServer(async (request, response) => {
  if (request.url?.startsWith("/api/join")) {
    if (request.method !== "POST") {
      response.writeHead(405).end();
      return;
    }

    let body = null;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      body = null;
    }

    const answer = await handleLead(body, {
      token: process.env.TELEGRAM_BOT_TOKEN,
      chats: process.env.TELEGRAM_CHAT_IDS,
    });
    response.writeHead(answer.status, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(answer.body));
    return;
  }

  const path = decodeURIComponent((request.url ?? "/").split("?")[0]);
  const safe = normalize(path).replace(/^(\.\.[/\\])+/, "");
  let file = join(ROOT, safe);

  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(ROOT, "index.html");
  }

  try {
    await stat(file);
  } catch {
    response.writeHead(404).end("нет такой страницы");
    return;
  }

  response.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
});

server.listen(PORT, () => {
  const ready = process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_IDS;
  console.log(`страница: http://localhost:${PORT}`);
  console.log(
    ready
      ? "заявки уходят в Telegram по-настоящему"
      : "TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_IDS не заданы: форма ответит, что не настроена",
  );
});
