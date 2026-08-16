/**
 * Макеты витрин для примеров.
 *
 * Лежат отдельно, потому что показывают их два места: галерея на лендинге
 * и рекламная страница листа ожидания. Скопированный список разъезжается
 * на первой же правке, и половина сайта начинает врать про продукт.
 *
 * Собраны теми же правилами, что и настоящие витрины: палитра из реестра,
 * скелет задаёт раскладку, характер — кегль и плотность. Поле `shot` пустое
 * до первых снимков настоящих магазинов: как только они появятся, встанут
 * туда и вытеснят макет.
 */

export type Good = { name: string; price: string; tone: string };

export type Shop = {
  kind: "catalog" | "lookbook" | "loud" | "instant" | "single";
  prompt: string;
  name: string;
  host: string;
  tags: string;
  shot: string | null;
  look: { bg: string; ink: string; muted: string; band: string; radius: string };
  headline: string;
  headlineClass: string;
  note?: string;
  goods: Good[];
  footer: [string, string];
};

export const SHOPS: Shop[] = [
  {
    kind: "catalog",
    prompt: "магазин украшений ручной работы",
    name: "Ателье",
    host: "atelye.flystore.app",
    tags: "каталог · песочная · тихий журнал",
    shot: null,
    look: {
      bg: "#f7f3ed",
      ink: "#2a2622",
      muted: "#7d7468",
      band: "linear-gradient(118deg,#c8b08a,#8d7355)",
      radius: "14px",
    },
    headline: "Новая коллекция",
    headlineClass: "text-[1.3rem] font-bold tracking-[-0.03em]",
    goods: [
      { name: "Кольцо", price: "$62", tone: "#e3d8c8" },
      { name: "Серьги", price: "$48", tone: "#cfc3b1" },
      { name: "Цепь", price: "$96", tone: "#ddd2c1" },
    ],
    footer: ["Корзина · 0", "Оплата при получении"],
  },
  {
    kind: "lookbook",
    prompt: "корейская косметика с доставкой",
    name: "Rosa",
    host: "rosa.flystore.app",
    tags: "витрина-журнал · розовый рассвет · спокойный",
    shot: null,
    look: {
      bg: "#fbf5f5",
      ink: "#33262a",
      muted: "#8a737a",
      band: "linear-gradient(118deg,#e8bfc3,#b8767a)",
      radius: "20px",
    },
    headline: "Уход по утрам",
    headlineClass: "text-[1.1rem] font-medium tracking-[0.01em]",
    goods: [
      { name: "Сыворотка", price: "$28", tone: "#f0dcdd" },
      { name: "Крем", price: "$34", tone: "#e6cdd0" },
      { name: "Патчи", price: "$12", tone: "#f4e4e5" },
    ],
    footer: ["Доставка завтра", "Оплата картой"],
  },
  {
    kind: "loud",
    prompt: "магазин электроники и аксессуаров",
    name: "Volt",
    host: "volt.flystore.app",
    tags: "распродажа · ночная · громкий",
    shot: null,
    look: {
      bg: "#101216",
      ink: "#f2f2f4",
      muted: "#8b8f9a",
      band: "linear-gradient(118deg,#3d6bff,#1b2ea8)",
      radius: "8px",
    },
    headline: "СКИДКИ ДО 40%",
    headlineClass: "text-[1.45rem] font-extrabold tracking-[-0.04em] uppercase leading-none",
    note: "до конца недели",
    goods: [
      { name: "Наушники", price: "$119", tone: "#1b1e24" },
      { name: "Кабель", price: "$14", tone: "#1b1e24" },
      { name: "Док", price: "$78", tone: "#1b1e24" },
      { name: "Чехол", price: "$21", tone: "#1b1e24" },
      { name: "Колонка", price: "$64", tone: "#1b1e24" },
      { name: "Адаптер", price: "$18", tone: "#1b1e24" },
    ],
    footer: ["Корзина · 2", "Оплата картой"],
  },
  {
    kind: "instant",
    prompt: "игровые аккаунты с мгновенной выдачей",
    name: "Ключи",
    host: "keys.flystore.app",
    tags: "мгновенная выдача · графит · строгий",
    shot: null,
    look: {
      bg: "#f4f5f7",
      ink: "#1b1d22",
      muted: "#6f747e",
      band: "linear-gradient(118deg,#3c4250,#1b1d22)",
      radius: "10px",
    },
    headline: "Доступ приходит сразу",
    headlineClass: "text-[1.05rem] font-bold tracking-[-0.02em]",
    note: "Данные скрыты до оплаты",
    goods: [
      { name: "Аккаунт Steam", price: "$34", tone: "#e9eaee" },
      { name: "Подписка на год", price: "$59", tone: "#e9eaee" },
      { name: "Ключ активации", price: "$12", tone: "#e9eaee" },
    ],
    footer: ["Выдача автоматом", "Оплата картой"],
  },
  {
    kind: "single",
    prompt: "курс по фотографии, одна страница",
    name: "Свет",
    host: "svet.flystore.app",
    tags: "одностраничник · охра · плотный",
    shot: null,
    look: {
      bg: "#faf6f0",
      ink: "#2b2418",
      muted: "#847763",
      band: "linear-gradient(118deg,#d9a441,#9a6a1c)",
      radius: "18px",
    },
    headline: "Курс по свету за 6 недель",
    headlineClass: "text-[0.98rem] font-bold leading-snug tracking-[-0.02em]",
    note: "Восемь занятий, разбор работ и чат с автором",
    goods: [{ name: "Курс", price: "$149", tone: "#efe3cf" }],
    footer: ["Мест осталось 8", "Оплата картой"],
  },
  {
    kind: "catalog",
    prompt: "керамика ручной работы, небольшой тираж",
    name: "Глина",
    host: "glina.flystore.app",
    tags: "каталог · травяная · тёплый",
    shot: null,
    look: {
      bg: "#f2f5ef",
      ink: "#232a24",
      muted: "#6f7c70",
      band: "linear-gradient(118deg,#8fae90,#3f6b4a)",
      radius: "24px",
    },
    headline: "Обжиг этой недели",
    headlineClass: "text-[1.2rem] font-semibold tracking-[-0.02em]",
    goods: [
      { name: "Чашка", price: "$24", tone: "#dee5da" },
      { name: "Тарелка", price: "$31", tone: "#cdd7c9" },
      { name: "Ваза", price: "$57", tone: "#e4eade" },
    ],
    footer: ["Корзина · 1", "Самовывоз в Киеве"],
  },
];
