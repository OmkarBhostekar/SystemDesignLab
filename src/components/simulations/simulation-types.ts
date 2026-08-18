import type { ProgressRepository, SimulationCompletion } from "@/domain/progress";

/**
 * The shell only needs the completion read/write boundary. Keeping this as a
 * Pick makes the client contract explicit while allowing any full progress
 * repository (IndexedDB, memory, or a test double) to be injected.
 */
export type SimulationRepository = Pick<
  ProgressRepository,
  "getSimulationCompletion" | "saveSimulationCompletion"
>;

export type SimulationCompletionFactory = (
  simulationId: string,
  lessonId: string,
  scenarioId: string,
) => SimulationCompletion;
