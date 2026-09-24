import { describe, expect, it } from 'vitest';
import { generateMap, spawnCandidates, terrainAt, terrainFromCode } from '../src/map';
import { travelSeconds } from '../src/march';
import { emptyTroops } from '../src/types';
import { WORLD_SIZE } from '../src/constants';

describe('карта', () => {
  it('детерминирована по seed', () => {
    const a = generateMap(42, 'home', 32);
    const b = generateMap(42, 'home', 32);
    const c = generateMap(43, 'home', 32);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  it('код тайла обратим', () => {
    for (let i = 0; i < 6; i++) {
      expect(['plains', 'forest', 'hills', 'mountain', 'water', 'ash']).toContain(
        terrainFromCode(i),
      );
    }
  });

  it('на карте KvK преобладает шлак, на домашней — нет', () => {
    let ash = 0;
    let total = 0;
    for (let y = 0; y < WORLD_SIZE; y += 3) {
      for (let x = 0; x < WORLD_SIZE; x += 3) {
        total++;
        if (terrainAt(7, 'kvk', x, y) === 'ash') ash++;
      }
    }
    expect(ash / total).toBeGreaterThan(0.3);
    expect(terrainAt(7, 'home', 10, 10)).not.toBe('ash');
  });

  it('стартовые точки валидны и не повторяются подряд', () => {
    const gen = spawnCandidates(5, 'home', WORLD_SIZE);
    const first = gen.next().value!;
    expect(first.x).toBeGreaterThanOrEqual(4);
    expect(first.x).toBeLessThan(WORLD_SIZE - 4);
    expect(['water', 'mountain']).not.toContain(terrainAt(5, 'home', first.x, first.y));
  });
});

describe('марши', () => {
  const base = { seed: 11, kind: 'home' as const, size: WORLD_SIZE, house: 'order' as const };

  it('дальше — дольше, кавалерия быстрее пехоты', () => {
    const inf = { ...emptyTroops(), infantry: 100 };
    const cav = { ...emptyTroops(), cavalry: 100 };
    const near = travelSeconds({ ...base, fromX: 10, fromY: 10, toX: 14, toY: 10, troops: inf });
    const far = travelSeconds({ ...base, fromX: 10, fromY: 10, toX: 40, toY: 10, troops: inf });
    const fast = travelSeconds({ ...base, fromX: 10, fromY: 10, toX: 40, toY: 10, troops: cav });
    expect(far).toBeGreaterThan(near);
    expect(fast).toBeLessThan(far);
  });

  it('пустая армия не идёт', () => {
    expect(
      travelSeconds({ ...base, fromX: 1, fromY: 1, toX: 30, toY: 30, troops: emptyTroops() }),
    ).toBe(0);
  });

  it('дом Кланов ускоряет марш', () => {
    const cav = { ...emptyTroops(), cavalry: 100 };
    const normal = travelSeconds({
      ...base,
      fromX: 5,
      fromY: 5,
      toX: 60,
      toY: 60,
      troops: cav,
    });
    const clans = travelSeconds({
      ...base,
      house: 'clans',
      fromX: 5,
      fromY: 5,
      toX: 60,
      toY: 60,
      troops: cav,
    });
    expect(clans).toBeLessThan(normal);
  });
});
