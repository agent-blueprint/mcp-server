import type { Config } from './config.js';
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

  private orgQuery(customerOrgId?: string): Record<string, string> | undefined {
    return customerOrgId ? { customerOrgId } : undefined;
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
}

// ─── Response types ────────────────────────────────────────────────

export interface BlueprintSummary {
  id: string;
  title: string;
  version: number;
  platform: string;
  agentCount: number;
  lifecycleStatus: string;
  useCaseId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlueprintDetail {
  id: string;
  version: number;
  lifecycleStatus: string;
  useCaseId: string | null;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
}

export interface ArtifactResponse {
  id: string;
  version: number;
  blueprintId: string;
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
