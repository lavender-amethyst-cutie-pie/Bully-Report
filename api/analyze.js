const { askOpenAI } = require('../openai-helper');

function sendJson(response, status, body) {
  response.status(status).json(body);
}

function sendError(response, status, error, fallbackMessage, fallbackFix) {
  const publicError = {
    message: typeof error?.message === 'string' ? error.message : fallbackMessage,
    fix: typeof error?.fix === 'string' ? error.fix : fallbackFix,
  };
  console.error(publicError.fix);
  sendJson(response, status, { error: publicError });
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendError(
      response,
      405,
      null,
      'Only POST is supported for this AI request.',
      'Send the AI request with the POST method.',
    );
    return;
  }

  try {
    const body = typeof request.body === 'string'
      ? JSON.parse(request.body || '{}')
      : (request.body || {});
    const report = String(body.report || '').trim();
    const stage = body.stage === 'guidance' ? 'guidance' : 'questions';

    if (report.length < 5) {
      sendError(
        response,
        400,
        null,
        'Please describe what happened in a few words first.',
        'Add a few words to the report and submit it again.',
      );
      return;
    }

    const result = await askOpenAI({
      report,
      firstName: String(body.firstName || '').trim(),
      grade: String(body.grade || '').trim(),
      teacherName: String(body.teacherName || '').trim(),
      followUp: String(body.followUp || '').trim(),
      stage,
    });

    sendJson(response, 200, result);
  } catch (error) {
    sendError(
      response,
      503,
      error,
      'The AI could not answer right now.',
      'Check the MindDo settings and internet connection, then try again.',
    );
  }
};
