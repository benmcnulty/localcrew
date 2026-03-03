import { createInterface } from "node:readline/promises";
import { stdin, stdout, stderr } from "node:process";
import { pathToFileURL } from "node:url";

import { startApiServer } from "./api-server.ts";
import { LocalCrewApp, type CommandResult } from "./app.ts";
import {
  CommandParseError,
  formatDirectedMessageInput,
  parseCommand
} from "./commands.ts";
import {
  buildCompleter,
  buildStyledPrompt,
  clickableUrl,
  dim,
  errorText,
  heading,
  renderBanner,
  renderStatusBar,
  successText,
} from "./terminal.ts";

function writeLine(stream: { write(chunk: string): boolean }, line: string): void {
  stream.write(`${line}\n`);
}

/**
 * Save the readline input buffer (text + cursor position), clear the current
 * terminal line, run a callback that prints arbitrary output, then redraw the
 * prompt and restore the buffered text with the cursor at its original column.
 *
 * This prevents background writes (auto‑pulse results, warnings, etc.) from
 * visually clobbering whatever the user is currently typing.
 */
function withReadlineRedraw(
  readline: ReturnType<typeof createInterface>,
  getPromptString: () => string,
  fn: () => void
): void {
  const rlAny = readline as unknown as { line?: string; cursor?: number };
  const bufferedLine = rlAny.line ?? "";
  const cursorPos = rlAny.cursor ?? bufferedLine.length;

  // Erase the current prompt + user input line.
  stdout.write("\r\u001b[2K");

  fn();

  // Redraw prompt + buffered text.
  const prompt = getPromptString();
  stdout.write(`${prompt}${bufferedLine}`);

  // Move cursor back from end‑of‑line to saved position within the text.
  const moveBack = bufferedLine.length - cursorPos;
  if (moveBack > 0) {
    stdout.write(`\u001b[${moveBack}D`);
  }
}

function renderBackgroundResult(
  readline: ReturnType<typeof createInterface>,
  getPromptString: () => string,
  result: CommandResult
): void {
  if (result.lines.length === 0 && result.errors.length === 0) {
    return;
  }

  withReadlineRedraw(readline, getPromptString, () => {
    result.lines.forEach((line) => writeLine(stdout, line));
    result.errors.forEach((line) => writeLine(stderr, errorText(line)));
  });
}

function clearScreen(): void {
  stdout.write("\u001b[2J\u001b[H");
}

function enterAlternateScreen(): void {
  stdout.write("\u001b[?1049h");
  stdout.write("\u001b[?25l");
}

function exitAlternateScreen(): void {
  stdout.write("\u001b[?25h");
  stdout.write("\u001b[?1049l");
}

function renderFrame(lines: string[], previousLines: string[]): void {
  stdout.write("\u001b[H");

  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index] !== previousLines[index]) {
      stdout.write(`\u001b[${index + 1};1H`);
      stdout.write("\u001b[2K");
      stdout.write(lines[index]);
    }
  }

  for (let index = lines.length; index < previousLines.length; index += 1) {
    stdout.write(`\u001b[${index + 1};1H\u001b[2K`);
  }
}

function isEscapeBuffer(buffer: Buffer): boolean {
  return buffer.length > 0 && buffer[0] === 27;
}

function isArrowLeftBuffer(buffer: Buffer): boolean {
  return buffer.toString("utf8") === "\u001b[D";
}

function isArrowRightBuffer(buffer: Buffer): boolean {
  return buffer.toString("utf8") === "\u001b[C";
}

function isEnterBuffer(buffer: Buffer): boolean {
  return buffer.includes(13) || buffer.includes(10);
}

function isBackspaceBuffer(buffer: Buffer): boolean {
  return buffer.includes(8) || buffer.includes(127);
}

function getPrintableText(buffer: Buffer): string {
  return buffer
    .toString("utf8")
    .replace(/[\u0000-\u001f\u007f]/g, "");
}

async function withRawMode<T>(
  readline: ReturnType<typeof createInterface>,
  run: () => Promise<T>
): Promise<T> {
  if (!stdin.isTTY) {
    return run();
  }

  readline.pause();
  stdin.setRawMode(true);
  stdin.resume();

  try {
    return await run();
  } finally {
    stdin.setRawMode(false);
    readline.resume();
  }
}

async function readRawBuffer(): Promise<Buffer> {
  return new Promise((resolve) => {
    stdin.once("data", (data) => {
      resolve(Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
    });
  });
}

async function readRawBufferWithTimeout(timeoutMs: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const onData = (data: string | Buffer): void => {
      clearTimeout(timer);
      stdin.off("data", onData);
      resolve(Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
    };

    const timer = setTimeout(() => {
      stdin.off("data", onData);
      resolve(null);
    }, timeoutMs);

    stdin.on("data", onData);
  });
}

