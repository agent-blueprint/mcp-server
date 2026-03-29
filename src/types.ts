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

export interface StrategicRecommendationsResponse {
  id: string;
  blueprintId: string;
  generatedAt: string;
  recommendations: {
    generatedAt: string;
    blueprintId: string;
    summary: string;
    recommendations: Array<{
      id: string;
      priority: string;
      category: string;
      title: string;
      what: string;
      why: string;
      expectedImpact: string;
      confidence: string;
      financialImpact?: { type: string; estimatedValue?: string; basis: string };
      relatedAgents?: string[];
      relatedMetrics?: string[];
    }>;
    contextSnapshot: {
      implementationProgress: string;
      performanceStatus: string;
      daysInImplementation: number;
    };
  };
}
