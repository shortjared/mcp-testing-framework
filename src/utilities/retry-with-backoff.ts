import { logger } from './logger'

export interface IRetryOptions {
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  jitterFactor?: number
  retryableErrors?: string[]
}

interface IRetryableError extends Error {
  status?: number
  code?: string
}

const DEFAULT_OPTIONS: Required<IRetryOptions> = {
  maxRetries: 5,
  baseDelay: 1000, // Start with 1 second
  maxDelay: 60000, // Cap at 60 seconds
  backoffMultiplier: 2,
  jitterFactor: 0.3,
  retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'],
}

/**
 * Add jitter to prevent thundering herd problem
 */
function addJitter(delay: number, jitterFactor: number): number {
  const jitter = delay * jitterFactor * Math.random()
  return delay + (Math.random() < 0.5 ? -jitter : jitter)
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffMultiplier: number,
  jitterFactor: number,
): number {
  const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt)
  const delayWithCap = Math.min(exponentialDelay, maxDelay)
  return Math.round(addJitter(delayWithCap, jitterFactor))
}

/**
 * Check if an error is retryable
 */
function isRetryableError(
  error: IRetryableError,
  retryableErrors: string[],
): boolean {
  // Always retry 429 (rate limit) and 503 (service unavailable)
  if (error.status === 429 || error.status === 503) {
    return true
  }

  // Retry 500+ errors (server errors)
  if (error.status && error.status >= 500) {
    return true
  }

  // Retry network errors
  if (error.code && retryableErrors.includes(error.code)) {
    return true
  }

  // Retry specific error messages
  const message = error.message?.toLowerCase() || ''
  return (
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('connection')
  )
}

/**
 * Get appropriate delay for rate limit errors
 */
function getRateLimitDelay(
  error: IRetryableError,
  defaultDelay: number,
): number {
  // Check for Retry-After header information in error
  if (error.status === 429) {
    // For 429 errors, use a longer delay
    return Math.max(defaultDelay, 5000) // At least 5 seconds for rate limits
  }
  return defaultDelay
}

/**
 * Retry a function with exponential backoff and jitter
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: IRetryOptions = {},
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry on final attempt
      if (attempt === config.maxRetries) {
        break
      }

      // Check if error is retryable
      if (
        !isRetryableError(lastError as IRetryableError, config.retryableErrors)
      ) {
        throw lastError
      }

      // Calculate delay
      let delay = calculateDelay(
        attempt,
        config.baseDelay,
        config.maxDelay,
        config.backoffMultiplier,
        config.jitterFactor,
      )

      // Adjust delay for rate limits
      delay = getRateLimitDelay(lastError as IRetryableError, delay)

      const errorInfo = lastError as IRetryableError
      logger.writeWarningLine(
        `API call failed (attempt ${attempt + 1}/${config.maxRetries + 1}): ${lastError.message}` +
          (errorInfo.status ? ` [HTTP ${errorInfo.status}]` : '') +
          `. Retrying in ${delay}ms...`,
      )

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // All retries exhausted
  throw new Error(
    `All ${config.maxRetries + 1} attempts failed. Last error: ${lastError!.message}`,
  )
}

/**
 * Wrap an API provider's createMessage method with retry logic
 */
export function withRetry<
  T extends { createMessage: (...args: any[]) => Promise<string> },
>(provider: T, options: IRetryOptions = {}): T {
  const originalCreateMessage = provider.createMessage.bind(provider)

  provider.createMessage = async (...args: any[]): Promise<string> => {
    return retryWithBackoff(() => originalCreateMessage(...args), options)
  }

  return provider
}
