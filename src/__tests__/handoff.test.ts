import { afterEach, describe, expect, it, vi } from 'vitest';

import { acceptHandoffToken, parseHandoffArgs } from '../handoff.js';

describe('parseHandoffArgs', () => {
  it('parses token, api url, and directory', () => {
    const result = parseHandoffArgs([
      '--token', 'ab_handoff_123',
      '--api-url', 'http://localhost:3000',
      '--dir', '/tmp/agent-blueprint',
    ]);

    expect(result).toEqual({
      token: 'ab_handoff_123',
      apiUrl: 'http://localhost:3000',
      dir: '/tmp/agent-blueprint',
    });
  });

  it('defaults directory to .agent-blueprint', () => {
    const result = parseHandoffArgs(['--token', 'ab_handoff_123']);
    expect(result.dir).toBe('.agent-blueprint');
  });
});

describe('acceptHandoffToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the handoff token to the accept endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          apiToken: 'ab_live_123',
          apiUrl: 'http://localhost:3000',
          organizationId: 'org-1',
          customerOrgId: 'cust-1',
          blueprintId: 'bp-1',
          platform: 'general',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await acceptHandoffToken('http://localhost:3000', 'ab_handoff_123');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/handoffs/accept',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'ab_handoff_123' }),
      }),
    );
    expect(result.apiToken).toBe('ab_live_123');
    expect(result.blueprintId).toBe('bp-1');
  });

  it('throws API error messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 410,
      json: async () => ({ error: 'Handoff token has already been accepted' }),
    }));

    await expect(
      acceptHandoffToken('http://localhost:3000', 'ab_handoff_123'),
    ).rejects.toThrow('Handoff token has already been accepted');
  });
});
