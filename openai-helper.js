const fs = require('node:fs/promises');
const path = require('node:path');

const PROJECT_DIR = __dirname;
const API_MODEL = 'gpt-5.6-luna';
const RUNNING_ON_VERCEL = Boolean(process.env.VERCEL);

let cachedKey = '';
let cachedExpiresAt = 0;

function createError(code, message, fix) {
  const error = new Error(message);
  error.code = code;
  error.fix = fix;
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
    throw createError(
      'ENV_READ_FAILED',
      'The project could not read its local environment file.',
      'Check that .env exists in the project folder and restart the server.',
    );
  }
}

function isPlaceholder(value) {
  return !value || value === 'paste-here' || value === 'paste-your-key-here';
}

function getExpiresAtMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 100000000000 ? value * 1000 : value;
  }

  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clearCachedKey() {
  cachedKey = '';
  cachedExpiresAt = 0;
}

async function requestFreshKey(keygenUrl, keygenToken) {
  const lookupUrl = `${keygenUrl.replace(/\/+$/, '')}/api/lookup-key`;
  let response;
  try {
    response = await fetch(lookupUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keygenToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch (error) {
    throw createError(
      'KEYGEN_NETWORK_ERROR',
      'MindDo could not provide an AI key right now.',
      'Check your MindDo URL, token, and internet connection, then try again.',
    );
  }

  const responseText = await response.text();
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch (error) {
    throw createError(
      'KEYGEN_RESPONSE_INVALID',
      'MindDo returned an invalid AI-key response.',
      'Ask MindDo for a JSON response containing apiKey and expiresAt.',
    );
  }

  if (!response.ok) {
    throw createError(
      'KEYGEN_ERROR',
      'MindDo rejected the AI-key request.',
      'Check that KEYGEN_URL points to MindDo and that KEYGEN_TOKEN is current.',
    );
  }

  const apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';
  const expiresAt = getExpiresAtMs(payload.expiresAt);
  if (!apiKey || !expiresAt) {
    throw createError(
      'KEYGEN_RESPONSE_INVALID',
      'MindDo returned an incomplete AI-key response.',
      'Ask MindDo for JSON containing a non-empty apiKey and a valid expiresAt.',
    );
  }

  if (expiresAt <= Date.now()) {
    throw createError(
      'KEYGEN_KEY_EXPIRED',
      'MindDo returned an AI key that is already expired.',
      'Check the MindDo key service and try again.',
    );
  }

  cachedKey = apiKey;
  cachedExpiresAt = expiresAt;
  return cachedKey;
}

async function getKey(forceRefresh = false) {
  if (!forceRefresh && cachedKey && cachedExpiresAt > Date.now()) {
    return cachedKey;
  }

  if (cachedKey && cachedExpiresAt <= Date.now()) {
    clearCachedKey();
  }

  const localEnv = RUNNING_ON_VERCEL ? {} : await readLocalEnv();
  const keygenUrl = String(process.env.KEYGEN_URL || localEnv.KEYGEN_URL || '').trim();
  const keygenToken = String(process.env.KEYGEN_TOKEN || localEnv.KEYGEN_TOKEN || '').trim();

  if (isPlaceholder(keygenUrl) || isPlaceholder(keygenToken)) {
    throw createError(
      'KEYGEN_CONFIG_MISSING',
      'The MindDo AI-key settings are not filled in yet.',
      'Put your MindDo URL in KEYGEN_URL and your token in KEYGEN_TOKEN in .env, then restart the server.',
    );
  }

  return requestFreshKey(keygenUrl, keygenToken);
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

async function callOpenAI(apiKey, details, brief) {
  try {
    return await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: API_MODEL,
        instructions: `${brief}\n\nAdditional safety rules for Bully Report:\n- You are a helper, not a judge. Never say a person is guilty and never promise that a report is harmless.\n- Treat uncertainty as a reason for adult review. Recommend a trusted adult, counselor, administrator, or school safety team.\n- If there is immediate danger, a weapon, a planned attack, an injury, or a person may hurt themselves or someone else, tell the user to move to safety and call 911 or local emergency services. Do not tell them to confront anyone.\n- Use calm, kind language. Do not shame, insult, threaten, or repeat hateful content more than needed.\n- Never ask for a full name, address, phone number, password, photo, or exact location. A first name and grade are enough.\n- Do not invent laws or legal conclusions. Say that school policy and local law may vary and that a trusted adult should help.\n- Keep responses short and easy for a middle-school student to understand.`,
        input: buildUserMessage(details),
        max_output_tokens: 300,
      }),
    });
  } catch (error) {
    throw createError(
      'NETWORK_ERROR',
      'The AI could not be reached right now.',
      'Check your internet connection and try again.',
    );
  }
}

async function askOpenAI(details) {
  const brief = await readBrief();
  let apiKey = await getKey();
  let response = await callOpenAI(apiKey, details, brief);

  if (response.status === 401 || response.status === 403) {
    clearCachedKey();
    apiKey = await getKey(true);
    response = await callOpenAI(apiKey, details, brief);
  }

  if (!response.ok) {
    throw createError(
      'AI_ERROR',
      'The AI could not answer right now.',
      'Check OpenAI access and the MindDo key settings, then try again.',
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw createError(
      'AI_RESPONSE_INVALID',
      'The AI returned an invalid response.',
      'Try again later and check the OpenAI response service.',
    );
  }

  const text = typeof data.output_text === 'string'
    ? data.output_text.trim()
    : (data.output || [])
      .flatMap((item) => item.content || [])
      .map((item) => item.text || '')
      .join(' ')
      .trim();

  if (!text) {
    throw createError(
      'EMPTY_RESPONSE',
      'The AI returned no answer.',
      'Try again later and check the OpenAI response service.',
    );
  }

  return { text, model: '5.6 Luna' };
}

module.exports = { askOpenAI, getKey };
