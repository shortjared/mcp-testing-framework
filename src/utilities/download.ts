import { VERSION } from '../constants'
import { FileSystem } from '@rushstack/node-core-library'
import path from 'path'

interface IDownloadItem {
  type: string
  name: string
  download_url: string
  path: string
}

const GITHUB_API: 'https://api.github.com' = 'https://api.github.com'
const MAIN: 'main' = 'main'

/**
 * Downloads a single file from URL to target path
 * @param url Source URL
 * @param targetPath Target file path
 */
export async function downloadFile(
  url: string,
  targetPath: string,
): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to download file from Github: ${response.statusText}`,
    )
  }
  const content = await response.text()
  await FileSystem.writeFileAsync(targetPath, content)
}

/**
 * Downloads a directory recursively from GitHub
 * @param directory Source directory path in repo
 * @param targetDirectory Local target directory
 */
export async function downloadDirectory(
  directory: string,
  targetDirectory: string,
): Promise<void> {
  // Create target directory if it doesn't exist
  if (!(await FileSystem.existsAsync(targetDirectory))) {
    await FileSystem.ensureFolderAsync(targetDirectory)
  }

  const baseUrl = `${GITHUB_API}/repos/L-Qun/mcp-testing-framework/contents/${directory}`

  // Try with current version first
  let url = `${baseUrl}?ref=${VERSION}`
  let response = await fetch(url)

  // Fall back to main branch if version-specific content not found
  if (!response.ok) {
    url = `${baseUrl}?ref=${MAIN}`
    response = await fetch(url)

    if (!response.ok) {
      throw new Error(
        `Failed to download example from Github: ${response.statusText}`,
      )
    }
  }

  const data = (await response.json()) as IDownloadItem[]

  for (const item of data) {
    const itemPath = path.join(targetDirectory, item.name)

    if (item.type === 'file') {
      await downloadFile(item.download_url, itemPath)
    } else if (item.type === 'dir') {
      // Process subdirectory
      await downloadDirectory(item.path, itemPath)
    }
  }
}
