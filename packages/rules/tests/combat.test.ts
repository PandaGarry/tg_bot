import { describe, expect, it } from 'vitest';
import { resolveBattle, tacticalPower } from '../src/combat';
import { emptyTroops, troopsTotal } from '../src/types';

const attacker = { ...emptyTroops(), infantry: 300, archers: 200, cavalry: 100 };
const defender = { ...emptyTroops(), infantry: 100, archers: 50, cavalry: 20 };

describe('resolveBattle', () => {
  it('детерминирован: один seed — один исход', () => {
    const a = resolveBattle({
      attacker: { troops: attacker },
      defender: { troops: defender, wallLevel: 2 },
      seed: 'battle-1',
    });
    const b = resolveBattle({
      attacker: { troops: attacker },
      defender: { troops: defender, wallLevel: 2 },
      seed: 'battle-1',
    });
    expect(a).toEqual(b);

    const c = resolveBattle({
      attacker: { troops: attacker },
      defender: { troops: defender, wallLevel: 2 },
      seed: 'battle-2',
    });
    expect(c.attackerLosses).not.toEqual(a.attackerLosses);
  });

  it('сильная армия побеждает и теряет меньше', () => {
    const r = resolveBattle({
      attacker: { troops: attacker },
      defender: { troops: defender },
      seed: 'stomp',
    });
    expect(r.winner).toBe('attacker');
    expect(troopsTotal(r.attackerLosses)).toBeLessThan(troopsTotal(r.defenderLosses));
  });

  it('потери никогда не превышают численность', () => {
    for (let i = 0; i < 50; i++) {
      const r = resolveBattle({
        attacker: { troops: attacker },
        defender: { troops: defender, wallLevel: i % 6 },
        seed: `s${i}`,
      });
      for (const key of ['infantry', 'archers', 'cavalry'] as const) {
        expect(r.attackerLosses[key]).toBeLessThanOrEqual(attacker[key]);
        expect(r.defenderLosses[key]).toBeLessThanOrEqual(defender[key]);
        expect(r.attackerSurvivors[key] + r.attackerLosses[key]).toBe(attacker[key]);
        expect(r.defenderSurvivors[key] + r.defenderLosses[key]).toBe(defender[key]);
      }
    }
  });

  it('стена и дом Ордена усиливают защиту', () => {
    const bare = tacticalPower(defender, attacker);
    expect(bare).toBeGreaterThan(0);
    const noWall = resolveBattle({
      attacker: { troops: attacker },
      defender: { troops: defender },
      seed: 'wall-test',
    });
    const withWall = resolveBattle({
      attacker: { troops: attacker },
      defender: { troops: defender, wallLevel: 8, house: 'order' },
      seed: 'wall-test',
    });
    expect(withWall.defenderPower).toBeGreaterThan(noWall.defenderPower);
    expect(troopsTotal(withWall.attackerLosses)).toBeGreaterThan(
      troopsTotal(noWall.attackerLosses),
    );
  });

  it('контр-юниты учитываются: кавалерия сильнее против лучников', () => {
    const archers = { ...emptyTroops(), archers: 100 };
    const cavalry = { ...emptyTroops(), cavalry: 100 };
    const infantry = { ...emptyTroops(), infantry: 100 };
    expect(tacticalPower(cavalry, archers)).toBeGreaterThan(tacticalPower(cavalry, infantry));
  });

  it('пустая армия защитника — победа без потерь', () => {
    const r = resolveBattle({
      attacker: { troops: attacker },
      defender: { troops: emptyTroops() },
      seed: 'empty',
    });
    expect(r.winner).toBe('attacker');
    expect(troopsTotal(r.attackerLosses)).toBe(0);
  });
});
