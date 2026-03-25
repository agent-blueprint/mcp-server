// =============================================================================
// Shared types used by both renderers and client.
// Extracted so that importing renderers doesn't pull in client.ts dependencies.
// =============================================================================

export interface ImplementationStateResponse {
  id: string;
  blueprintId: string;
  organizationId: string;
  stateData: Record<string, unknown>;
  schemaVersion: string;
  syncedAt: string;
  syncedBy: string | null;
  previousStateId: string | null;
}

export interface ProgressResponse {
  blueprintId: string;
  blueprintTitle: string;
  targets: {
    operational: Array<{ name: string; target: string; unit?: string; direction?: string }>;
    financial: Array<{ name: string; value: string; unit?: string; direction?: string }>;
  };
  actuals: Array<{
    id: string;
    metricName: string;
    metricType: string;
    predictedValue: string;
    actualValue: string;
    baselineValue?: string;
    deviationPercent?: number;
    status: string;
    recordedAt: string;
    dataSource: string;
    notes?: string;
    recordingCount: number;
  }>;
  summary: {
    totalTargets: number;
    metricsRecorded: number;
    onTrack: number;
    minorDeviation: number;
    majorDeviation: number;
  };
  implementationState?: {
    overallStatus: string;
    agentCount: number;
    implementedCount: number;
    lastSyncedAt: string;
  } | null;
}
