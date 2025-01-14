import type { SearchResult } from '@/lib/semantic-search';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import type { Database } from '@/lib/database.types';

// Initialize Supabase client
const supabase = createClient<Database>(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Constants
const MAX_CONTEXT_MESSAGES = 10;
const MAX_TOKENS_PER_MESSAGE = 500;
const MAX_TOTAL_TOKENS = 4000;

export interface MessageContext {
  id: string;
  content: string;
  username: string;
  timestamp: string;
  channelName: string;
  type: 'message';
}

export interface AssembledContext {
  messages: MessageContext[];
  truncated: boolean;
  totalTokens: number;
}

/**
 * Rough token count estimation
 */
function estimateTokens(text: string): number {
  // Rough approximation: 4 chars per token on average
  return Math.ceil(text.length / 4);
}

/**
 * Format a message for display in the AI prompt
 */
function formatMessage(msg: MessageContext): string {
  return `${msg.username} in #${msg.channelName} at ${msg.timestamp}:
${msg.content}`;
}

/**
 * Order messages by relevance and time
 */
function orderMessages(messages: SearchResult[]): SearchResult[] {
  return messages.sort((a, b) => {
    // First by similarity score
    const scoreDiff = b.score - a.score;
    if (Math.abs(scoreDiff) > 0.1) return scoreDiff;

    // Then by time (most recent first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * Get parent messages for context
 */
async function getParentMessages(messages: SearchResult[]): Promise<Map<string, string>> {
  // For now, we're not handling parent messages
  return new Map();
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

/**
 * Assemble context from search results
 */
export async function assembleContext(
  results: SearchResult[],
  maxMessages = MAX_CONTEXT_MESSAGES,
  maxTokens = MAX_TOTAL_TOKENS
): Promise<AssembledContext> {
  // Order messages by relevance and time
  const orderedMessages = orderMessages(results);

  let totalTokens = 0;
  const messages: MessageContext[] = [];
  let truncated = false;

  for (const result of orderedMessages) {
    // Format message content
    const message: MessageContext = {
      id: result.messageId,
      content: result.content,
      username: result.username,
      timestamp: formatTimestamp(result.createdAt),
      channelName: result.channelName,
      type: result.type,
    };

    // Format and estimate tokens
    const formattedMessage = formatMessage(message);
    const tokens = estimateTokens(formattedMessage);

    // Check if we can add this message
    if (
      messages.length >= maxMessages ||
      totalTokens + tokens > maxTokens ||
      tokens > MAX_TOKENS_PER_MESSAGE
    ) {
      truncated = true;
      break;
    }

    messages.push(message);
    totalTokens += tokens;
  }

  return {
    messages,
    totalTokens,
    truncated,
  };
}

/**
 * Format context for AI prompt
 */
export function formatContextForPrompt(context: AssembledContext): string {
  if (context.messages.length === 0) {
    return 'No relevant context found in chat history.';
  }

  const messagesText = context.messages
    .map((msg, i) => `[${i + 1}] ${formatMessage(msg)}`)
    .join('\n\n');

  return `RELEVANT CHAT HISTORY:
${messagesText}
${context.truncated ? '\n[Note: Some messages were truncated due to length constraints]' : ''}

When referencing these messages in your response, use the message number [1], [2], etc.`;
}