async function runStatusViewer(
  app: LocalCrewApp,
  readline: ReturnType<typeof createInterface>
): Promise<void> {
  enterAlternateScreen();
  let previousLines: string[] = [];

  try {
    await withRawMode(readline, async () => {
      while (true) {
        const lines = await app.getStatusLines();
        renderFrame(lines, previousLines);
        previousLines = lines;

        const buffer = await readRawBufferWithTimeout(2000);
        if (!buffer) {
          continue;
        }
        if (isEscapeBuffer(buffer) || buffer.includes(3)) {
          return;
        }
      }
    });
  } finally {
    exitAlternateScreen();
  }
}

async function runExploreViewer(
  app: LocalCrewApp,
  readline: ReturnType<typeof createInterface>
): Promise<void> {
  enterAlternateScreen();
  try {
    await withRawMode(readline, async () => {
      let inputBuffer = "";
      let errorMessage = "";
      let cachedTree: Awaited<ReturnType<LocalCrewApp["getExploreTree"]>> | null = null;
      let treeCachedAt = 0;
      const treeCacheMs = 5000;

      const getTree = async (): Promise<Awaited<ReturnType<LocalCrewApp["getExploreTree"]>>> => {
        if (!cachedTree || Date.now() - treeCachedAt > treeCacheMs) {
          cachedTree = await app.getExploreTree();
          treeCachedAt = Date.now();
        }
        return cachedTree;
      };

      const renderPrompt = async (): Promise<void> => {
        const tree = await getTree();
        clearScreen();
        tree.lines.forEach((line) => writeLine(stdout, line));
        if (errorMessage) {
          writeLine(stdout, errorMessage);
        }
        stdout.write(`open path> ${inputBuffer}`);
      };

      const renderFile = async (path: string, content: string): Promise<void> => {
        clearScreen();
        writeLine(stdout, path);
        writeLine(stdout, "");
        content.split("\n").forEach((line) => writeLine(stdout, line));
        writeLine(stdout, "");
        writeLine(stdout, "Press Esc to return to the explorer.");

        while (true) {
          const buffer = await readRawBuffer();
          if (isEscapeBuffer(buffer) || buffer.includes(3)) {
            return;
          }
        }
      };

      while (true) {
        await renderPrompt();
        const buffer = await readRawBuffer();

        if (isEscapeBuffer(buffer) || buffer.includes(3)) {
          return;
        }

        if (isBackspaceBuffer(buffer)) {
          inputBuffer = inputBuffer.slice(0, -1);
          errorMessage = "";
          continue;
        }

        if (isEnterBuffer(buffer)) {
          const requestedPath = inputBuffer.trim();
          if (!requestedPath) {
            errorMessage = "Enter a full path inside the internal system tree, or press Esc to exit.";
            continue;
          }

          try {
            const file = await app.readExploreFile(requestedPath);
            inputBuffer = "";
            errorMessage = "";
            await renderFile(file.path, file.content);
          } catch (error) {
            errorMessage = (error as Error).message;
          }
          continue;
        }

        const printableText = getPrintableText(buffer);
        if (printableText) {
          inputBuffer += printableText;
          errorMessage = "";
        }
      }
    });
  } finally {
    exitAlternateScreen();
  }
}

async function runHudViewer(
  app: LocalCrewApp,
  readline: ReturnType<typeof createInterface>
): Promise<void> {
  enterAlternateScreen();
  let previousLines: string[] = [];

  try {
    await withRawMode(readline, async () => {
      const tabs: Array<"status" | "queue" | "metrics" | "detail"> = [
        "status",
        "queue",
        "metrics",
        "detail"
      ];
      let tabIndex = 0;
      let lastPulseAt = 0;

      while (true) {
        if (app.shouldAutoPulse() && Date.now() - lastPulseAt >= app.getAutoPulseIntervalMs()) {
          await app.runIdleCycle();
          lastPulseAt = Date.now();
        }

        const lines = await app.getHudLines(tabs[tabIndex]);
        renderFrame(lines, previousLines);
        previousLines = lines;

        const buffer = await readRawBufferWithTimeout(1000);
        if (!buffer) {
          continue;
        }

        if (buffer.includes(3) || isEscapeBuffer(buffer)) {
          return;
        }

        if (isArrowLeftBuffer(buffer)) {
          tabIndex = (tabIndex + tabs.length - 1) % tabs.length;
          previousLines = [];
          continue;
        }

        if (isArrowRightBuffer(buffer)) {
          tabIndex = (tabIndex + 1) % tabs.length;
          previousLines = [];
          continue;
        }
      }
    });
  } finally {
    exitAlternateScreen();
  }
}

