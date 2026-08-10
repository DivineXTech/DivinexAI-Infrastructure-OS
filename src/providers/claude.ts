/**
 * Anthropic Claude provider adapter.
 *
 * Wraps the Claude Messages API behind a single `generateStructured` call
 * that forces tool-use output and validates it against a Zod schema before
 * ever returning it to a workflow step — satisfying the "structured AI
 * output is schema-validated" production requirement.
 */

import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getEnv } from "@/src/env";
import type { SchemaValidationResult } from "@/src/types/contract";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = getEnv().ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export interface GenerateStructuredInput<Schema extends z.ZodTypeAny> {
  readonly model?: string;
  readonly system: string;
  readonly prompt: string;
  readonly schema: Schema;
  readonly schemaName: string;
  readonly maxTokens?: number;
}

/**
 * Calls Claude with a single tool whose input schema mirrors the caller's
 * Zod schema, forces that tool to be used, and validates the tool_use input
 * against the schema. Returns a SchemaValidationResult instead of throwing
 * so callers can decide whether a validation failure is retryable.
 */
export async function generateStructured<Schema extends z.ZodTypeAny>(
  input: GenerateStructuredInput<Schema>,
): Promise<SchemaValidationResult<z.infer<Schema>>> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: input.model ?? getEnv().ANTHROPIC_MODEL,
    max_tokens: input.maxTokens ?? 4096,
    system: input.system,
    messages: [{ role: "user", content: input.prompt }],
    tool_choice: { type: "tool", name: input.schemaName },
    tools: [
      {
        name: input.schemaName,
        description: `Return output matching the ${input.schemaName} contract.`,
        input_schema: {
          ...(zodToJsonSchema(input.schema) as Record<string, unknown>),
          type: "object",
        } as Anthropic.Messages.Tool.InputSchema,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  if (!toolUse) {
    return { valid: false, issues: ["Model did not return a tool_use block"] };
  }

  const parsed = input.schema.safeParse(toolUse.input);
  if (!parsed.success) {
    return {
      valid: false,
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    };
  }

  return { valid: true, data: parsed.data };
}
