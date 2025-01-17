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
const CITATION_PATTERN = /\[(\d+)\]\s+@([^\s]+)\s+in\s+#([^\s:]+):\s*(.*?)(?=\n\[\d+\]|\n*$)/g;

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
 * Extract and validate citations from response content
 */
function extractCitations(content: string, contextMessages: Message[]): Citation[] {
  const citations: Citation[] = [];
  const citationMatches = content.matchAll(CITATION_PATTERN);
  const usedMessageIds = new Set<string>();

  for (const match of citationMatches) {
    const [_, index, username, channelName, citedContent] = match;
    const messageIndex = parseInt(index) - 1;

    if (messageIndex < 0 || messageIndex >= contextMessages.length) {
      continue; // Skip invalid citation indices
    }

    const contextMessage = contextMessages[messageIndex];
    if (!contextMessage) continue;

    // Verify the citation matches the context message
    if (
      contextMessage.user.username !== username ||
      contextMessage.channel.name !== channelName ||
      !contextMessage.content.includes(citedContent.trim())
    ) {
      continue; // Skip citations that don't match context
    }

    // Avoid duplicate citations of the same message
    if (usedMessageIds.has(contextMessage.id)) continue;
    usedMessageIds.add(contextMessage.id);

    citations.push({
      messageId: contextMessage.id,
      content: citedContent.trim(),
      username: contextMessage.user.username,
      timestamp: new Date(contextMessage.createdAt),
      channelName: contextMessage.channel.name,
      channelId: contextMessage.channel.id,
      similarity: 1.0, // Direct match from context
    });
  }

  return citations;
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

  // Check for minimum citations
  if (citations.length === 0) {
    errors.push('Response must include at least one citation from the chat history');
  }

  // Check for proper citation format
  if (!content.includes('Sources:')) {
    errors.push('Response must include a "Sources:" section');
  }

  // Check for citations outside the Sources section
  const mainContent = content.split('Sources:')[0];
  if (CITATION_PATTERN.test(mainContent)) {
    errors.push('Citations should only appear in the Sources section');
  }

  // Check for proper citation formatting
  const citationSection = content.split('Sources:')[1];
  if (citationSection) {
    const properFormat = /^\s*\[\d+\]\s+@[^\s]+\s+in\s+#[^\s:]+:/m;
    if (!properFormat.test(citationSection)) {
      errors.push('Citations must follow the format: [X] @username in #channel: content');
    }
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
