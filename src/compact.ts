import { chatWithOllama } from "./ollama.ts";
import { formatConversationTranscript } from "./messages.ts";
import type { ChatMessage, ConversationMessage, EndpointConfig } from "./types.ts";

export type SummarizeFn = (
  endpoint: EndpointConfig,
  messages: ChatMessage[]
) => Promise<string>;

const COMPACTION_PROMPT = [
  "You compress shared contributor conversations into one consensus summary.",
  "Preserve stable preferences, constraints, unresolved questions, decisions, disagreements, and any explicit next-step handoffs that still matter.",
  "Keep speaker identities accurate when they affect the discussion.",
  "Write a concise factual summary and output only the summary."
].join(" ");

export async function compactConversation(
  endpoint: EndpointConfig,
  previousSummary: string,
  messages: ConversationMessage[],
  summarizeFn: SummarizeFn = chatWithOllama
): Promise<string> {
  if (messages.length === 0) {
    return previousSummary.trim();
  }

  const mergedSummary = await summarizeFn(endpoint, [
    {
      role: "system",
      content: COMPACTION_PROMPT
    },
    {
      role: "user",
      content: [
        "Existing shared summary:",
        previousSummary.trim() || "(none)",
        "",
        "New conversation events:",
        formatConversationTranscript(messages),
        "",
        "Merge them into a single shared summary for future turns."
      ].join("\n")
    }
  ]);

  return mergedSummary.trim();
}
