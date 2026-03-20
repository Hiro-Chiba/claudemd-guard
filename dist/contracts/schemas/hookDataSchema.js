"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HookDataSchema = void 0;
const zod_1 = require("zod");
exports.HookDataSchema = zod_1.z.object({
    hook_event_name: zod_1.z.string(),
    tool_name: zod_1.z.string().optional(),
    tool_input: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