async function resolveViewerRequest(
  app: LocalCrewApp,
  readline: ReturnType<typeof createInterface>,
  result: CommandResult
): Promise<void> {
  if (!result.viewerRequest) {
    return;
  }

  if (result.viewerRequest.kind === "status") {
    await runStatusViewer(app, readline);
    return;
  }

  if (result.viewerRequest.kind === "hud") {
    await runHudViewer(app, readline);
    return;
  }

  await runExploreViewer(app, readline);
}

async function promptWithPrefill(
  readline: ReturnType<typeof createInterface>,
  prompt: string,
  initialText: string
): Promise<string> {
  const answerPromise = readline.question(prompt);
  readline.write(initialText);
  return answerPromise;
}

async function resolveWorkflowPrompt(
  app: LocalCrewApp,
  readline: ReturnType<typeof createInterface>,
  result: CommandResult
): Promise<CommandResult> {
  if (!result.workflowRequest) {
    return result;
  }

  if (result.workflowRequest.kind !== "agent.create") {
    return result;
  }

  result.workflowRequest.introLines.forEach((line) => writeLine(stdout, line));
  const answers = {} as Record<string, string>;

  for (const question of result.workflowRequest.questions) {
    let answer: string;
    try {
      answer = await readline.question(question.prompt);
    } catch {
      return {
        lines: [],
        errors: ["Agent creation cancelled."],
        shouldExit: false
      };
    }
    answers[question.key] = answer;
  }

  return app.createAgentFromWorkflow({
    name: answers.name ?? "",
    summary: answers.summary ?? "",
    mission: answers.mission ?? "",
    style: answers.style ?? "",
    skills: answers.skills ?? "",
    preferredResource: answers.preferredResource ?? ""
  });
}

async function resolveFollowUpPrompt(
  app: LocalCrewApp,
  readline: ReturnType<typeof createInterface>,
  initialResult: CommandResult
): Promise<CommandResult> {
  let result = initialResult;

  while (result.followUpRequest) {
    const formattedInput = formatDirectedMessageInput(result.followUpRequest);
    while (true) {
      const answer = await readline.question(`${formattedInput} Submit? Y/N `);
      const normalizedAnswer = answer.trim().toLowerCase();

      if (normalizedAnswer === "" || normalizedAnswer === "y" || normalizedAnswer === "yes") {
        result = await app.execute(parseCommand(formattedInput));
        break;
      }

      if (normalizedAnswer === "n" || normalizedAnswer === "no") {
        let editedInput: string;
        try {
          editedInput = await promptWithPrefill(readline, "followup> ", formattedInput);
        } catch {
          return {
            lines: [],
            errors: ["Follow-up edit cancelled."],
            shouldExit: false
          };
        }

        try {
          result = await app.execute(parseCommand(editedInput));
        } catch (error) {
          const message =
            error instanceof CommandParseError ? error.message : (error as Error).message;
          result = {
            lines: [],
            errors: [message],
            shouldExit: false
          };
        }
        break;
      }

      writeLine(stderr, 'Enter "Y" to submit or "N" to edit.');
    }
  }

  return result;
}

