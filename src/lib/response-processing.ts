import { type Message } from '@/types/message';
import { type ChatResponse } from './openai';
import { estimateTokenCount } from './openai';

export interface ProcessedResponse {
  content: string;
  citations: Citation[];
  isValid: boolean;
  validationErrors?: string[];
  metadata: ResponseMetadata;
}

export interface Citation {
  messageId: string;
  content: string;
  username: string;
  timestamp: Date;
  channelName: string;
  channelId: string;
  similarity: number;
}

export interface ResponseMetadata {
  totalTokens: number;
  processingTime: number;
  citationCount: number;
  containsCode: boolean;
  containsLinks: boolean;
}

const MAX_RESPONSE_LENGTH = 2000; // characters
const MIN_RESPONSE_LENGTH = 10; // characters
const CITATION_PATTERN = /\[(.*?)\]/g; // Matches text in square brackets

/**
 * Process and validate an AI response
 */
export function processResponse(
  response: ChatResponse,
  contextMessages: Message[],
  startTime: number
): ProcessedResponse {
  const citations: Citation[] = extractCitations(response.content, contextMessages);
  const processedContent = formatContent(response.content);
  const validationResult = validateResponse(processedContent, citations);

  const metadata: ResponseMetadata = {
    totalTokens: response.totalTokens,
    processingTime: Date.now() - startTime,
    citationCount: citations.length,
    containsCode: containsCode(processedContent),
    containsLinks: containsLinks(processedContent),
  };

  return {
    content: processedContent,
    citations,
    isValid: validationResult.isValid,
    validationErrors: validationResult.errors,
    metadata,
  };
}

/**
 * Extract citations from response content and link them to context messages
 */
function extractCitations(content: string, contextMessages: Message[]): Citation[] {
  const citations: Citation[] = [];
  const [_, sourcesSection] = content.split(/^Sources:/m);

  if (!sourcesSection) {
    return citations;
  }

  // Track used message IDs to prevent duplicates
  const usedMessageIds = new Set<string>();

  // Match citation numbers and content, improved regex to better handle multiline citations
  const citationMatches = sourcesSection.matchAll(
    /\[(\d+)\]\s+@?([^:]+):\s*((?:[^\n]|\n(?!\[))*)/g
  );

  for (const match of citationMatches) {
    const [_, number, _username, citedText] = match;
    const citedMessage = findMessageByCitation(citedText.trim(), contextMessages);

    if (citedMessage && !usedMessageIds.has(citedMessage.id)) {
      // Verify we have the required user data
      if (!citedMessage.user?.username) {
        console.error('Missing username for message:', citedMessage.id);
        continue;
      }

      usedMessageIds.add(citedMessage.id);
      citations.push({
        messageId: citedMessage.id,
        content: citedMessage.content,
        username: citedMessage.user.username,
        timestamp: citedMessage.createdAt,
        channelName: citedMessage.channel.name,
        channelId: citedMessage.channel.id,
        similarity: 1, // Always 1 since we only allow exact matches
      });
    }
  }

  return citations.sort((a, b) => {
    const aIndex = contextMessages.findIndex((m) => m.id === a.messageId);
    const bIndex = contextMessages.findIndex((m) => m.id === b.messageId);
    return aIndex - bIndex;
  });
}

/**
 * Format response content for display
 */
function formatContent(content: string): string {
  // Split content into main response and sources
  const [mainContent, sourcesSection] = content.split(/^Sources:/m);

  // Process main content - remove citations
  const processedMainContent = mainContent
    .replace(/```([\s\S]*?)```/g, (_, code) => `\`\`\`${code.trim()}\`\`\``)
    .replace(/\[(.*?)\]/g, '') // Remove citation markers from main content
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .trim();

  // Process sources section - preserve citations
  const processedSourcesSection = sourcesSection ? '\n\nSources:' + sourcesSection.trim() : '';

  // Combine processed sections
  return processedMainContent + processedSourcesSection;
}

/**
 * Validate the processed response
 */
function validateResponse(
  content: string,
  citations: Citation[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check response length
  if (content.length < MIN_RESPONSE_LENGTH) {
    errors.push('Response is too short');
  }
  if (content.length > MAX_RESPONSE_LENGTH) {
    errors.push('Response exceeds maximum length');
  }

  // Check for Sources section
  if (!content.includes('\n\nSources:')) {
    errors.push('Response must include a Sources section');
  }

  // Check for empty or invalid citations
  if (citations.length === 0) {
    errors.push('Response must include at least one valid citation');
  }

  // Check for code block balance
  const codeBlockCount = (content.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    errors.push('Unbalanced code blocks');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Find the exact message match in context for a citation
 */
function findMessageByCitation(citation: string, messages: Message[]): Message | undefined {
  // Normalize whitespace but preserve case - replace multiple spaces/newlines with single space
  const normalizedCitation = citation.trim().replace(/\s+/g, ' ');

  for (const message of messages) {
    if (!message.content) continue;

    const messageContent = message.content.trim().replace(/\s+/g, ' ');

    // Only allow exact matches after whitespace normalization
    if (messageContent === normalizedCitation) {
      return message;
    }
  }

  return undefined;
}

/**
 * Calculate similarity between two strings
 */
function calculateSimilarity(cited: string, original: string): number {
  // If strings are identical, return 1
  if (cited === original) return 1;

  // If one string contains the other completely, return 0.9
  if (original.includes(cited) || cited.includes(original)) return 0.9;

  // Calculate word-based similarity
  const citedWords = new Set(cited.split(/\s+/).filter(Boolean));
  const originalWords = new Set(original.split(/\s+/).filter(Boolean));

  // If either set is empty after filtering, return 0
  if (citedWords.size === 0 || originalWords.size === 0) return 0;

  const intersection = new Set([...citedWords].filter((x) => originalWords.has(x)));
  const union = new Set([...citedWords, ...originalWords]);

  // Return Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Check if content contains code blocks
 */
function containsCode(content: string): boolean {
  return content.includes('```') || content.includes('`');
}

/**
 * Check if content contains markdown links
 */
function containsLinks(content: string): boolean {
  return /\[.*?\]\(.*?\)/.test(content);
}
