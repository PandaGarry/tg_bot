/**
 * Журнал. Один файл на всё не используется: каналы разделены,
 * запись — структурированный объект, не абзац.
 * Пароль, сессия и строка подключения в журнал не попадают.
 */

import type { JsonValue } from "@tdl/kernel";

export const JOURNAL_CHANNELS = ["audit", "sim", "security", "access", "app"] as const;
export type JournalChannel = (typeof JOURNAL_CHANNELS)[number];

export interface JournalRecord {
  ts: string;
  channel: JournalChannel;
  worldId?: string;
  requestId?: string;
  moduleId?: string;
  actorId?: string;
  event: string;
  entity?: string;
  detail?: JsonValue;
}

export type JournalSink = (record: JournalRecord) => void;

/** На тесте приёмник — stdout процесса, по каналу в поле channel. */
export const stdoutSink: JournalSink = (record) => {
  process.stdout.write(`${JSON.stringify(record)}\n`);
};

export interface Journal {
  write(record: Omit<JournalRecord, "ts"> & { ts?: string }): void;
  child(base: Partial<JournalRecord>): Journal;
}

export function createJournal(sink: JournalSink = stdoutSink): Journal {
  const write: Journal["write"] = (record) => {
    sink({ ts: new Date().toISOString(), ...record } as JournalRecord);
  };
  return {
    write,
    child: (base) => createJournal((record) => sink({ ...base, ...record })),
  };
}
