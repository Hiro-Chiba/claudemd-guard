"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESPONSE_FORMAT = void 0;
exports.RESPONSE_FORMAT = `
以下のJSON形式で回答してください。それ以外のテキストは含めないでください。

違反がある場合:
\`\`\`json
{"decision": "block", "reason": "違反理由の説明"}
\`\`\`

違反がない場合:
\`\`\`json
{"decision": null, "reason": "問題なし"}
\`\`\``;
