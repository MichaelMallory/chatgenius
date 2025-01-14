import { env } from '@/lib/env';
import { type ProcessedResponse } from './response-processing';
import { type ChatCompletionOptions } from './openai';

// Constants
const MAX_REQUESTS_PER_MINUTE = 20;
const MAX_TOKENS_PER_USER_DAILY = 100000;
const REQUEST_TIMEOUT_MS = 15000;
const COST_PER_1K_INPUT_TOKENS = 0.01;
const COST_PER_1K_OUTPUT_TOKENS = 0.03;

export interface SafetyConfig {
  maxRequestsPerMinute?: number;
  maxTokensPerDay?: number;
  requestTimeout?: number;
  enableContentFilter?: boolean;
  maxCostPerDay?: number;
}

export interface SafetyMetrics {
  dailyTokens: number;
  dailyCost: number;
  requestCount: number;
  lastRequestTime: number;
}

export interface ContentFilterResult {
  isAllowed: boolean;
  reason?: string;
  filteredContent?: string;
}

// In-memory storage for rate limiting and metrics
// In production, this should be replaced with Redis or similar
const userMetrics = new Map<string, SafetyMetrics>();

/**
 * Reset user metrics daily
 */
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    userMetrics.clear();
  }
}, 60000); // Check every minute

/**
 * Check and update rate limits for a user
 */
export function checkRateLimits(userId: string, config?: SafetyConfig): boolean {
  const metrics = getUserMetrics(userId);
  const maxRequests = config?.maxRequestsPerMinute ?? MAX_REQUESTS_PER_MINUTE;

  const now = Date.now();
  const oneMinuteAgo = now - 60000;

  if (metrics.lastRequestTime > oneMinuteAgo && metrics.requestCount >= maxRequests) {
    return false;
  }

  // Update metrics
  metrics.requestCount = metrics.lastRequestTime > oneMinuteAgo ? metrics.requestCount + 1 : 1;
  metrics.lastRequestTime = now;
  userMetrics.set(userId, metrics);

  return true;
}

/**
 * Monitor and limit token usage per user
 */
export function checkTokenLimits(
  userId: string,
  tokenCount: number,
  config?: SafetyConfig
): boolean {
  const metrics = getUserMetrics(userId);
  const maxTokens = config?.maxTokensPerDay ?? MAX_TOKENS_PER_USER_DAILY;

  if (metrics.dailyTokens + tokenCount > maxTokens) {
    return false;
  }

  // Update metrics
  metrics.dailyTokens += tokenCount;
  userMetrics.set(userId, metrics);

  return true;
}

/**
 * Calculate and monitor costs
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1000) * COST_PER_1K_INPUT_TOKENS +
    (outputTokens / 1000) * COST_PER_1K_OUTPUT_TOKENS
  );
}

/**
 * Monitor and limit costs per user
 */
export function checkCostLimits(userId: string, cost: number, config?: SafetyConfig): boolean {
  const metrics = getUserMetrics(userId);
  const maxCost = config?.maxCostPerDay ?? 1.0; // Default $1 per day

  if (metrics.dailyCost + cost > maxCost) {
    return false;
  }

  // Update metrics
  metrics.dailyCost += cost;
  userMetrics.set(userId, metrics);

  return true;
}

/**
 * Filter potentially harmful content
 */
export function filterContent(content: string): ContentFilterResult {
  // List of patterns to check (expand based on requirements)
  const patterns = {
    personalInfo:
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    sensitiveKeywords: /\b(password|secret|key|token|credential)\b/gi,
    harmfulCommands: /\b(rm|delete|drop|truncate|exec|eval)\b/gi,
  };

  let filteredContent = content;
  const matches: string[] = [];

  // Check for and redact patterns
  Object.entries(patterns).forEach(([type, pattern]) => {
    const found = content.match(pattern);
    if (found) {
      matches.push(`Found ${type}: ${found.length} matches`);
      filteredContent = filteredContent.replace(pattern, '[REDACTED]');
    }
  });

  const isAllowed = matches.length === 0;

  return {
    isAllowed,
    reason: isAllowed ? undefined : matches.join(', '),
    filteredContent: isAllowed ? content : filteredContent,
  };
}

/**
 * Create a timeout promise
 */
export function createTimeout(ms: number = REQUEST_TIMEOUT_MS): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
  });
}

/**
 * Apply all safety measures to a response
 */
export async function applySafetyMeasures(
  userId: string,
  response: Promise<ProcessedResponse>,
  options?: ChatCompletionOptions,
  config?: SafetyConfig
): Promise<ProcessedResponse> {
  // Check rate limits first
  if (!checkRateLimits(userId, config)) {
    throw new Error('Rate limit exceeded');
  }

  // Apply timeout
  const timeoutMs = config?.requestTimeout ?? REQUEST_TIMEOUT_MS;
  const responseWithTimeout = Promise.race([response, createTimeout(timeoutMs)]);

  // Wait for response
  const processedResponse = await responseWithTimeout;

  // Check token limits
  if (!checkTokenLimits(userId, processedResponse.metadata.totalTokens, config)) {
    throw new Error('Daily token limit exceeded');
  }

  // Calculate and check costs
  const cost = calculateCost(
    processedResponse.metadata.totalTokens,
    processedResponse.content.length / 4 // Rough output token estimate
  );
  if (!checkCostLimits(userId, cost, config)) {
    throw new Error('Daily cost limit exceeded');
  }

  // Apply content filtering if enabled
  if (config?.enableContentFilter !== false) {
    const filterResult = filterContent(processedResponse.content);
    if (!filterResult.isAllowed) {
      processedResponse.content = filterResult.filteredContent!;
      processedResponse.validationErrors = [
        ...(processedResponse.validationErrors || []),
        `Content filtered: ${filterResult.reason}`,
      ];
    }
  }

  return processedResponse;
}

/**
 * Get or initialize user metrics
 */
function getUserMetrics(userId: string): SafetyMetrics {
  const existing = userMetrics.get(userId);
  if (existing) {
    return existing;
  }

  const initial: SafetyMetrics = {
    dailyTokens: 0,
    dailyCost: 0,
    requestCount: 0,
    lastRequestTime: 0,
  };
  userMetrics.set(userId, initial);
  return initial;
}
