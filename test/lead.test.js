/**
 * Проверки заявки.
 *
 * Тестируем не форму, а то, что ломается молча: нормализацию контакта, отсев
 * роботов и экранирование в сообщении. Форма может выглядеть как угодно, а вот
 * заявка с чужим html внутри портит нам чат один раз и навсегда.
 *
 * Запуск: npm test.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BOT_TOKEN,
  CHAT_IDS,
  checkLead,
  cleanName,
  handleLead,
  leadMessage,
  normalizePhone,
  normalizeTelegram,
  setting,
} from "../shared/lead.js";

test("юзернейм принимается в любом виде, в каком его копируют", () => {
  for (const given of ["kolya_dev", "@kolya_dev", "t.me/kolya_dev", "https://t.me/kolya_dev/"]) {
    assert.equal(normalizeTelegram(given), "@kolya_dev");
  }
});

test("юзернейм не из букв и цифр отклоняется", () => {
  assert.equal(normalizeTelegram("не юзернейм"), null);
  assert.equal(normalizeTelegram("abc"), null);
});

test("местный номер становится международным", () => {
  assert.equal(normalizePhone("8 (999) 123-45-67"), "+79991234567");
  assert.equal(normalizePhone("+380 67 123 45 67"), "+380671234567");
  assert.equal(normalizePhone("123"), null);
});

test("имя приезжает без переводов строки", () => {
  assert.equal(cleanName("Коля\nВасильев"), "Коля Васильев");
});

test("заявка собирается целиком", () => {
  const checked = checkLead({
    name: "Коля",
    contact_kind: "telegram",
    contact: "https://t.me/kolya_dev",
    email: "kolya@example.com",
    source: "/?utm_source=tg",
  });
  assert.ok(checked.ok);
  assert.deepEqual(checked.lead, {
    name: "Коля",
    contactKind: "telegram",
    contact: "@kolya_dev",
    email: "kolya@example.com",
    source: "/?utm_source=tg",
  });
});

test("почта с опечаткой не проходит, пустая проходит", () => {
  const bad = checkLead({
    name: "Коля",
    contact_kind: "telegram",
    contact: "kolya_dev",
    email: "почта",
  });
  assert.equal(bad.ok, false);

  const fine = checkLead({ name: "Коля", contact_kind: "telegram", contact: "kolya_dev" });
  assert.ok(fine.ok);
  assert.equal(fine.lead.email, null);
});

test("html в имени экранируется", () => {
  const text = leadMessage({
    name: "<b>Коля</b>",
    contactKind: "telegram",
    contact: "@kolya_dev",
    email: null,
    source: null,
  });
  assert.ok(text.includes("&lt;b&gt;Коля&lt;/b&gt;"));
});

test("приманка и мгновенная отправка отвечают как человеку, но никуда не идут", async () => {
  const bait = await handleLead(
    { name: "Робот", contact_kind: "telegram", contact: "kolya_dev", company: "ООО Ромашка" },
    { token: "x", chats: "1" },
  );
  assert.equal(bait.status, 200);

  const fast = await handleLead(
    { name: "Робот", contact_kind: "telegram", contact: "kolya_dev", elapsed: 40 },
    { token: "x", chats: "1" },
  );
  assert.equal(fast.status, 200);
});

test("недоступный чат это отказ, а один доступный из двух это успех", async () => {
  const real = globalThis.fetch;
  const seen = [];
  // Первый получатель не нажимал «Старт», второй нажимал.
  globalThis.fetch = async (_url, init) => {
    const chat = String(JSON.parse(init.body).chat_id);
    seen.push(chat);
    return { ok: chat === "2" };
  };

  try {
    const lead = { name: "Коля", contact_kind: "telegram", contact: "kolya_dev", elapsed: 9000 };

    const lost = await handleLead(lead, { token: "x", chats: "1" });
    assert.equal(lost.status, 502);

    const partly = await handleLead(lead, { token: "x", chats: "1,2" });
    assert.equal(partly.status, 201);
    assert.deepEqual(seen, ["1", "1", "2"]);
  } finally {
    globalThis.fetch = real;
  }
});

test("без настроек заявку не теряем молча", async () => {
  const answer = await handleLead(
    { name: "Коля", contact_kind: "telegram", contact: "kolya_dev", elapsed: 9000 },
    {},
  );
  assert.equal(answer.status, 503);
});

test("настройка читается строго по своему имени", () => {
  assert.equal(setting({ TELEGRAM_BOT_TOKEN2: "наш" }, BOT_TOKEN), "наш");
  // Соседняя переменная без двойки это другой бот под другие задачи.
  // Заглянуть в неё нельзя даже когда своя пуста: заявки уйдут не туда.
  assert.equal(setting({ TELEGRAM_BOT_TOKEN: "чужой" }, BOT_TOKEN), "");
  assert.equal(setting({ TELEGRAM_CHAT_IDS: "1,2" }, CHAT_IDS), "");
  // Вставка из буфера приносит перевод строки, Telegram на него отвечает отказом.
  assert.equal(setting({ [BOT_TOKEN]: ` abc${String.fromCharCode(10)}` }, BOT_TOKEN), "abc");
  assert.equal(setting(undefined, BOT_TOKEN), "");
});
