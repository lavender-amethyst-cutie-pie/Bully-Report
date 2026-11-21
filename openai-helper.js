const fs = require('node:fs/promises');
const path = require('node:path');

const PROJECT_DIR = process.cwd();
const API_MODEL = 'gpt-5.6-luna';
const RUNNING_ON_VERCEL = Boolean(process.env.VERCEL);

function createError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseDotEnv(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((match) => [
        match[1],
        match[2].replace(/^['"]|['"]$/g, ''),
      ]),
  );
}

async function readLocalEnv() {
  try {
    const envText = await fs.readFile(path.join(PROJECT_DIR, '.env'), 'utf8');
    return parseDotEnv(envText);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function firstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function extractKey(payload) {
  if (typeof payload === 'string') {
    return payload.trim();
  }

  if (!payload || typeof payload !== 'object') {
    return '';
  }

  return firstString(
    payload.key,
    payload.apiKey,
    payload.aiKey,
    payload.secret,
    payload.value,
    payload.token,
    payload.data?.key,
    payload.data?.apiKey,
    payload.data?.aiKey,
    payload.data?.attributes?.key,
    payload.data?.attributes?.apiKey,
    payload.data?.attributes?.value,
  );
}

async function getKey() {
  const localEnv = RUNNING_ON_VERCEL ? {} : await readLocalEnv();
  const keygenUrl = String(
    process.env.KEYGEN_URL || localEnv.KEYGEN_URL || '',
  ).trim();
  const keygenToken = String(
    process.env.KEYGEN_TOKEN || localEnv.KEYGEN_TOKEN || '',
  ).trim();

  if (keygenUrl || keygenToken) {
    if (!keygenUrl || !keygenToken) {
      throw createError('KEYGEN_CONFIG_MISSING');
    }

    let response;
    try {
      response = await fetch(keygenUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${keygenToken}`,
          Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
        },
      });
    } catch (error) {
      throw createError('KEYGEN_NETWORK_ERROR');
    }

    const responseText = await response.text();
    let payload = responseText;
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      // A plain-text key is also supported.
    }

    if (!response.ok) {
      throw createError('KEYGEN_ERROR');
    }

    const key = extractKey(payload);
    if (!key || key === 'paste-your-key-here') {
      throw createError('KEYGEN_KEY_MISSING');
    }

    return key;
  }

  if (RUNNING_ON_VERCEL) {
    throw createError('KEYGEN_CONFIG_MISSING');
  }

  // Local-only compatibility for the existing ignored .env file. Vercel never
  // reads this fallback; its key must come through getKey() from Keygen.
  const localOpenAIKey = String(
    process.env.OPENAI_API_KEY || localEnv.OPENAI_API_KEY || '',
  ).trim();

  if (!localOpenAIKey || localOpenAIKey === 'paste-your-key-here') {
    throw createError('KEY_MISSING');
  }

  return localOpenAIKey;
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

function hasUrgentSignal(report) {
  return /\b(weapon|gun|knife|bomb|attack|planned attack|injur(?:y|ed)|bleeding|emergency|kill(?:ed|ing)?|suicide|self[- ]harm|hurt (?:myself|someone|me|them)|going to hurt)\b/i.test(report);
}

function createLocalSafetyResponse({ report, stage }) {
  const urgent = hasUrgentSignal(report);
  if (stage === 'guidance' && urgent) {
    return {
      text: 'Move to a safe place and do not confront the person. Tell a trusted adult, school safety staff, or emergency services right now; call 911 in the United States if someone may be hurt. Keep any messages or details that may help an adult understand what happened. This guide cannot decide how serious the situation is, so an adult should review it immediately.',
      model: 'Local safety guide',
      offline: true,
    };
  }

  if (stage === 'guidance') {
    return {
      text: 'This situation is worth sharing with a trusted adult, even if you are unsure whether it was a joke. Tell them what happened, when it happened, and how it made you feel. Do not confront the person alone; a teacher, counselor, or school safety staff member can help decide what to do next. If you feel in immediate danger, move to safety and call 911 or local emergency services.',
      model: 'Local safety guide',
      offline: true,
    };
  }

  return {
    text: urgent
      ? 'Are you in immediate danger right now, or could someone be hurt soon? What happened most recently, and which trusted adult can you tell right now?'
      : 'What happened most recently, and did anyone threaten, touch, or injure someone? Which trusted adult could you tell today, such as a teacher, counselor, or parent?',
    model: 'Local safety guide',
    offline: true,
  };
}

function canUseLocalSafetyGuide(error) {
  return [
    'AI_ERROR',
    'EMPTY_RESPONSE',
    'KEYGEN_CONFIG_MISSING',
    'KEYGEN_ERROR',
    'KEYGEN_KEY_MISSING',
    'KEYGEN_NETWORK_ERROR',
    'KEY_INVALID',
    'KEY_MISSING',
    'NETWORK_ERROR',
  ].includes(error?.code);
}

async function askOpenAI(details) {
  try {
    return await askOpenAIOnline(details);
  } catch (error) {
    if (canUseLocalSafetyGuide(error)) {
      return createLocalSafetyResponse(details);
    }
    throw error;
  }
}

async function askOpenAIOnline(details) {
  const [apiKey, brief] = await Promise.all([getKey(), readBrief()]);
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

  return { text, model: '5.6 Luna', offline: false };
}

module.exports = { askOpenAI, getKey };
