import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import { requiredNumber } from "../config/runtime-config";
import {
  StructuredAiProvider,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  TextGenerationRequest,
  TextGenerationResult
} from "./structured-ai-provider";

function optionalPrice(name: string): number | null {
  const raw = process.env[name];
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function nonNegativeNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

export function partialJsonString(json: string, key: string): string {
  const property = new RegExp(`"${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*"`).exec(json);
  if (!property) return "";
  const start = property.index + property[0].length;
  let index = start;
  let safeEnd = start;
  while (index < json.length) {
    const character = json[index];
    if (character === '"') break;
    if (character !== "\\") {
      index += 1;
      safeEnd = index;
      continue;
    }
    if (index + 1 >= json.length) break;
    if (json[index + 1] === "u") {
      if (index + 6 > json.length || !/^[0-9a-f]{4}$/i.test(json.slice(index + 2, index + 6))) break;
      index += 6;
    } else {
      if (!/["\\/bfnrt]/.test(json[index + 1])) break;
      index += 2;
    }
    safeEnd = index;
  }
  try {
    return JSON.parse(`"${json.slice(start, safeEnd)}"`) as string;
  } catch {
    return "";
  }
}

@Injectable()
export class AnthropicStructuredProvider implements StructuredAiProvider {
  isConfigured(): boolean {
    return process.env.LEMIEX_AI_ENABLED === "true"
      && Boolean(process.env.ANTHROPIC_API_KEY)
      && Boolean(process.env.ANTHROPIC_MODEL);
  }

  configuration(): Record<string, string | boolean | null> {
    return {
      provider: "anthropic",
      enabled: process.env.LEMIEX_AI_ENABLED === "true",
      apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
      workspaceIdConfigured: Boolean(process.env.ANTHROPIC_WORKSPACE_ID),
      model: process.env.ANTHROPIC_MODEL || null
    };
  }

  async generateObject<T>(
    request: StructuredGenerationRequest
  ): Promise<StructuredGenerationResult<T>> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Lemiex AI requires LEMIEX_AI_ENABLED, ANTHROPIC_API_KEY and ANTHROPIC_MODEL"
      );
    }

    const model = process.env.ANTHROPIC_MODEL as string;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: requiredNumber("AI_REQUEST_TIMEOUT_MS", 30_000),
      maxRetries: nonNegativeNumber("AI_PROVIDER_MAX_RETRIES", 2),
      defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID
        ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
        : undefined
    });
    const params: MessageCreateParamsNonStreaming = {
      model,
      max_tokens: request.maxOutputTokens,
      system: request.system,
      messages: [{
        role: "user",
        content: request.images?.length
          ? [
              ...request.images.flatMap((image) => [
                ...(image.label ? [{ type: "text" as const, text: image.label }] : []),
                {
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: image.mediaType,
                    data: image.data
                  }
                }
              ]),
              { type: "text" as const, text: request.user }
            ]
          : request.user
      }],
      tools: [{
        name: request.toolName,
        description: request.toolDescription,
        input_schema: request.inputSchema as never
      }],
      tool_choice: { type: "tool", name: request.toolName }
    };
    const options = request.signal ? { signal: request.signal } : undefined;
    let response;
    if (request.onTextDelta) {
      let emittedLength = 0;
      let toolInputJson = "";
      const stream = client.messages.stream(params, options);
      stream.on("inputJson", (partialJson) => {
        toolInputJson += partialJson;
        const markdown = partialJsonString(toolInputJson, "markdown");
        if (markdown.length <= emittedLength) return;
        request.onTextDelta?.(markdown.slice(emittedLength));
        emittedLength = markdown.length;
      });
      response = await stream.finalMessage();
    } else {
      response = await client.messages.create(params, options);
    }
    const toolUse = response.content.find(
      (block) => block.type === "tool_use" && block.name === request.toolName
    );
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Anthropic response did not contain the required tool output");
    }

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const inputPrice = optionalPrice("ANTHROPIC_INPUT_COST_PER_MILLION");
    const outputPrice = optionalPrice("ANTHROPIC_OUTPUT_COST_PER_MILLION");
    const estimatedCostUsd = inputPrice === null || outputPrice === null
      ? null
      : Number((
          (inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000
        ).toFixed(6));

    return {
      value: toolUse.input as T,
      model: response.model,
      inputTokens,
      outputTokens,
      estimatedCostUsd
    };
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "Lemiex AI requires LEMIEX_AI_ENABLED, ANTHROPIC_API_KEY and ANTHROPIC_MODEL"
      );
    }
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: requiredNumber("AI_REQUEST_TIMEOUT_MS", 30_000),
      maxRetries: nonNegativeNumber("AI_PROVIDER_MAX_RETRIES", 2),
      defaultHeaders: process.env.ANTHROPIC_WORKSPACE_ID
        ? { "anthropic-workspace-id": process.env.ANTHROPIC_WORKSPACE_ID }
        : undefined
    });
    const content = request.images?.length
      ? [
          ...request.images.flatMap((image) => [
            ...(image.label ? [{ type: "text" as const, text: image.label }] : []),
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: image.mediaType,
                data: image.data
              }
            }
          ]),
          { type: "text" as const, text: request.user }
        ]
      : request.user;
    const stream = client.messages.stream({
      model: process.env.ANTHROPIC_MODEL as string,
      max_tokens: request.maxOutputTokens,
      system: request.system,
      messages: [{ role: "user", content }]
    }, request.signal ? { signal: request.signal } : undefined);
    if (request.onTextDelta) stream.on("text", request.onTextDelta);
    const response = await stream.finalMessage();
    const value = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (!value) throw new Error("Anthropic response did not contain text output");
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const inputPrice = optionalPrice("ANTHROPIC_INPUT_COST_PER_MILLION");
    const outputPrice = optionalPrice("ANTHROPIC_OUTPUT_COST_PER_MILLION");
    return {
      value,
      model: response.model,
      inputTokens,
      outputTokens,
      estimatedCostUsd: inputPrice === null || outputPrice === null
        ? null
        : Number(((inputTokens * inputPrice + outputTokens * outputPrice) / 1_000_000).toFixed(6))
    };
  }
}
