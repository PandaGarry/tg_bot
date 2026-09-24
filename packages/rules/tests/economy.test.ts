import { describe, expect, it } from 'vitest';
import {
  accrue,
  armyCost,
  buildingCost,
  buildingTime,
  canAfford,
  canUpgrade,
  missingResources,
  productionPerSecond,
  storageCap,
} from '../src/economy';
import { emptyResources, emptyTroops } from '../src/types';
import { START_BUILDINGS, UNITS } from '../src/constants';

describe('стоимость и время', () => {
  it('растут с уровнем', () => {
    expect(buildingCost('farm', 3).wood).toBeGreaterThan(buildingCost('farm', 2).wood);
    expect(buildingTime('farm', 4)).toBeGreaterThan(buildingTime('farm', 2));
  });

  it('апгрейд 1→2 не требует ратушу выше первого уровня', () => {
    expect(canUpgrade('farm', 1, 1).ok).toBe(false);
    expect(canUpgrade('farm', 1, 2).ok).toBe(true);
    expect(canUpgrade('town_hall', 1, 1).ok).toBe(true);
  });
});

describe('производство и хранилище', () => {
  it('ферма даёт еду, уровень увеличивает выработку', () => {
    const lvl1 = productionPerSecond({ farm: 1 });
    const lvl4 = productionPerSecond({ farm: 4 });
    expect(lvl1.food).toBeGreaterThan(0);
    expect(lvl4.food).toBeGreaterThan(lvl1.food * 3.5);
  });

  it('склад растёт', () => {
    expect(storageCap(3)).toBeGreaterThan(storageCap(1) * 2);
  });

  it('ленивое начисление ограничивается хранилищем', () => {
    const rates = productionPerSecond(START_BUILDINGS);
    const now = 1_000_000;
    const inOneHour = accrue(emptyResources(), rates, now, now + 3 * 3_600_000, storageCap(1));
    expect(inOneHour.capped).toBe(true);
    expect(inOneHour.resources.food).toBe(storageCap(1));

    const inTenSeconds = accrue(emptyResources(), rates, now, now + 10_000, storageCap(1));
    expect(inTenSeconds.capped).toBe(false);
    expect(inTenSeconds.resources.food).toBeCloseTo(rates.food * 10, 4);
  });

  it('жар не начисляется временем', () => {
    const rates = { ...productionPerSecond(START_BUILDINGS), ember: 999 };
    const r = accrue(emptyResources(), rates, 0, 60_000, 1e9);
    expect(r.resources.ember).toBe(0);
  });
});

describe('ресурсы и войско', () => {
  it('проверка и подсчёт недостачи', () => {
    const have = { ...emptyResources(), wood: 100 };
    expect(canAfford(have, { wood: 100 })).toBe(true);
    expect(canAfford(have, { wood: 101 })).toBe(false);
    expect(missingResources(have, { wood: 150, iron: 20 }).wood).toBe(50);
  });

  it('армия стоит пропорционально числу', () => {
    const one = armyCost({ ...emptyTroops(), cavalry: 1 });
    const ten = armyCost({ ...emptyTroops(), cavalry: 10 });
    expect(ten.iron).toBe(one.iron * 10);
    expect(one.iron).toBe(UNITS.cavalry.cost.iron);
  });
});
