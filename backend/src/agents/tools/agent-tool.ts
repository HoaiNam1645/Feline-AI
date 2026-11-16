export interface AgentTool<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly description: string;
  execute(input: TInput): Promise<TOutput>;
}
