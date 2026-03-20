"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processHookData = processHookData;
const fs_1 = require("fs");
const crypto_1 = require("crypto");
const path_1 = require("path");
const os_1 = require("os");
const hookDataSchema_1 = require("../contracts/schemas/hookDataSchema");
const collectClaudeMd_1 = require("../collector/collectClaudeMd");
const validator_1 = require("../validation/validator");
const Config_1 = require("../config/Config");
const ClaudeCli_1 = require("../validation/models/ClaudeCli");
const AnthropicApi_1 = require("../validation/models/AnthropicApi");
const PASS = { decision: undefined, reason: '' };
class FileCooldownStore {
    dir;
    constructor() {
        this.dir = (0, path_1.join)((0, os_1.tmpdir)(), 'claudemd-guard');
        (0, fs_1.mkdirSync)(this.dir, { recursive: true });
    }
    stampPath(key) {
        const hash = (0, crypto_1.createHash)('sha256').update(key).digest('hex');
        return (0, path_1.join)(this.dir, hash);
    }
    getLastTime(key) {
        try {
            return parseInt((0, fs_1.readFileSync)(this.stampPath(key), 'utf-8'), 10) || 0;
        }
        catch {
            return 0;
        }
    }
    setLastTime(key, time) {
        (0, fs_1.writeFileSync)(this.stampPath(key), String(time));
    }
}
async function processHookData(input, deps) {
    const config = deps?.config ?? new Config_1.Config();
    if (config.disabled) {
        return PASS;
    }
    let parsed;
    try {
        parsed = JSON.parse(input);
    }
    catch {
        return PASS;
    }
    const result = hookDataSchema_1.HookDataSchema.safeParse(parsed);
    if (!result.success) {
        return PASS;
    }
    const hookData = result.data;
    // Only process PreToolUse events
    if (hookData.hook_event_name !== 'PreToolUse') {
        return PASS;
    }
    const toolName = hookData.tool_name;
    const toolInput = hookData.tool_input;
    if (!toolName || !toolInput) {
        return PASS;
    }
    // Cooldown check (file-based, persists across process invocations)
    const cwd = deps?.cwd ?? process.cwd();
    if (config.cooldown > 0) {
        const store = deps?.cooldownStore ?? new FileCooldownStore();
        const now = Math.floor(Date.now() / 1000);
        const lastTime = store.getLastTime(cwd);
        if (now - lastTime < config.cooldown) {
            return PASS;
        }
        store.setLastTime(cwd, now);
    }
    // Collect CLAUDE.md files
    const collect = deps?.collectFn ?? collectClaudeMd_1.collectClaudeMd;
    const claudeMdFiles = collect(cwd);
    if (claudeMdFiles.length === 0) {
        return PASS;
    }
    // Get model client
    const getClient = deps?.getModelClient ?? createModelClient;
    const modelClient = getClient(config);
    // Validate
    const validate = deps?.validatorFn ?? validator_1.validator;
    return validate(claudeMdFiles, toolName, toolInput, modelClient);
}
function createModelClient(config) {
    if (config.useApi) {
        return new AnthropicApi_1.AnthropicApi(config);
    }
    return new ClaudeCli_1.ClaudeCli(config);
}
