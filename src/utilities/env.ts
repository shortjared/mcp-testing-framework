import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

import { logger } from './logger'

// Load environment variables from `.env` file
export const loadEnv = (): void => {
  const cwdEnvPath: string = path.resolve(process.cwd(), '.env')

  if (fs.existsSync(cwdEnvPath)) {
    logger.writeLine('Loading environment variables from ' + cwdEnvPath)
    dotenv.config({ path: cwdEnvPath })
  } else {
    dotenv.config()
  }
}
