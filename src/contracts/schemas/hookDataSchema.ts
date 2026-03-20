import { z } from 'zod'

export const HookDataSchema = z.object({
  hook_event_name: z.string(),
  tool_name: z.string().optional(),
  tool_input: z.record(z.string(), z.unknown()).optional(),
})
