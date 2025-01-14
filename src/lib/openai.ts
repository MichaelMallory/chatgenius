import OpenAI from 'openai';
import { env } from '@/lib/env';
import { exponentialBackoff } from '@/lib/utils/backoff';
import { type PromptTemplate } from './prompt-engineering';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY!,
});

// Constants
const MAX_RETRIES = 3;
const MAX_TOKENS_OUTPUT = 1000;
const MODEL = 'gpt-4-turbo-preview';

export interface ChatCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

const DEFAULT_OPTIONS: ChatCompletionOptions = {
  maxTokens: MAX_TOKENS_OUTPUT,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
};

type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatResponse {
  content: string;
  totalTokens: number;
  role: ChatRole;
}

/**
 * Generate a chat completion response using the provided prompt template
 */
export async function generateChatResponse(
  prompt: PromptTemplate,
  options: ChatCompletionOptions = {}
): Promise<ChatResponse> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const messages = [prompt.systemMessage, { role: 'user' as const, content: prompt.userMessage }];

  if (prompt.assistantMessage) {
    messages.push({ role: 'assistant' as ChatRole, content: prompt.assistantMessage });
  }

  return await exponentialBackoff(
    async () => {
      try {
        const response = await openai.chat.completions.create({
          model: MODEL,
          messages,
          max_tokens: mergedOptions.maxTokens,
          temperature: mergedOptions.temperature,
          top_p: mergedOptions.topP,
          frequency_penalty: mergedOptions.frequencyPenalty,
          presence_penalty: mergedOptions.presencePenalty,
        });

        return {
          content: response.choices[0].message.content || '',
          totalTokens: response.usage?.total_tokens || 0,
          role: 'assistant' as ChatRole,
        };
      } catch (error) {
        console.error('Error generating chat response:', error);
        throw error;
      }
    },
    {
      maxRetries: MAX_RETRIES,
      baseDelay: 1000,
      maxDelay: 10000,
      onRetry: (error: Error, attempt: number) => {
        console.warn(`Retry attempt ${attempt} for chat completion:`, error);
      },
    }
  );
}

/**
 * Count tokens in a string (rough approximation)
 * Note: This is a simple approximation, for precise counting use the tiktoken library
 */
export function estimateTokenCount(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Validate if the total tokens in a prompt are within model limits
 */
export function validateTokenCount(prompt: PromptTemplate): boolean {
  const systemTokens = estimateTokenCount(prompt.systemMessage.content);
  const userTokens = estimateTokenCount(prompt.userMessage);
  const assistantTokens = prompt.assistantMessage ? estimateTokenCount(prompt.assistantMessage) : 0;

  const totalTokens = systemTokens + userTokens + assistantTokens + MAX_TOKENS_OUTPUT;

  // GPT-4 Turbo has a 128K context window
  return totalTokens <= 128000;
}
