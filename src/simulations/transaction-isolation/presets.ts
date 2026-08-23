import type {
  TransactionIsolationPresetDefinition,
  TransactionIsolationPresetId,
} from "./types";

const row = (
  id: string,
  label: string,
  value: string | number | boolean | null,
  tags: string[] = [],
) => ({ id, label, value, version: 1, tags });

const readRow = (id: string, target: string, description: string) => ({
  id,
  kind: "read" as const,
  target,
  readKind: "row" as const,
  description,
});

const readPredicate = (id: string, predicate: string, description: string) => ({
  id,
  kind: "read" as const,
  target: predicate,
  readKind: "predicate" as const,
  predicate,
  description,
});

const write = (
  id: string,
  target: string,
  value: string | number | boolean | null,
  description: string,
  options: {
    writeMode?: "update" | "insert" | "delete";
    tags?: string[];
    guard?: string;
  } = {},
) => ({
  id,
  kind: "write" as const,
  target,
  value,
  writeMode: options.writeMode ?? "update",
  tags: options.tags,
  guard: options.guard,
  description,
});

const commit = (id: string) => ({
  id,
  kind: "commit" as const,
  description: "Commit the transaction and publish its versions.",
});

const abort = (id: string, description: string) => ({
  id,
  kind: "abort" as const,
  description,
});

/**
 * Authored schedules are intentionally short. The engine may skip a blocked
 * schedule slot and revisit that transaction later, so locks do not make the
 * visualizer deadlock merely because a learner selected a stronger primitive.
 */
