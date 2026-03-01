import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export const businessProfileResource = {
  uri: 'agentblueprint://business-profile',
  name: 'Business Profile',
  description: 'The organization business profile including company details, strategic initiatives, technology profile, and AI readiness score',
  mimeType: 'application/json',
};

export async function readBusinessProfile(client: AgentBlueprintClient) {
  try {
    const profile = await client.getBusinessProfile();
    return {
      contents: [
        {
          uri: businessProfileResource.uri,
          mimeType: 'application/json',
          text: JSON.stringify(profile, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      contents: [
        {
          uri: businessProfileResource.uri,
          mimeType: 'text/plain',
          text: `Error: ${formatError(err)}`,
        },
      ],
    };
  }
}
