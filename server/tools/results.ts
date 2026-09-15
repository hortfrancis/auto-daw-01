import { CommandError } from '../errors.ts';

export function text(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}

/** Runs a command, turning a CommandError into a tool error the agent can act on. */
export async function run(command: () => string | Promise<string>) {
  try {
    return text(await command());
  } catch (err) {
    if (err instanceof CommandError) return { ...text(err.message), isError: true };
    throw err;
  }
}
