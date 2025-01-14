import { preprocessText } from '@/lib/embeddings';

// Constants
const MAX_QUERY_LENGTH = 1000; // Characters
const MIN_QUERY_LENGTH = 2; // Characters

export interface QueryContext {
  channelId?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  messageTypes?: ('message' | 'file')[];
}

export interface ProcessedQuery {
  cleanText: string;
  context: QueryContext;
  isValid: boolean;
  error?: string;
}

/**
 * Extract context from query like channel mentions, date ranges, etc.
 */
function extractContext(query: string): QueryContext {
  const context: QueryContext = {};

  // Extract channel mentions (#channel-name)
  const channelMatch = query.match(/#([a-z0-9-]+)/);
  if (channelMatch) {
    context.channelId = channelMatch[1];
  }

  // Extract time ranges (last week, last month, etc.)
  if (query.includes('last week')) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    context.timeRange = { start, end };
  } else if (query.includes('last month')) {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    context.timeRange = { start, end };
  }

  // Extract message types (files, messages)
  if (query.includes('file:') || query.includes('type:file')) {
    context.messageTypes = ['file'];
  } else if (query.includes('message:') || query.includes('type:message')) {
    context.messageTypes = ['message'];
  }

  return context;
}

/**
 * Clean and normalize query text, removing special syntax
 */
function cleanQueryText(query: string): string {
  return (
    preprocessText(query)
      // Remove special syntax
      .replace(/#[a-z0-9-]+/g, '') // Remove channel mentions
      .replace(/file:|message:|type:\w+/g, '') // Remove type specifiers
      .replace(/last (week|month)/g, '') // Remove time range specifiers
      .trim()
  );
}

/**
 * Validate query length and content
 */
function validateQuery(query: string): { isValid: boolean; error?: string } {
  if (query.length < MIN_QUERY_LENGTH) {
    return {
      isValid: false,
      error: `Query must be at least ${MIN_QUERY_LENGTH} characters long`,
    };
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return {
      isValid: false,
      error: `Query must be no longer than ${MAX_QUERY_LENGTH} characters`,
    };
  }

  return { isValid: true };
}

/**
 * Process a search query, extracting context and cleaning text
 */
export function processQuery(query: string): ProcessedQuery {
  // Extract context first (before cleaning)
  const context = extractContext(query);

  // Clean and normalize the query text
  const cleanText = cleanQueryText(query);

  // Validate the cleaned query
  const { isValid, error } = validateQuery(cleanText);

  return {
    cleanText,
    context,
    isValid,
    error,
  };
}
