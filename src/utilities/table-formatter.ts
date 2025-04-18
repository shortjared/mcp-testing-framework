import Table from 'cli-table3'
import { Colorize } from '@rushstack/terminal'

/**
 * Utility class for formatting and displaying tables in terminal
 */
export class TableFormatter {
  private _modelNames: string[]

  /**
   * Create a new table formatter
   * @param modelNames Names of models to display in the table
   */
  public constructor(modelNames: string[]) {
    this._modelNames = modelNames
  }

  private _getTerminalWidth(): number {
    return process.stdout.columns || 80
  }

  private _createTableConfig(): Table.TableConstructorOptions {
    const terminalWidth = this._getTerminalWidth()
    const modelCount = this._modelNames.length

    // Calculate space taken by borders and padding
    // Borders: 1 char at start + 1 char at end + 1 char between each column = (modelCount + 1) + 1
    // Padding: 1 char left + 1 char right for each cell = 2 * (modelCount + 1)
    const bordersWidth = modelCount + 2
    const paddingWidth = 2 * (modelCount + 1)
    const decorationWidth = bordersWidth + paddingWidth

    // Calculate available content width
    const availableContentWidth = Math.max(terminalWidth - decorationWidth, 40)

    // Dynamic calculation of prompt column width based on model count
    // Using a smooth function that reduces prompt percentage as model count increases
    // Minimum prompt percentage is 30%, maximum is 70%
    const basePercentage = 0.3 // Minimum percentage
    const additionalPercentage = 0.4 // Additional percentage that decreases with model count
    const promptPercentage = Math.min(
      0.7, // Maximum percentage (70%)
      basePercentage + additionalPercentage / Math.sqrt(modelCount),
    )

    // Ensure each model column has a minimum width
    const minModelColWidth = 10
    const totalMinModelWidth = minModelColWidth * modelCount

    let promptColWidth: number
    let modelColWidth: number

    if (totalMinModelWidth > availableContentWidth * (1 - basePercentage)) {
      // If minimum model widths would take too much space, allocate minimum model width
      // and give the rest to prompt
      modelColWidth = minModelColWidth
      promptColWidth = Math.max(
        minModelColWidth,
        availableContentWidth - totalMinModelWidth,
      )
    } else {
      // Normal calculation with percentages
      promptColWidth = Math.floor(availableContentWidth * promptPercentage)
      const remainingWidth = availableContentWidth - promptColWidth
      modelColWidth = Math.floor(remainingWidth / modelCount)
    }

    return {
      head: ['prompt', ...this._modelNames.map((model) => `[${model}]`)],
      colWidths: [promptColWidth, ...Array(modelCount).fill(modelColWidth)],
      wordWrap: true,
      wrapOnWordBoundary: true,
      style: {
        head: ['cyan'],
        border: ['grey'],
      },
    }
  }

  /**
   * Create a table to display test results
   * @param prompts Array of prompts
   * @param rates 2D array of pass rates, first dimension for prompts, second for models
   * @param passThreshold Threshold for considering a test passed
   * @returns Table instance and boolean indicating if all tests passed
   */
  public createResultTable(
    prompts: string[],
    rates: number[][],
    passThreshold: number,
  ): { table: Table.Table; isAllPass: boolean } {
    // Create a new table with current terminal dimensions
    const table = new Table(this._createTableConfig())
    let isAllPass = true

    for (let i = 0; i < prompts.length; i++) {
      const formattedRates = rates[i].map((rate) => {
        if (rate >= passThreshold) {
          return Colorize.green(`[PASS] ${rate * 100}%`)
        } else {
          isAllPass = false
          return Colorize.red(`[FAIL] ${rate * 100}%`)
        }
      })
      table.push([prompts[i], ...formattedRates])
    }

    return { table, isAllPass }
  }

  /**
   * Create a progress bar
   * @param percent Percentage of completion
   * @param length Length of the progress bar
   * @returns Formatted progress bar string
   */
  public createProgressBar(percent: number, length: number = 30): string {
    const filledLength = Math.floor((length * percent) / 100)
    const filled = '█'.repeat(filledLength)
    const empty = '░'.repeat(length - filledLength)
    return `[${filled}${empty}]`
  }
}
