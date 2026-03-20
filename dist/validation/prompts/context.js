"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrompt = buildPrompt;
const response_1 = require("./response");
function buildPrompt(claudeMdFiles, toolName, toolInput) {
    const rulesSection = claudeMdFiles
        .map((f) => `--- ${f.path} ---\n${f.content}`)
        .join('\n\n');
    const toolSection = JSON.stringify({ tool_name: toolName, tool_input: toolInput }, null, 2);
    return `# CLAUDE.md ルール

${rulesSection}

# 実行されるツール操作

${toolSection}

${response_1.RESPONSE_FORMAT}`;
}
