/**
 * Utility class for controlling concurrent execution
 */
export class ConcurrencyController {
  private _concurrencyLimit: number

  /**
   * Create a concurrency controller
   * @param concurrencyLimit Maximum number of concurrent tasks, default is 10
   */
  public constructor(concurrencyLimit: number = 10) {
    this._concurrencyLimit = concurrencyLimit
  }

  /**
   * Limit the number of concurrently executing tasks
   * @param tasks Array of task functions to be executed
   * @returns Results of all executed tasks
   */
  public async executeLimited<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
    const results: T[] = []
    const executing: Promise<void>[] = []

    for (const task of tasks) {
      const p = task().then((result) => {
        results.push(result)
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        executing.splice(executing.indexOf(p), 1)
      })

      executing.push(p)

      if (executing.length >= this._concurrencyLimit) {
        await Promise.race(executing)
      }
    }

    await Promise.all(executing)
    return results
  }

  /**
   * Get the current concurrency limit
   */
  public get concurrencyLimit(): number {
    return this._concurrencyLimit
  }

  /**
   * Set the concurrency limit
   */
  public set concurrencyLimit(limit: number) {
    this._concurrencyLimit = limit
  }
}
