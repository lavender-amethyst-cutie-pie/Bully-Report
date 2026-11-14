const fs = require('node:fs/promises');
const path = require('node:path');

const PROJECT_DIR = __dirname;
const API_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

async function readSecretKey() {
  const envText = await fs.readFile(path.join(PROJECT_DIR, '.env'), 'utf8');
  const line = envText
    .split(/\r?\n/)
    .find((item) => /^\s*OPENAI_API_KEY\s*=/.test(item));
  const key = line ? line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '') : '';

  if (!key || key === 'paste-your-key-here') {
    const error = new Error('KEY_MISSING');
    error.code = 'KEY_MISSING';
    throw error;
  }

  return key;
}

async function readBrief() {
  return fs.readFile(path.join(PROJECT_DIR, 'BRIEF.md'), 'utf8');
}

function buildUserMessage({ report, firstName, grade, teacherName, followUp, stage }) {
  const stageInstruction = stage === 'questions'
    ? 'This is the first turn. Ask no more than two short questions that help understand urgency. Do not accuse anyone.'
    : 'This is the final guidance turn. Use the answers to give about four short sentences explaining the safest next step.';

  return [
    stageInstruction,
    `Report: ${report}`,
    `Person first name (optional): ${firstName || 'not provided'}`,
    `Grade (optional): ${grade || 'not provided'}`,
    `Teacher name (optional): ${teacherName || 'not provided'}`,
    `User follow-up (optional): ${followUp || 'not provided'}`,
  ].join('\n');
}

async function askOpenAI(details) {
  const [apiKey, brief] = await Promise.all([readSecretKey(), readBrief()]);
  const safetyRules = `

Additional safety rules for Bully Report:
- You are a helper, not a judge. Never say a person is guilty and never promise that a report is harmless.
- Treat uncertainty as a reason for adult review. Recommend a trusted adult, counselor, administrator, or school safety team.
- If there is immediate danger, a weapon, a planned attack, an injury, or a person may hurt themselves or someone else, tell the user to move to safety and call 911 or local emergency services. Do not tell them to confront anyone.
- Use calm, kind language. Do not shame, insult, threaten, or repeat hateful content more than needed.
- Never ask for a full name, address, phone number, password, photo, or exact location. A first name and grade are enough.
- Do not invent laws or legal conclusions. Say that school policy and local law may vary and that a trusted adult should help.
- Keep responses short and easy for a middle-school student to understand.
`;

  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: API_MODEL,
        instructions: `${brief}${safetyRules}`,
        input: buildUserMessage(details),
        max_output_tokens: 300,
      }),
    });
  } catch (error) {
    const networkError = new Error('NETWORK_ERROR');
    networkError.code = 'NETWORK_ERROR';
    throw networkError;
  }

  if (!response.ok) {
    const error = new Error(response.status === 401 || response.status === 403 ? 'KEY_INVALID' : 'AI_ERROR');
    error.code = error.message;
    throw error;
  }

  const data = await response.json();
  const text = typeof data.output_text === 'string'
    ? data.output_text.trim()
    : (data.output || [])
      .flatMap((item) => item.content || [])
      .map((item) => item.text || '')
      .join(' ')
      .trim();

  if (!text) {
    const error = new Error('EMPTY_RESPONSE');
    error.code = 'EMPTY_RESPONSE';
    throw error;
  }

  return { text, model: '5.6 Luna' };
}

module.exports = { askOpenAI };
