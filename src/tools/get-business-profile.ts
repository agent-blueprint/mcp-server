import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export async function handleGetBusinessProfile(client: AgentBlueprintClient) {
  try {
    const profile = await client.getBusinessProfile();
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(profile, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [{ type: 'text' as const, text: formatError(err) }],
      isError: true,
    };
  }
}
