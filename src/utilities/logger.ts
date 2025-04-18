import { Terminal, ConsoleTerminalProvider } from '@rushstack/terminal'

export const logger: Terminal = new Terminal(new ConsoleTerminalProvider())
