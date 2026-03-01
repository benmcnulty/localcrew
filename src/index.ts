import { createInterface } from "node:readline/promises";
import { stdin, stdout, stderr } from "node:process";
import { pathToFileURL } from "node:url";

import { startApiServer } from "./api-server.ts";
import { CrustyApp, type CommandResult } from "./app.ts";
import {
  CommandParseError,
  formatDirectedMessageInput,
  parseCommand
} from "./commands.ts";

function writeLine(stream: { write(chunk: string): boolean }, line: string): void {
  stream.write(`${line}\n`);
}

function renderBackgroundResult(
  readline: ReturnType<typeof createInterface>,
  app: CrustyApp,
  result: CommandResult
): void {
  if (result.lines.length === 0 && result.errors.length === 0) {
    return;
  }

  const bufferedLine = (readline as unknown as { line?: string }).line ?? "";
  stdout.write("\r\u001b[2K");
  result.lines.forEach((line) => writeLine(stdout, line));
  result.errors.forEach((line) => writeLine(stderr, line));
  stdout.write(`${app.getPrompt()}${bufferedLine}`);
}

function clearScreen(): void {
  stdout.write("\u001b[2J\u001b[H");
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
  app: CrustyApp,
  readline: ReturnType<typeof createInterface>
): Promise<void> {
  const lines = await app.getStatusLines();

  await withRawMode(readline, async () => {
    while (true) {
      clearScreen();
      lines.forEach((line) => writeLine(stdout, line));
      const buffer = await readRawBuffer();

      if (isEscapeBuffer(buffer) || buffer.includes(3)) {
        clearScreen();
        return;
      }
    }
  });
}

async function runExploreViewer(
  app: CrustyApp,
  readline: ReturnType<typeof createInterface>
): Promise<void> {
  await withRawMode(readline, async () => {
    let inputBuffer = "";
    let errorMessage = "";

    const renderPrompt = async (): Promise<void> => {
      const tree = await app.getExploreTree();
      clearScreen();
      tree.lines.forEach((line) => writeLine(stdout, line));
      if (errorMessage) {
        writeLine(stderr, errorMessage);
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
        clearScreen();
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
}

async function runHudViewer(
  app: CrustyApp,
  readline: ReturnType<typeof createInterface>
): Promise<void> {
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

      clearScreen();
      const lines = await app.getHudLines(tabs[tabIndex]);
      lines.forEach((line) => writeLine(stdout, line));

      const buffer = await readRawBufferWithTimeout(250);
      if (!buffer) {
        continue;
      }

      if (buffer.includes(3)) {
        clearScreen();
        return;
      }

      if (isArrowLeftBuffer(buffer)) {
        tabIndex = (tabIndex + tabs.length - 1) % tabs.length;
        continue;
      }

      if (isArrowRightBuffer(buffer)) {
        tabIndex = (tabIndex + 1) % tabs.length;
        continue;
      }

      if (isEscapeBuffer(buffer)) {
        clearScreen();
        return;
      }
    }
  });
}

async function resolveViewerRequest(
  app: CrustyApp,
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
  app: CrustyApp,
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
  app: CrustyApp,
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
  const app = await CrustyApp.create({
    rootDir,
    warn: (message) => writeLine(stderr, message)
  });
  const apiServer = await startApiServer(app, {
    rootDir,
    warn: (message) => writeLine(stderr, message)
  });

  const readline = createInterface({
    input: stdin,
    output: stdout,
    terminal: true
  });
  let pulseShutdown = false;
  let viewerActive = false;

  const pulse = async (): Promise<void> => {
    if (pulseShutdown || viewerActive || !app.shouldAutoPulse()) {
      return;
    }

    const result = await app.runIdleCycle();
    renderBackgroundResult(readline, app, result);
  };

  const pulseTimer = setInterval(() => {
    void pulse();
  }, app.getAutoPulseIntervalMs());

  try {
    if (apiServer) {
      writeLine(stdout, `HTTP API: ${apiServer.url}/api/status`);
      writeLine(stdout, `Local UI: ${apiServer.url}/ui`);
      if (apiServer.publicUrl && apiServer.publicUrl !== apiServer.url) {
        writeLine(stdout, `LAN UI: ${apiServer.publicUrl}/ui`);
      }
    }
    const resources = await app.getResourcesSnapshot();
    if (resources.length <= 1) {
      writeLine(
        stdout,
        'Onboarding: this install has one resource. Run `node scripts/setup-node.js --orchestrator http://<orchestrator-ip>:4310` on the next device, then sync it here or add it manually with /resource add <alias> "Label" <baseUrl> [top|mid|low] [ollama|openai].'
      );
    }

    while (true) {
      let inputLine: string;

      try {
        inputLine = await readline.question(app.getPrompt());
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
        writeLine(stderr, message);
        continue;
      }

      let result: CommandResult;
      try {
        result = await app.execute(command);
      } catch (error) {
        const message =
          error instanceof CommandParseError ? error.message : (error as Error).message;
        writeLine(stderr, message);
        continue;
      }

      if (result.editRequest) {
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
              result.editRequest.kind === "instructions"
                ? "Instruction edit cancelled."
                : result.editRequest.kind === "resource"
                  ? "Resource edit cancelled."
                  : result.editRequest.kind === "participant"
                    ? "Participant edit cancelled."
                : "Agent spec edit cancelled."
            ],
            shouldExit: false
          };
        }
      }

      result = await resolveWorkflowPrompt(app, readline, result);

      result.lines.forEach((line) => writeLine(stdout, line));
      result.errors.forEach((line) => writeLine(stderr, line));

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
        result.errors.forEach((line) => writeLine(stderr, line));
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
