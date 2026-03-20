"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCli = void 0;
const child_process_1 = require("child_process");
const path_1 = require("path");
const os_1 = require("os");
const fs_1 = require("fs");
const system_prompt_1 = require("../prompts/system-prompt");
class ClaudeCli {
    config;
    constructor(config) {
        this.config = config;
    }
    async ask(prompt) {
        const claudeBinary = this.getClaudeBinary();
        const fullPrompt = `${system_prompt_1.SYSTEM_PROMPT}\n\n${prompt}`;
        const args = [
            '-',
            '--output-format',
            'json',
            '--max-turns',
            '1',
            '--model',
            this.config.model,
            '--disallowed-tools',
            'Edit,Write,Bash,Read,Glob,Grep',
            '--strict-mcp-config',
        ];
        const claudeDir = (0, path_1.join)(process.cwd(), '.claude');
        if (!(0, fs_1.existsSync)(claudeDir)) {
            (0, fs_1.mkdirSync)(claudeDir, { recursive: true });
        }
        const output = (0, child_process_1.execFileSync)(claudeBinary, args, {
            encoding: 'utf-8',
            timeout: 60000,
            input: fullPrompt,
            cwd: claudeDir,
            shell: process.platform === 'win32',
        });
        const response = JSON.parse(output);
        return response.result;
    }
    getClaudeBinary() {
        if (this.config.useSystemClaude) {
            return 'claude';
        }
        // Try the standard Claude Code local binary first
        const localBinary = (0, path_1.join)((0, os_1.homedir)(), '.claude', 'local', 'claude');
        if ((0, fs_1.existsSync)(localBinary)) {
            return localBinary;
        }
        // Fall back to PATH
        return 'claude';
    }
}
exports.ClaudeCli = ClaudeCli;
