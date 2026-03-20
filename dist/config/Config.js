"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.DEFAULT_MODEL = void 0;
exports.DEFAULT_MODEL = 'claude-sonnet-4-6';
class Config {
    model;
    apiKey;
    cooldown;
    disabled;
    useSystemClaude;
    constructor(options) {
        this.model = options?.model ?? process.env.CLAUDEMD_GUARD_MODEL ?? exports.DEFAULT_MODEL;
        this.apiKey = options?.apiKey ?? process.env.CLAUDEMD_GUARD_API_KEY;
        this.cooldown = options?.cooldown ?? parseInt(process.env.CLAUDEMD_GUARD_COOLDOWN ?? '0', 10);
        this.disabled = options?.disabled ?? process.env.CLAUDEMD_GUARD_DISABLED === 'true';
        this.useSystemClaude = options?.useSystemClaude ?? process.env.USE_SYSTEM_CLAUDE === 'true';
    }
    get useApi() {
        return this.apiKey !== undefined && this.apiKey !== '';
    }
}
exports.Config = Config;
