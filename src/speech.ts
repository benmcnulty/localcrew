import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";

export type WarnFn = (message: string) => void;

export interface ChildProcessLike {
  on?(event: "error", listener: (error: Error) => void): void;
  on?(event: "exit", listener: (code: number | null) => void): void;
  unref?(): void;
}

export type SpawnFn = (
  command: string,
  args?: readonly string[],
  options?: SpawnOptions
) => ChildProcessLike;

export function speakText(
  text: string,
  options: {
    enabled?: boolean;
    voice?: string;
    spawnFn?: SpawnFn;
    warn?: WarnFn;
  } = {}
): void {
  const trimmedText = text.trim();

  if (!trimmedText || options.enabled === false) {
    return;
  }

  const warn = options.warn ?? (() => {});
  const spawnFn = options.spawnFn ?? spawn;
  const args = options.voice ? ["-v", options.voice, trimmedText] : [trimmedText];

  try {
    const child = spawnFn("say", args, {
      detached: true,
      stdio: "ignore"
    });

    child.on?.("error", (error) => {
      warn(`Speech failed: ${error.message}`);
    });
    child.on?.("exit", (code) => {
      if (code && code !== 0) {
        warn(
          options.voice
            ? `Speech failed for voice "${options.voice}".`
            : "Speech failed."
        );
      }
    });
    child.unref?.();
  } catch (error) {
    warn(`Speech failed: ${(error as Error).message}`);
  }
}
