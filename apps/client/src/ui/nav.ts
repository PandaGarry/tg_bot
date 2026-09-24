import type { MarchKind, Troops } from '@ashfall/shared';
import type { TabName } from '../store';

/** Точка обмена между панелями и экраном, чтобы модули не импортировали друг друга по кругу. */
export const nav: {
  openTab: (tab: TabName | null) => void;
  closeSheet: () => void;
  refresh: () => void;
  sendMarch: (kind: MarchKind, targetId: string, troops: Troops) => Promise<void>;
} = {
  openTab: () => {},
  closeSheet: () => {},
  refresh: () => {},
  sendMarch: async () => {},
};
