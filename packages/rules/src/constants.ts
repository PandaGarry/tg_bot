import type { BuildingKey, HouseKey, ResourceKey, UnitKey } from './types';

/* ─────────────────────────────  ЛОР  ─────────────────────────────
   ЭШФОЛЛ. Двести лет назад погас Второй Свет. Небо затянуло пеплом,
   урожай гибнет, но сквозь трещины в земле пробился Жар — он греет,
   светит и делает железо крепче. Королевства воюют не за землю, а за
   колодцы Жара. Когда пепел редеет, открывается Пылающий предел —
   ничья земля между королевствами, где Жар бьёт ключом.
   ──────────────────────────────────────────────────────────────── */

export const LORE = {
  title: 'ЭШФОЛЛ',
  subtitle: 'Пепел Второго Света',
  intro: [
    'Второй Свет погас двести лет назад. Пепел укрыл небо, и хлеб перестал родиться там, где его не греют.',
    'Но из трещин в земле поднялся Жар. Он греет теплицы, он держит кузни, он делает сталь острей. Жара мало, и его нельзя делить поровну.',
    'Ты — наследник обугленного дома. Подними город, собери войско и выведи его к колодцам Пылающего предела, где решается, кто будет греться этой зимой.',
  ],
} as const;

export const RESOURCE_NAMES: Record<ResourceKey, string> = {
  food: 'Еда',
  wood: 'Древесина',
  stone: 'Камень',
  iron: 'Железо',
  ember: 'Жар',
};

export const RESOURCE_ICONS: Record<ResourceKey, string> = {
  food: '🌾',
  wood: '🪵',
  stone: '🪨',
  iron: '⛏',
  ember: '🔥',
};

/** Производство в секунду на 1-й уровень здания. */
export const RESOURCE_BASE_RATE: Record<ResourceKey, number> = {
  food: 0.42,
  wood: 0.36,
  stone: 0.26,
  iron: 0.16,
  ember: 0,
};

export const BUILDING_NAMES: Record<BuildingKey, string> = {
  town_hall: 'Ратуша',
  farm: 'Ферма',
  lumber: 'Лесопилка',
  quarry: 'Каменоломня',
  mine: 'Рудник',
  barracks: 'Казарма',
  wall: 'Стена',
  warehouse: 'Склад',
  watchtower: 'Дозорная башня',
};

export const BUILDING_ICONS: Record<BuildingKey, string> = {
  town_hall: '🏛',
  farm: '🌾',
  lumber: '🪵',
  quarry: '🪨',
  mine: '⚒',
  barracks: '⚔',
  wall: '🧱',
  warehouse: '📦',
  watchtower: '🔭',
};

export const BUILDING_DESCRIPTIONS: Record<BuildingKey, string> = {
  town_hall: 'Сердце города. От её уровня зависит максимальный уровень остальных зданий и число одновременных маршей.',
  farm: 'Теплицы под пеплом. Даёт еду для войска и строителей.',
  lumber: 'Дерево идёт на осадные лестницы, древки и стропила.',
  quarry: 'Камень — стены и фундаменты.',
  mine: 'Железо — мечи, наконечники и подковы.',
  barracks: 'Обучает войско. Уровень ускоряет обучение и открывает новые своды.',
  wall: 'Стена гасит первый удар: добавляет защиту гарнизону.',
  warehouse: 'Хранит ресурсы. Без склада излишек сгниёт в пепле.',
  watchtower: 'Видит дальше: радиус обзора и точность разведки.',
};

/** Базовые цены и время постройки на 1-й уровень (уровень 1 → 2). */
export const BUILDING_BASE: Record<
  BuildingKey,
  { cost: Partial<Record<ResourceKey, number>>; time: number; produces?: ResourceKey }
> = {
  town_hall: { cost: { wood: 130, stone: 90, food: 70 }, time: 60 },
  farm: { cost: { wood: 60, food: 30 }, time: 25, produces: 'food' },
  lumber: { cost: { food: 50, wood: 40 }, time: 25, produces: 'wood' },
  quarry: { cost: { food: 70, wood: 90 }, time: 30, produces: 'stone' },
  mine: { cost: { wood: 110, stone: 140 }, time: 40, produces: 'iron' },
  barracks: { cost: { wood: 170, stone: 120 }, time: 45 },
  wall: { cost: { stone: 210, wood: 90 }, time: 40 },
  warehouse: { cost: { wood: 150, stone: 110 }, time: 35 },
  watchtower: { cost: { wood: 120, stone: 160 }, time: 40 },
};

export const COST_GROWTH = 1.62;
export const TIME_GROWTH = 1.46;
export const MAX_BUILDING_LEVEL = 12;

export const UNIT_NAMES: Record<UnitKey, string> = {
  infantry: 'Щитоносцы',
  archers: 'Лучники',
  cavalry: 'Всадники Пепла',
};

export const UNIT_ICONS: Record<UnitKey, string> = {
  infantry: '🛡',
  archers: '🏹',
  cavalry: '🐎',
};

export const UNITS: Record<
  UnitKey,
  {
    cost: Record<ResourceKey, number>;
    time: number;
    attack: number;
    hp: number;
    speed: number;
    capacity: number;
    power: number;
    counters: UnitKey;
    description: string;
  }
