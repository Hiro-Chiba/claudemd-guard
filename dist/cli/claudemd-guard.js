#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const processHookData_1 = require("../hooks/processHookData");
async function run(input) {
    return (0, processHookData_1.processHookData)(input);
}
if (require.main === module) {
    let inputData = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
        inputData += chunk;
    });
    process.stdin.on('end', async () => {
        try {
            const result = await run(inputData);
            console.log(JSON.stringify(result));
        }
        catch (error) {
            console.error('claudemd-guard error:', error);
        }
        finally {
            process.exit(0);
        }
    });
}
