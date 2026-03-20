// Config
export { Config } from './config/Config'
export type { ConfigOptions } from './config/Config'

// Types
export type { ValidationResult } from './contracts/types/ValidationResult'
export type { HookData } from './contracts/types/HookData'
export type { IModelClient } from './contracts/types/ModelClient'
export type { ClaudeMdFile } from './contracts/types/ClaudeMdFile'

// Schemas
export { HookDataSchema } from './contracts/schemas/hookDataSchema'

// Core
export { collectClaudeMd } from './collector/collectClaudeMd'
export { validator } from './validation/validator'
export { processHookData } from './hooks/processHookData'
