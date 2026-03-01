import type { AgentBlueprintClient } from '../client.js';
import { formatError } from '../errors.js';

export const blueprintListResource = {
  uri: 'agentblueprint://blueprints',
  name: 'Blueprint List',
  description: 'List of all blueprints in the organization',
  mimeType: 'application/json',
};

export async function readBlueprintList(client: AgentBlueprintClient) {
  try {
    const blueprints = await client.listBlueprints();
    return {
      contents: [
        {
          uri: blueprintListResource.uri,
          mimeType: 'application/json',
          text: JSON.stringify(blueprints, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      contents: [
        {
          uri: blueprintListResource.uri,
          mimeType: 'text/plain',
          text: `Error: ${formatError(err)}`,
        },
      ],
    };
  }
}
