"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validator = validator;
const context_1 = require("./prompts/context");
async function validator(claudeMdFiles, toolName, toolInput, modelClient) {
    try {
        const prompt = (0, context_1.buildPrompt)(claudeMdFiles, toolName, toolInput);
        const response = await modelClient.ask(prompt);
        return parseModelResponse(response);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            decision: undefined,
            reason: `Validation error (allowing operation): ${errorMessage}`,
        };
    }
}
function parseModelResponse(response) {
    const jsonString = extractJsonString(response);
    const parsed = JSON.parse(jsonString);
    return {
        decision: parsed.decision === 'block' ? 'block' : undefined,
        reason: parsed.reason ?? '',
    };
}
function extractJsonString(response) {
    if (!response) {
        throw new Error('No response from model');
    }
    const jsonFromCodeBlock = extractFromJsonCodeBlock(response);
    if (jsonFromCodeBlock)
        return jsonFromCodeBlock;
    const jsonFromGenericBlock = extractFromGenericCodeBlock(response);
    if (jsonFromGenericBlock)
        return jsonFromGenericBlock;
    const plainJson = extractPlainJson(response);
    if (plainJson)
        return plainJson;
    return response;
}
function extractFromJsonCodeBlock(response) {
    const startPattern = '```json';
    const endPattern = '```';
    let startIndex = 0;
    let lastBlock = null;
    let blockStart = response.indexOf(startPattern, startIndex);
    while (blockStart !== -1) {
        const contentStart = blockStart + startPattern.length;
        const blockEnd = response.indexOf(endPattern, contentStart);
        if (blockEnd === -1)
            break;
        lastBlock = response.substring(contentStart, blockEnd).trim();
        startIndex = blockEnd + endPattern.length;
        blockStart = response.indexOf(startPattern, startIndex);
    }
    return lastBlock;
}
function extractFromGenericCodeBlock(response) {
    const startPattern = '```';
    let lastValidBlock = null;
    let searchFrom = 0;
    while (true) {
        const blockStart = response.indexOf(startPattern, searchFrom);
        if (blockStart === -1)
            break;
        let contentStart = blockStart + startPattern.length;
        while (contentStart < response.length && /\s/.test(response[contentStart])) {
            contentStart++;
        }
        const blockEnd = response.indexOf(startPattern, contentStart);
        if (blockEnd === -1)
            break;
        const content = response.substring(contentStart, blockEnd).trim();
        if (isValidJson(content)) {
            lastValidBlock = content;
        }
        searchFrom = blockEnd + startPattern.length;
    }
    return lastValidBlock;
}
function extractPlainJson(response) {
    const pattern = /\{[^{}]*"decision"[^{}]*"reason"[^{}]*}|\{[^{}]*"reason"[^{}]*"decision"[^{}]*}/g;
    const matches = response.match(pattern);
    if (!matches)
        return null;
    const lastMatch = matches[matches.length - 1];
    return isValidJson(lastMatch) ? lastMatch : null;
}
function isValidJson(str) {
    try {
        JSON.parse(str);
        return true;
    }
    catch {
        return false;
    }
}
