interface BackoffOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  onRetry?: (error: Error, attempt: number) => void;
}

export async function exponentialBackoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions
): Promise<T> {
  const { maxRetries, baseDelay, maxDelay, onRetry } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

      if (onRetry) {
        onRetry(error as Error, attempt);
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unreachable: all retries failed');
}
