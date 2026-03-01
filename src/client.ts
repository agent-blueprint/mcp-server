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

  private async request<T>(path: string): Promise<T> {
    const url = `${this.config.apiUrl}/api/v1${path}`;
    const response = await fetch(url, {
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

  async listBlueprints(): Promise<BlueprintSummary[]> {
    return this.request<BlueprintSummary[]>('/blueprints');
  }

  async getBlueprint(id: string): Promise<BlueprintDetail> {
    return this.request<BlueprintDetail>(`/blueprints/${encodeURIComponent(id)}`);
  }

  async getBusinessCase(blueprintId: string): Promise<ArtifactResponse> {
    return this.request<ArtifactResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/business-case`
    );
  }

  async getImplementationPlan(blueprintId: string): Promise<ArtifactResponse> {
    return this.request<ArtifactResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/implementation-plan`
    );
  }

  async getUseCase(blueprintId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/blueprints/${encodeURIComponent(blueprintId)}/use-case`
    );
  }

  async getImplementationSpec(blueprintId: string): Promise<ImplementationSpecResponse> {
    return this.request<ImplementationSpecResponse>(
      `/blueprints/${encodeURIComponent(blueprintId)}/implementation-spec`
    );
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
    referenceFileCount: number;
    totalFileCount: number;
  };
}
