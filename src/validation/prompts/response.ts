export const RESPONSE_FORMAT = `
Respond in the following JSON format only. Do not include any other text.

If there is a violation:
\`\`\`json
{"decision": "block", "reason": "Explanation of the violation"}
\`\`\`

If there is no violation:
\`\`\`json
{"decision": null, "reason": "No violation found"}
\`\`\``
