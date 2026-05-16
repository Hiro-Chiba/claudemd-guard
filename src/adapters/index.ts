import { Adapter } from './Adapter'
import { claudeCodeAdapter } from './claude-code/adapter'
import { cursorAdapter } from './cursor/adapter'

export const DEFAULT_ADAPTER_ID = 'claude-code'

const ADAPTER_REGISTRY: Record<string, Adapter> = {
  'claude-code': claudeCodeAdapter,
  cursor: cursorAdapter,
}

export function getAdapter(id: string): Adapter | undefined {
  return ADAPTER_REGISTRY[id]
}

export function availableAdapterIds(): string[] {
  return Object.keys(ADAPTER_REGISTRY).sort()
}

export { Adapter, claudeCodeAdapter, cursorAdapter }