export const TRANSACTION_ISOLATION_PRESETS = [
  {
    id: "dirty-read",
    label: "Dirty read",
    description: "T2 observes T1's uncommitted balance, then T1 rolls it back.",
    defaultIsolation: "read-uncommitted",
    defaultProtection: "none",
    rows: [row("account-balance", "Account balance", 100, ["balance"])],
    transactions: [
      {
        id: "T1" as const,
        label: "Writer / rollback",
        operations: [
          write("t1-write-balance", "account-balance", 0, "Set balance to 0, but do not commit yet."),
          abort("t1-abort", "Roll back the uncommitted balance."),
        ],
      },
      {
        id: "T2" as const,
        label: "Reader",
        operations: [
          readRow("t2-read-balance", "account-balance", "Read the balance while T1 is still active."),
          commit("t2-commit"),
        ],
      },
    ],
    schedule: ["T1", "T2", "T1", "T2", "T1", "T2"],
    invariant: {
      id: "committed-only-observation",
      name: "Reads observe committed state",
    },
  },
  {
    id: "non-repeatable-read",
    label: "Non-repeatable read",
    description: "T1 reads a balance twice while T2 commits a change between statements.",
    defaultIsolation: "read-committed",
    defaultProtection: "none",
    rows: [row("account-balance", "Account balance", 100, ["balance"])],
    transactions: [
      {
        id: "T1" as const,
        label: "Two statements",
        operations: [
          readRow("t1-read-balance-1", "account-balance", "Read the balance for the first statement."),
          readRow("t1-read-balance-2", "account-balance", "Read the same row again."),
          commit("t1-commit"),
        ],
      },
      {
        id: "T2" as const,
        label: "Updater",
        operations: [
          write("t2-write-balance", "account-balance", 120, "Credit the account."),
          commit("t2-commit"),
        ],
      },
    ],
    schedule: ["T1", "T2", "T2", "T1", "T1", "T2", "T1"],
    invariant: {
      id: "stable-row-observation",
      name: "A repeated row read stays stable",
    },
  },
  {
    id: "phantom-insert",
    label: "Phantom range insert",
    description: "T2 inserts a matching reservation between T1's predicate reads.",
    defaultIsolation: "read-committed",
    defaultProtection: "none",
    rows: [row("day-reservation", "Day reservation", "held", ["day", "reservation"])],
    transactions: [
      {
        id: "T1" as const,
        label: "Range checker",
        operations: [
          readPredicate("t1-read-night-1", "night-reservations", "Count reservations for the night show."),
          readPredicate("t1-read-night-2", "night-reservations", "Repeat the same range query."),
          commit("t1-commit"),
        ],
      },
      {
        id: "T2" as const,
        label: "Inserter",
        operations: [
          write(
            "t2-insert-night",
            "night-reservation-1",
            "reserved",
            "Insert a reservation matching T1's predicate.",
            { writeMode: "insert", tags: ["night", "reservation"] },
          ),
          commit("t2-commit"),
        ],
      },
    ],
    schedule: ["T1", "T2", "T2", "T1", "T1", "T2", "T1"],
    invariant: {
      id: "stable-range-observation",
      name: "A repeated predicate returns the same set",
    },
  },
  {
    id: "doctor-write-skew",
    label: "Doctor write skew",
    description: "Both doctors see coverage, then each removes a different doctor from the night shift.",
    defaultIsolation: "repeatable-read",
    defaultProtection: "none",
    rows: [
      row("doctor-a", "Doctor A on call", true, ["night", "doctor", "on-call"]),
      row("doctor-b", "Doctor B on call", true, ["night", "doctor", "on-call"]),
    ],
    transactions: [
      {
        id: "T1" as const,
        label: "Doctor A off call",
        operations: [
          readPredicate("t1-read-on-call", "night-on-call", "Count doctors covering the night shift."),
          write("t1-off-call-a", "doctor-a", false, "Take Doctor A off call.", { guard: "doctor-coverage" }),
          commit("t1-commit"),
        ],
      },
      {
        id: "T2" as const,
        label: "Doctor B off call",
        operations: [
          readPredicate("t2-read-on-call", "night-on-call", "Count doctors covering the night shift."),
          write("t2-off-call-b", "doctor-b", false, "Take Doctor B off call.", { guard: "doctor-coverage" }),
          commit("t2-commit"),
        ],
      },
    ],
    schedule: ["T1", "T2", "T1", "T2", "T1", "T2", "T1", "T2", "T1", "T2"],
    invariant: {
      id: "doctor-coverage",
      name: "At least one doctor remains on call",
    },
  },
  {
    id: "seat-uniqueness",
    label: "Seat uniqueness race",
    description: "Two buyers observe an empty seat and race to reserve the same key.",
    defaultIsolation: "read-committed",
    defaultProtection: "none",
    rows: [],
    transactions: [
      {
        id: "T1" as const,
        label: "Buyer A",
        operations: [
          readPredicate("t1-read-seat", "seat-42-free", "Check whether seat 42 has no reservation."),
          write("t1-reserve-seat", "seat-42", "buyer-a", "Insert the reservation for seat 42.", {
            writeMode: "insert",
            tags: ["show-1", "seat-42", "reservation"],
            guard: "seat-free",
          }),
          commit("t1-commit"),
        ],
      },
      {
        id: "T2" as const,
        label: "Buyer B",
        operations: [
          readPredicate("t2-read-seat", "seat-42-free", "Check whether seat 42 has no reservation."),
          write("t2-reserve-seat", "seat-42", "buyer-b", "Insert the reservation for seat 42.", {
            writeMode: "insert",
            tags: ["show-1", "seat-42", "reservation"],
            guard: "seat-free",
          }),
          commit("t2-commit"),
        ],
      },
    ],
    schedule: ["T1", "T2", "T1", "T2", "T1", "T2", "T1", "T2", "T1", "T2"],
    invariant: {
      id: "seat-uniqueness",
      name: "A seat has at most one committed reservation",
    },
  },
] as const satisfies readonly TransactionIsolationPresetDefinition[];

export const TRANSACTION_ISOLATION_PRESET_BY_ID: ReadonlyMap<
  TransactionIsolationPresetId,
  TransactionIsolationPresetDefinition
> = new Map(TRANSACTION_ISOLATION_PRESETS.map((preset) => [preset.id, preset]));

export function getTransactionIsolationPreset(
  presetId: TransactionIsolationPresetId,
): TransactionIsolationPresetDefinition {
  const preset = TRANSACTION_ISOLATION_PRESET_BY_ID.get(presetId);
  if (!preset) throw new Error(`Unknown transaction-isolation preset: ${String(presetId)}.`);
  return {
    ...preset,
    rows: preset.rows.map((sourceRow) => ({ ...sourceRow, tags: [...sourceRow.tags] })),
    transactions: preset.transactions.map((transaction) => ({
      ...transaction,
      operations: transaction.operations.map((operation) => ({
        ...operation,
        tags: operation.tags ? [...operation.tags] : undefined,
      })),
    })),
    schedule: [...preset.schedule],
    invariant: { ...preset.invariant },
  };
}
