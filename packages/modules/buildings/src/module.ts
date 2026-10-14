/**
 * Модуль каталога зданий (этап 1 roadmap): данные, без игровой логики.
 * Постройка, очередь и эффекты — в других модулях и на следующих этапах.
 *
 * Названия зданий в словарях: русские — из docs/design/buildings.md; английские —
 * буквальные переводы, предложены 14.10 и ждут подтверждения заказчика.
 */

import { defineModule } from "@tdl/kernel";

export const buildingsModule = defineModule({
  id: "buildings",
  version: 1,
  kind: "core",
  content: {
    strings: {
      ru: {
        "building.citadel": "Цитадель",
        "building.wall": "Стена",
        "building.warehouse": "Склад",
        "building.infirmary": "Лазарет",
        "building.academy": "Академия",
        "building.clan-hall": "Зал клана",
        "building.tavern": "Таверна",
        "building.watchtower": "Надзорная вышка",
        "building.forge": "Кузница",
        "building.trade-post": "Торговый пост",
        "building.barracks": "Казарма",
        "building.range": "Стрельбище",
        "building.stable": "Конюшня",
        "building.siege-yard": "Осадный двор",
        "building.sawmill": "Лесопилка",
        "building.pen": "Загон",
        "building.quarry": "Каменоломня",
        "building.mine": "Рудник",
        "building.farm": "Ферма",
      },
      en: {
        "building.citadel": "Citadel",
        "building.wall": "Wall",
        "building.warehouse": "Warehouse",
        "building.infirmary": "Infirmary",
        "building.academy": "Academy",
        "building.clan-hall": "Clan Hall",
        "building.tavern": "Tavern",
        "building.watchtower": "Watchtower",
        "building.forge": "Forge",
        "building.trade-post": "Trade Post",
        "building.barracks": "Barracks",
        "building.range": "Range",
        "building.stable": "Stable",
        "building.siege-yard": "Siege Yard",
        "building.sawmill": "Sawmill",
        "building.pen": "Pen",
        "building.quarry": "Quarry",
        "building.mine": "Mine",
        "building.farm": "Farm",
      },
    },
  },
});

export default buildingsModule;
