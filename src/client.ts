import type { Config } from './config.js';
import type { ImplementationStateResponse, ProgressResponse } from './types.js';
import { ApiError } from './errors.js';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export class AgentBlueprintClient {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  private async request<T>(path: string, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.apiUrl}/api/v1${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: response.statusText }));
      throw new ApiError(
        response.status,
        (body as Record<string, string>).error || `Request failed: ${response.status}`
      );
    }

    const json = (await response.json()) as ApiResponse<T>;
    if (!json.success) {
      throw new ApiError(400, 'API returned unsuccessful response');
    }

    return json.data;
  }

  private async postRequest<T>(path: string, body: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.apiUrl}/api/v1${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const respBody = await response.json().catch(() => ({ error: response.statusText }));
      throw new ApiError(
        response.status,
        (respBody as Record<string, string>).error || `Request failed: ${response.status}`
      );
    }

    const json = (await response.json()) as ApiResponse<T>;
    if (!json.success) {
      throw new ApiError(400, 'API returned unsuccessful response');
    }

    return json.data;
  }

  private async patchRequest<T>(path: string, body: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.apiUrl}/api/v1${path}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }
    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const respBody = await response.json().catch(() => ({ error: response.statusText }));
      throw new ApiError(
        response.status,
        (respBody as Record<string, string>).error || `Request failed: ${response.status}`
      );
    }

    const json = (await response.json()) as ApiResponse<T>;
    if (!json.success) {
      throw new ApiError(400, 'API returned unsuccessful response');
    }

    return json.data;
  }

  private orgQuery(customerOrgId?: string): Record<string, string> | undefined {
    return customerOrgId ? { customerOrgId } : undefined;
  }

  async getIdentity(): Promise<UserIdentity> {
    return this.request<UserIdentity>('/me');
  }

  async getBusinessProfile(customerOrgId?: string): Promise<BusinessProfile> {
    return this.request<BusinessProfile>('/business-profile', this.orgQuery(customerOrgId));
  }

  async listBlueprints(customerOrgId?: string): Promise<BlueprintSummary[]> {
    return this.request<BlueprintSummary[]>('/blueprints', this.orgQuery(customerOrgId));
  }

  async getBlueprint(id: string, customerOrgId?: string): Promise<BlueprintDetail> {
    return this.request<BlueprintDetail>(`/blueprints/${encodeURIComponent(id)}`, this.orgQuery(customerOrgId));
  }

  async getBusinessCase(blueprintId: string, customerOrgId?: string): Promise<ArtifactResponse> {
    return this.request<ArtifactResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/business-case`, this.orgQuery(customerOrgId)
    );
  }

  async getImplementationPlan(blueprintId: string, customerOrgId?: string): Promise<ArtifactResponse> {
    return this.request<ArtifactResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/implementation-plan`, this.orgQuery(customerOrgId)
    );
  }

  async getUseCase(blueprintId: string, customerOrgId?: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/blueprints/${encodeURIComponent(blueprintId)}/use-case`, this.orgQuery(customerOrgId)
    );
  }

  async getImplementationSpec(blueprintId: string, customerOrgId?: string): Promise<ImplementationSpecResponse> {
    return this.request<ImplementationSpecResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/implementation-spec`, this.orgQuery(customerOrgId)
    );
  }

  async syncImplementationState(
    blueprintId: string,
    stateData: Record<string, unknown>,
    syncedBy: string,
    customerOrgId?: string,
  ): Promise<ImplementationStateSyncResponse> {
    return this.postRequest<ImplementationStateSyncResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/implementation-state`,
      { stateData, syncedBy },
      this.orgQuery(customerOrgId),
    );
  }

  async getImplementationState(
    blueprintId: string,
    customerOrgId?: string,
  ): Promise<ImplementationStateResponse | null> {
    return this.request<ImplementationStateResponse | null>(
      `/blueprints/${encodeURIComponent(blueprintId)}/implementation-state`,
      this.orgQuery(customerOrgId),
    );
  }

  async reportMetrics(
    blueprintId: string,
    metrics: ReportMetricInput[],
    reportedBy: string,
    customerOrgId?: string,
  ): Promise<ReportMetricsResponse> {
    return this.postRequest<ReportMetricsResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/metrics`,
      { metrics, reportedBy },
      this.orgQuery(customerOrgId),
    );
  }

  async getProgress(
    blueprintId: string,
    customerOrgId?: string,
  ): Promise<ProgressResponse> {
    return this.request<ProgressResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/progress`,
      this.orgQuery(customerOrgId),
    );
  }

  // ─── Registry write methods ──────────────────────────────────────

  async updateBlueprint(
    blueprintId: string,
    sections: Record<string, unknown>,
    customerOrgId?: string,
  ): Promise<ArtifactUpdateResponse> {
    return this.patchRequest<ArtifactUpdateResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}`,
      { sections },
      this.orgQuery(customerOrgId),
    );
  }

  async updateBusinessCase(
    blueprintId: string,
    sections: Record<string, unknown>,
    customerOrgId?: string,
  ): Promise<ArtifactUpdateResponse> {
    return this.patchRequest<ArtifactUpdateResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/business-case`,
      { sections },
      this.orgQuery(customerOrgId),
    );
  }

  async updateImplementationPlan(
    blueprintId: string,
    sections: Record<string, unknown>,
    customerOrgId?: string,
  ): Promise<ArtifactUpdateResponse> {
    return this.patchRequest<ArtifactUpdateResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/implementation-plan`,
      { sections },
      this.orgQuery(customerOrgId),
    );
  }

  async updateUseCase(
    blueprintId: string,
    sections: Record<string, unknown>,
    customerOrgId?: string,
  ): Promise<ArtifactUpdateResponse> {
    return this.patchRequest<ArtifactUpdateResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/use-case`,
      { sections },
      this.orgQuery(customerOrgId),
    );
  }

  async updateBusinessProfile(
    fields: Record<string, unknown>,
    customerOrgId?: string,
  ): Promise<ArtifactUpdateResponse> {
    return this.patchRequest<ArtifactUpdateResponse>(
      '/business-profile',
      { fields },
      this.orgQuery(customerOrgId),
    );
  }

  async recalculateFinancials(
    blueprintId: string,
    customerOrgId?: string,
  ): Promise<Record<string, unknown>> {
    return this.postRequest<Record<string, unknown>>(
      `/blueprints/${encodeURIComponent(blueprintId)}/business-case/recalculate`,
      {},
      this.orgQuery(customerOrgId),
    );
  }

  async getVendorGuide(platform: string): Promise<VendorGuideResponse | null> {
    try {
      const url = new URL(`${this.config.apiUrl}/api/vendor-guide/${encodeURIComponent(platform)}`);
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) return null;

      return (await response.json()) as VendorGuideResponse;
    } catch {
      return null;
    }
  }

  async getVendorSkill(platform: string): Promise<VendorSkillResponse | null> {
    try {
      const url = new URL(`${this.config.apiUrl}/api/vendor-skill/${encodeURIComponent(platform)}`);
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as VendorSkillResponse;

      // Backward compat: if API returns old format (just content, no files),
      // wrap content into a single-file array
      if (!data.files || data.files.length === 0) {
        data.files = [{ path: 'SKILL.md', content: data.content }];
      }

      return data;
    } catch {
      return null;
    }
  }

  async getBaseSkill(): Promise<BaseSkillResponse | null> {
    try {
      const url = new URL(`${this.config.apiUrl}/api/base-skill`);
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) return null;

      return (await response.json()) as BaseSkillResponse;
    } catch {
      return null;
    }
  }
}

// ─── Response types ────────────────────────────────────────────────

export interface UserIdentity {
  email: string | null;
  organizationId: string;
  organizationName: string | null;
  organizationSlug: string | null;
  isPartnerMember: boolean;
  partnerId: string | null;
}

export interface BlueprintSummary {
  id: string;
  title: string;
  version: number;
  platform: string;
  agentCount: number;
  lifecycleStatus: string;
  useCaseId: string | null;
  staleSince: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintDetail {
  id: string;
  version: number;
  lifecycleStatus: string;
  useCaseId: string | null;
  staleSince: string | null;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
}

export interface ArtifactResponse {
  id: string;
  version: number;
  blueprintId: string;
  staleSince: string | null;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
}

export interface ImplementationSpecResponse {
  blueprintId: string;
  filename: string;
  metadata: {
    agentCount: number;
    platform: string;
    hasBusinessCase: boolean;
    hasImplementationPlan: boolean;
    hasUseCase: boolean;
    hasBusinessProfile: boolean;
    referenceFileCount: number;
    totalFileCount: number;
  };
}

export interface VendorGuideResponse {
  platform: string;
  title: string;
  content: string;
  lastVerified: string;
}

export interface SkillFile {
  path: string;
  content: string;
}

export interface VendorSkillResponse {
  platform: string;
  skillName: string;
  content: string;
  files?: SkillFile[];
  lastVerified: string;
}

export interface BaseSkillResponse {
  files: SkillFile[];
}

export interface ImplementationStateSyncResponse {
  state: {
    id: string;
    blueprintId: string;
    organizationId: string;
    stateData: Record<string, unknown>;
    schemaVersion: string;
    syncedAt: string;
    syncedBy: string | null;
    previousStateId: string | null;
  };
  diff: {
    isFirstSync: boolean;
    overallStatusChange: {
      from: string | null;
      to: string;
    } | null;
    agentChanges: Array<{
      name: string;
      statusChange: { from: string | null; to: string } | null;
      isNew: boolean;
      isRemoved: boolean;
    }>;
  };
  warnings: string[];
}

// Re-exported from types.ts for backward compat
export type { ImplementationStateResponse } from './types.js';

export interface BusinessProfile {
  id: string;
  organizationId: string;
  companyName: string;
  industry: string | null;
  size: string | null;
  revenue: string | null;
  currency: string;
  description: string | null;
  companyWebsite: string | null;
  strategicInitiatives: unknown[];
  technologyProfile: Record<string, unknown> | null;
  organizationalCapabilities: Record<string, unknown> | null;
  businessOperations: Record<string, unknown> | null;
  constraintsProfile: Record<string, unknown> | null;
  aiReadinessScore: number | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Performance metrics types ────────────────────────────────────

export interface ReportMetricInput {
  metricName: string;
  actualValue: string;
  metricType?: 'operational' | 'financial';
  metricUnit?: string;
  baselineValue?: string;
  notes?: string;
  measuredAt?: string;
}

export interface MetricResult {
  metricName: string;
  metricId?: string;
  predictedValue?: string;
  actualValue: string;
  deviationPercent?: number;
  status?: string;
  warnings: string[];
  error?: string;
}

export interface ReportMetricsResponse {
  results: MetricResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
    warnings: number;
  };
}

// Re-exported from types.ts for backward compat
export type { ProgressResponse } from './types.js';

// ─── Registry update types ───────────────────────────────────────

export interface ArtifactUpdateResponse {
  id: string;
  version?: number;
  updatedAt: string;
  staleSince: string | null;
  versionSnapshot?: number | null;
  downstreamStale: string[];
  message?: string;
}
