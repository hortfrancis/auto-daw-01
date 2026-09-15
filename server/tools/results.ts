import { CommandError } from '../errors.ts';

export type ToolContent = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };

export function text(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}

/**
 * Runs a command, turning a CommandError into a tool error the agent can act
 * on. Commands return plain text, or a list of content blocks (e.g. text and an image).
 */
export async function run(command: () => string | ToolContent[] | Promise<string | ToolContent[]>) {
  try {
    const result = await command();
    return typeof result === 'string' ? text(result) : { content: result };
  } catch (err) {
    if (err instanceof CommandError) return { ...text(err.message), isError: true };
    throw err;
  }
}
