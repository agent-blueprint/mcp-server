export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly apiCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function formatError(err: unknown): string {
  if (err instanceof ApiError) {
    if (
      err.statusCode === 403
      && (err.apiCode === 'FREE_TIER_FEATURE_BLOCKED'
        || err.apiCode === 'TRIAL_FEATURE_BLOCKED'
        || /approved partner|upgraded account|unlock this feature|contact support/i.test(err.message))
    ) {
      return `Approval required (403): ${err.message}`;
    }
    if (err.statusCode === 429) {
      return `Rate limit exceeded (429): ${err.message} Wait and retry later.`;
    }
    return `API error (${err.statusCode}): ${err.message}`;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}
