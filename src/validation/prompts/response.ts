export const RESPONSE_FORMAT = `
Respond in the following JSON format only. Do not include any other text.

If there is a violation:
\`\`\`json
{"decision": "block", "reason": "Rule \\"<quote>\\" forbids this. Next correct step: <what to do instead>."}
\`\`\`

Example block reason:
"CLAUDE.md states \\"Do not delete production data without confirmation\\".
Next correct step: stop the destructive command and ask the user before
running anything that targets the production database."

If there is no violation:
\`\`\`json
{"decision": null, "reason": "No violation found"}
\`\`\``
