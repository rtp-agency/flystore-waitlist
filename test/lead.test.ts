/**
 * Проверки заявки.
 *
 * Тестируем не форму, а то, что ломается молча: нормализацию контакта, отсев
 * роботов и экранирование в сообщении. Форма может выглядеть как угодно, а вот
 * заявка с чужим html внутри портит нам чат один раз и навсегда.
 *
 * Запуск: npm test. Node 24 читает TypeScript сам, сборка не нужна.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkLead, cleanName, handleLead, leadMessage, normalizePhone, normalizeTelegram } from "../shared/lead.ts";

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
  const bad = checkLead({ name: "Коля", contact_kind: "telegram", contact: "kolya_dev", email: "почта" });
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

test("без настроек заявку не теряем молча", async () => {
  const answer = await handleLead(
    { name: "Коля", contact_kind: "telegram", contact: "kolya_dev", elapsed: 9000 },
    {},
  );
  assert.equal(answer.status, 503);
});
