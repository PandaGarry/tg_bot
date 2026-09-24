/**
 * Мгновенное разрешение боя (модель GoT: Conquest): армия дошла — бой посчитан сразу,
 * без пошагового реалтайма. Формула детерминирована: один и тот же seed даёт один исход
 * и на сервере, и в тестах, и при «предпросмотре» на клиенте.
 */
import { COUNTER_BONUS, UNITS } from './constants';
import { rngFromParts } from './rng';
import { armyPower, houseDefenseBonus } from './economy';
import {
  UNIT_KEYS,
  emptyTroops,
  troopsTotal,
  type HouseKey,
  type Troops,
  type UnitKey,
} from './types';

export interface BattleSide {
  troops: Troops;
  /** Уровень стены (олько у защитника) — гасит первый удар. */
  wallLevel?: number;
  house?: HouseKey;
}

export interface BattleResult {
  winner: 'attacker' | 'defender';
  attackerPower: number;
  defenderPower: number;
  attackerLosses: Troops;
  defenderLosses: Troops;
  attackerSurvivors: Troops;
  defenderSurvivors: Troops;
  /** Жар, полученный победителем за убитых врагов (только на карте KvK). */
  emberFromKills: number;
}

/** Сила стороны с учётом контр-юнитов: доля «удобных» целей усиливает атаку. */
export function tacticalPower(troops: Troops, enemy: Troops): number {
  const enemyTotal = Math.max(1, troopsTotal(enemy));
  let power = 0;
  for (const key of UNIT_KEYS) {
    const count = troops[key];
    if (count <= 0) continue;
    const share = (enemy[UNITS[key].counters] ?? 0) / enemyTotal;
    power += count * UNITS[key].attack * (1 + (COUNTER_BONUS - 1) * share);
  }
  return power;
}

function wallMultiplier(wallLevel: number, house: HouseKey): number {
  return 1 + 0.07 * Math.max(0, wallLevel) + houseDefenseBonus(house);
}

function applyLosses(troops: Troops, fraction: number): { losses: Troops; survivors: Troops } {
  const f = Math.min(1, Math.max(0, fraction));
  const losses = emptyTroops();
  const survivors = emptyTroops();
  const total = troopsTotal(troops);
  if (total <= 0) return { losses, survivors };
  let targetLoss = Math.round(total * f);
  // сначала снимаем «целые» доли пропорционально, остаток — крупнейшим отрядам
  const raw: { key: UnitKey; amount: number }[] = [];
  for (const key of UNIT_KEYS) {
    const amount = troops[key] * f;
    raw.push({ key, amount });
  }
  let assigned = 0;
  for (const item of raw) {
    const base = Math.floor(item.amount);
    losses[item.key] = Math.min(troops[item.key], base);
    assigned += losses[item.key];
  }
  const rest = targetLoss - assigned;
  if (rest > 0) {
    const byRemainder = [...raw]
      .filter((r) => troops[r.key] - losses[r.key] > 0)
      .sort((a, b) => (b.amount % 1) - (a.amount % 1));
    for (let i = 0; i < rest; i++) {
      const item = byRemainder[i % byRemainder.length];
      if (!item) break;
      losses[item.key] += 1;
    }
  }
  for (const key of UNIT_KEYS) survivors[key] = Math.max(0, troops[key] - losses[key]);
  return { losses, survivors };
}

export interface BattleOptions {
  attacker: BattleSide;
  defender: BattleSide;
  /** seed детерминирует разброс удачи: один бой = один исход при пересчёте. */
  seed: string;
  /**
   * Сколько Жара даёт единица мощи убитых врагов (0 — бой вне KvK).
   * PvE и PvP намеренно оцениваются по-разному: фарм мародёров не должен
   * перекрывать доход с колодцев и ценность чужой армии.
   */
  emberPerKilledPower?: number;
}

export function resolveBattle(opts: BattleOptions): BattleResult {
  const rng = rngFromParts(opts.seed);
  const attackerTroops = opts.attacker.troops;
  const defenderTroops = opts.defender.troops;

  const attackerTotal = troopsTotal(attackerTroops);
  const defenderTotal = troopsTotal(defenderTroops);

  if (attackerTotal <= 0) {
    return {
      winner: 'defender',
      attackerPower: 0,
      defenderPower: tacticalPower(defenderTroops, attackerTroops),
      attackerLosses: emptyTroops(),
      defenderLosses: emptyTroops(),
      attackerSurvivors: { ...attackerTroops },
      defenderSurvivors: { ...defenderTroops },
      emberFromKills: 0,
    };
  }
  if (defenderTotal <= 0) {
    return {
      winner: 'attacker',
      attackerPower: tacticalPower(attackerTroops, defenderTroops),
      defenderPower: 0,
      attackerLosses: emptyTroops(),
      defenderLosses: emptyTroops(),
      attackerSurvivors: { ...attackerTroops },
      defenderSurvivors: emptyTroops(),
      emberFromKills: 0,
    };
  }

  const luckA = 0.9 + 0.2 * rng();
  const luckD = 0.9 + 0.2 * rng();

  const attackerPower =
    tacticalPower(attackerTroops, defenderTroops) * luckA * (1 + 0.02 * (rng() - 0.5));
  const defenderPower =
    tacticalPower(defenderTroops, attackerTroops) *
    luckD *
    wallMultiplier(opts.defender.wallLevel ?? 0, opts.defender.house ?? 'order');

  const ratio = attackerPower / Math.max(1, defenderPower);
  let attackerLossFraction: number;
  let defenderLossFraction: number;

  if (ratio >= 1) {
    defenderLossFraction = Math.min(0.96, 0.6 + 0.32 * (1 - 1 / ratio));
    attackerLossFraction = Math.min(0.7, 0.34 * Math.pow(1 / ratio, 1.4));
  } else {
    attackerLossFraction = Math.min(0.96, 0.6 + 0.32 * (1 - ratio));
    defenderLossFraction = Math.min(0.7, 0.34 * Math.pow(ratio, 1.4));
  }

  const att = applyLosses(attackerTroops, attackerLossFraction);
  const def = applyLosses(defenderTroops, defenderLossFraction);

  const winner: 'attacker' | 'defender' = ratio >= 1 ? 'attacker' : 'defender';
  const killedPower =
    winner === 'attacker'
      ? armyPower(def.losses)
      : armyPower(att.losses) + armyPower(def.losses);

  return {
    winner,
    attackerPower: Math.round(attackerPower),
    defenderPower: Math.round(defenderPower),
    attackerLosses: att.losses,
    defenderLosses: def.losses,
    attackerSurvivors: att.survivors,
    defenderSurvivors: def.survivors,
    emberFromKills: Math.round(killedPower * (opts.emberPerKilledPower ?? 0)),
  };
}

/** Оценка исхода без удачи — для подсказки «шанс победы» в UI. */
export function estimateOdds(attacker: BattleSide, defender: BattleSide): number {
  const a = tacticalPower(attacker.troops, defender.troops);
  const d =
    tacticalPower(defender.troops, attacker.troops) *
    wallMultiplier(defender.wallLevel ?? 0, defender.house ?? 'order');
  if (a + d <= 0) return 0.5;
  return Math.round((a / (a + d)) * 100) / 100;
}