export async function runRepl(rootDir = process.cwd()): Promise<void> {
  // Mutable warn handler: starts as a plain stderr writer, then gets upgraded
  // to a readline-aware version once the readline interface is created. This
  // prevents background warning messages from clobbering the user's typing.
  let warnImpl = (message: string): void => writeLine(stderr, message);
  const warn = (message: string): void => warnImpl(message);

  const app = await LocalCrewApp.create({
    rootDir,
    warn
  });
  const apiServer = await startApiServer(app, {
    rootDir,
    warn
  });
  if (apiServer) {
    app.setApiServerHandle(apiServer);
  }

  const completer = buildCompleter();
  const readline = createInterface({
    input: stdin,
    output: stdout,
    terminal: true,
    completer,
  });

  // Upgrade warn to readline-aware: clears the current input line, writes
  // the warning, then restores the prompt and buffered text so the user's
  // typing is never lost.
  warnImpl = (message: string): void => {
    withReadlineRedraw(readline, getPromptOnly, () => {
      writeLine(stderr, message);
    });
  };

  let pulseShutdown = false;
  let viewerActive = false;

  /** Print the persistent status bar and return the styled prompt string. */
  function getStyledPrompt(): string {
    const statusBar = renderStatusBar(app.getStatusBarState());
    stdout.write(`${statusBar}\n`);
    return buildStyledPrompt(app.getPromptState());
  }

  /** Return prompt string only (no status bar), for inline background redraws. */
  function getPromptOnly(): string {
    return buildStyledPrompt(app.getPromptState());
  }

  const pulse = async (): Promise<void> => {
    if (pulseShutdown || viewerActive || !app.shouldAutoPulse()) {
      return;
    }

    try {
      const result = await app.runIdleCycle();
      renderBackgroundResult(readline, getPromptOnly, result);
    } catch (error) {
      renderBackgroundResult(readline, getPromptOnly, {
        lines: [],
        errors: [`Pulse recovered from an unexpected failure: ${(error as Error).message}`],
        shouldExit: false
      });
    }
  };

  const pulseTimer = setInterval(() => {
    void pulse();
  }, app.getAutoPulseIntervalMs());

  try {
    // ── Startup banner ──────────────────────────────────────────────────
    const resources = await app.getResourcesSnapshot();
    const bannerLines = renderBanner({
      orchestratorName: app.getStatusBarState().orchestratorName,
      mode: "command",
      resourceCount: resources.length,
      apiUrl: apiServer?.url,
      publicUrl: apiServer?.publicUrl,
      uiUrl: apiServer ? `${apiServer.url}/ui` : undefined,
      publicUiUrl: apiServer?.publicUrl ? `${apiServer.publicUrl}/ui` : undefined,
      displayUrl: apiServer ? `${apiServer.url}/display` : undefined,
      publicDisplayUrl: apiServer?.publicUrl ? `${apiServer.publicUrl}/display` : undefined,
    });
    bannerLines.forEach((line) => writeLine(stdout, line));

    // Show resource inventory on startup
    if (resources.length > 0) {
      writeLine(stdout, `  ${heading("Resources")}`);
      for (const r of resources) {
        const tier = r.tier === "top" ? "top" : r.tier === "mid" ? "mid" : "low";
        const roleSuffix = r.resourceRole && r.resourceRole !== "agent"
          ? ` (${r.resourceRole})`
          : "";
        writeLine(stdout, `  ${successText(`@${r.alias}`)} ${dim(tier + roleSuffix)} ${dim(r.baseUrl)}`);
      }
      writeLine(stdout, "");
    }

    // ── Main REPL loop ──────────────────────────────────────────────────
    while (true) {
      let inputLine: string;

      try {
        inputLine = await readline.question(getStyledPrompt());
      } catch {
        break;
      }

      if (!inputLine.trim()) {
        if (app.isAutoMode()) {
          const idleResult = await app.runIdleCycle();
          idleResult.lines.forEach((line) => writeLine(stdout, line));
          idleResult.errors.forEach((line) => writeLine(stderr, line));
          if (idleResult.shouldExit) {
            break;
          }
        }
        continue;
      }

      let command;
      try {
        command = parseCommand(inputLine);
      } catch (error) {
        const message =
          error instanceof CommandParseError ? error.message : (error as Error).message;
        writeLine(stderr, errorText(message));
        continue;
      }

      let result: CommandResult;
      try {
        result = await app.execute(command);
      } catch (error) {
        const message =
          error instanceof CommandParseError ? error.message : (error as Error).message;
        writeLine(stderr, errorText(message));
        continue;
      }

      if (result.editRequest) {
        const { kind } = result.editRequest;
        try {
          const updatedText = await promptWithPrefill(
            readline,
            result.editRequest.prompt,
            result.editRequest.initialText
          );
          result = result.editRequest.kind === "instructions"
            ? await app.updateInstructions(result.editRequest.target, updatedText)
            : result.editRequest.kind === "resource"
              ? await app.updateResourceSpec(result.editRequest.target, updatedText)
              : result.editRequest.kind === "participant"
                ? await app.updateParticipantSpec(result.editRequest.target, updatedText)
                : await app.updateAgentSpec(result.editRequest.target, updatedText);
        } catch {
          result = {
            lines: [],
            errors: [
              kind === "instructions"
                ? "Instruction edit cancelled."
                : kind === "resource"
                  ? "Resource edit cancelled."
                  : kind === "participant"
                    ? "Participant edit cancelled."
                : "Agent spec edit cancelled."
            ],
            shouldExit: false
          };
        }
      }

      result = await resolveWorkflowPrompt(app, readline, result);

      result.lines.forEach((line) => writeLine(stdout, line));
      result.errors.forEach((line) => writeLine(stderr, errorText(line)));

      if (result.viewerRequest) {
        viewerActive = true;
        try {
          await resolveViewerRequest(app, readline, result);
        } finally {
          viewerActive = false;
        }
      }

      if (result.followUpRequest && !result.shouldExit) {
        result = await resolveFollowUpPrompt(app, readline, result);
        result.lines.forEach((line) => writeLine(stdout, line));
        result.errors.forEach((line) => writeLine(stderr, errorText(line)));
      }

      if (result.shouldExit) {
        break;
      }
    }
  } finally {
    pulseShutdown = true;
    clearInterval(pulseTimer);
    if (apiServer) {
      await apiServer.close();
    }
    readline.close();
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  runRepl().catch((error) => {
    writeLine(stderr, `Fatal error: ${(error as Error).message}`);
    process.exitCode = 1;
  });
}
