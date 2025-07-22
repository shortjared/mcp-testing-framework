/**
 * Expands environment variables in strings using ${VARIABLE_NAME} syntax
 * Supports both shell environment variables and .env file variables
 */
export function expandEnvironmentVariables(value: string): string {
  if (typeof value !== 'string') {
    return value
  }

  // Replace ${VAR_NAME} patterns with environment variable values
  return value.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const envValue = process.env[varName]

    if (envValue !== undefined) {
      return envValue
    }

    // If environment variable is not found, return the original pattern
    // This helps with debugging - you can see which variables weren't expanded
    return match
  })
}

/**
 * Recursively expands environment variables in an object's string values
 */
export function expandEnvironmentVariablesInObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    return expandEnvironmentVariables(obj) as T
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => expandEnvironmentVariablesInObject(item)) as T
  }

  if (typeof obj === 'object') {
    const expanded: any = {}
    for (const [key, value] of Object.entries(obj)) {
      expanded[key] = expandEnvironmentVariablesInObject(value)
    }
    return expanded
  }

  return obj
}
