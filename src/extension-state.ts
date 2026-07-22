export interface ExtensionJobState { jobId: string; origin: string; attempts: number }

export function restoreJobState(details: unknown): ExtensionJobState | undefined {
  if (!details || typeof details !== 'object') return undefined;
  const state = details as Partial<ExtensionJobState>;
  if (typeof state.jobId !== 'string' || typeof state.origin !== 'string' || typeof state.attempts !== 'number') return undefined;
  return state as ExtensionJobState;
}

export function canAttemptRepair(state: ExtensionJobState): boolean { return state.attempts < 3; }
