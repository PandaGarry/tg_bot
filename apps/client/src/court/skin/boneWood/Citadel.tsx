import type { CitadelProps } from "../types.js";
import { Construction, type ConstructionSite } from "./citadel/Construction.js";
import { STAGES } from "./citadel/stages.js";
import { citadelStage } from "./citadelStage.js";

export { CITADEL_TIERS, citadelStage } from "./citadelStage.js";

/** Где на каждой стадии бьёт молот и на какой высоте висит таймер (над флагом и крышей). */
const SITES: readonly ConstructionSite[] = [
  { wallX: 1.37, z: 0.9, labelY: 3.9 },
  { wallX: 1.2, z: 0.85, labelY: 4.5 },
  { wallX: 1.35, z: 1.15, labelY: 5.4 },
  { wallX: 1.45, z: 1.2, labelY: 6.4 },
  { wallX: 1.45, z: 0.78, labelY: 7.9 },
];

/** Цитадель: центр двора, пятно 3×3 клетки, вход на +x. Растёт материалом и высотой, а не площадью. */
export function Citadel({ level, banner, upgrade }: CitadelProps) {
  const stage = citadelStage(level);
  const Stage = STAGES[stage - 1]!;
  return (
    <>
      <Stage banner={banner} />
      {upgrade ? <Construction upgrade={upgrade} site={SITES[stage - 1]!} /> : null}
    </>
  );
}
