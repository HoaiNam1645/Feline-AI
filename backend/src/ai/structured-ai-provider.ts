export interface StructuredGenerationRequest {
  system: string;
  user: string;
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxOutputTokens: number;
  signal?: AbortSignal;
  onTextDelta?: (text: string) => void;
  images?: Array<{
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    data: string;
    label?: string;
  }>;
}

export interface StructuredGenerationResult<T> {
  value: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number | null;
}

export interface TextGenerationRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  signal?: AbortSignal;
  onTextDelta?: (text: string) => void;
  images?: Array<{
    mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    data: string;
    label?: string;
  }>;
}

export interface TextGenerationResult extends StructuredGenerationResult<string> {}

export interface StructuredAiProvider {
  isConfigured(): boolean;
  configuration(): Record<string, string | boolean | null>;
  generateObject<T>(
    request: StructuredGenerationRequest
  ): Promise<StructuredGenerationResult<T>>;
}