> = {
  infantry: {
    cost: { food: 30, wood: 10, iron: 15, stone: 0, ember: 0 },
    time: 1.2,
    attack: 12,
    hp: 100,
    speed: 1,
    capacity: 25,
    power: 10,
    counters: 'cavalry',
    description: 'Держат строй. Сильны против кавалерии, слабы против лучников.',
  },
  archers: {
    cost: { food: 20, wood: 35, iron: 20, stone: 0, ember: 0 },
    time: 1.7,
    attack: 18,
    hp: 70,
    speed: 1.05,
    capacity: 20,
    power: 14,
    counters: 'infantry',
    description: 'Бьют издалека, пока стена держит. Сильны против щитоносцев.',
  },
  cavalry: {
    cost: { food: 50, wood: 20, iron: 45, stone: 0, ember: 0 },
    time: 2.5,
    attack: 26,
    hp: 130,
    speed: 1.35,
    capacity: 45,
    power: 24,
    counters: 'archers',
    description: 'Быстрые и тяжёлые. Догоняют лучников, но ломаются о строй щитов.',
  },
};

export const COUNTER_BONUS = 1.28;

export const HOUSES: Record<
  HouseKey,
  { name: string; short: string; bonus: string; icon: string }
> = {
  order: {
    name: 'Пепельный орден',
    short: 'Орден',
    bonus: '+12% к защите гарнизона',
    icon: '⛪',
  },
  clans: {
    name: 'Вольные кланы',
    short: 'Кланы',
    bonus: '+12% к скорости марша',
    icon: '⛰',
  },
  trade: {
    name: 'Торговый дом',
    short: 'Дом',
    bonus: '+12% к добыче и сбору',
    icon: '⚖',
  },
};

export const HOUSE_BONUS = {
  orderDefense: 0.12,
  clansSpeed: 0.12,
  tradeGather: 0.12,
} as const;

/* ─────────────────  МИР И КАРТА  ───────────────── */

export const WORLD_SIZE = 96;

export const TERRAIN_NAMES: Record<string, string> = {
  plains: 'Пепельные поля',
  forest: 'Мёртвый лес',
  hills: 'Холмы',
  mountain: 'Гребень',
  water: 'Пепельное море',
  ash: 'Пылающий шлак',
};

/** Проходимость для городов и стоимость передвижения. */
export const TERRAIN_INFO: Record<string, { buildable: boolean; speed: number }> = {
  plains: { buildable: true, speed: 1 },
  forest: { buildable: true, speed: 0.85 },
  hills: { buildable: true, speed: 0.8 },
  mountain: { buildable: false, speed: 0.6 },
  water: { buildable: false, speed: 0.35 },
  ash: { buildable: true, speed: 1.05 },
};

export const MARCH_BASE_SPEED = 0.62; // тайлов в секунду

export const CAMP_LEVELS = [1, 2, 3, 4, 5, 6];

/** Добыча с лагеря мародёров по уровню. */
export const CAMP_LOOT: Record<number, Record<ResourceKey, number>> = {
  1: { food: 220, wood: 180, stone: 90, iron: 40, ember: 0 },
  2: { food: 420, wood: 340, stone: 180, iron: 90, ember: 0 },
  3: { food: 760, wood: 620, stone: 340, iron: 180, ember: 0 },
  4: { food: 1300, wood: 1050, stone: 600, iron: 330, ember: 0 },
  5: { food: 2100, wood: 1700, stone: 1000, iron: 560, ember: 0 },
  6: { food: 3300, wood: 2700, stone: 1600, iron: 900, ember: 0 },
};

/** Гарнизон лагеря мародёров по уровню. */
export const CAMP_GARRISON: Record<number, Record<UnitKey, number>> = {
  1: { infantry: 12, archers: 6, cavalry: 0 },
  2: { infantry: 30, archers: 18, cavalry: 4 },
  3: { infantry: 70, archers: 45, cavalry: 14 },
  4: { infantry: 140, archers: 90, cavalry: 35 },
  5: { infantry: 260, archers: 170, cavalry: 70 },
  6: { infantry: 440, archers: 300, cavalry: 130 },
};

/** Залежи: сколько ресурса в узле и как быстро он копится снова. */
export const NODE_INFO: Record<string, { amount: number; rate: number; label: string }> = {
  food: { amount: 4000, rate: 0.35, label: 'Урожайные теплицы' },
  wood: { amount: 3600, rate: 0.32, label: 'Мёртвая роща' },
  stone: { amount: 3000, rate: 0.26, label: 'Каменная осыпь' },
  iron: { amount: 2200, rate: 0.18, label: 'Железная жила' },
};

/** Жар-колодец (KvK): добыча жара в минуту за удержание. */
export const WELL_EMBER_PER_MINUTE = 20;

export const START_RESOURCES: Record<ResourceKey, number> = {
  food: 2000,
  wood: 2000,
  stone: 1200,
  iron: 1200,
  ember: 0,
};

export const START_BUILDINGS: Record<BuildingKey, number> = {
  town_hall: 2,
  farm: 1,
  lumber: 1,
  quarry: 1,
  mine: 1,
  barracks: 1,
  wall: 1,
  warehouse: 1,
  watchtower: 1,
};

export const KVK_TOWN_HALL_REQUIRED = 3;

export const MIGRATION_COOLDOWN_SEC = 180;

export const MAX_MARCHES_BASE = 1;
