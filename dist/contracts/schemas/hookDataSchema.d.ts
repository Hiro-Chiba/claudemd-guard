import { z } from 'zod';
export declare const HookDataSchema: z.ZodObject<{
    hook_event_name: z.ZodString;
    tool_name: z.ZodOptional<z.ZodString>;
    tool_input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
//# sourceMappingURL=hookDataSchema.d.ts.map