const { askOpenAI } = require('../openai-helper');

function sendJson(response, status, body) {
  response.status(status).json(body);
}

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    sendJson(response, 405, { error: 'Only POST is supported for this AI request.' });
    return;
  }

  try {
    const body = typeof request.body === 'string'
      ? JSON.parse(request.body || '{}')
      : (request.body || {});
    const report = String(body.report || '').trim();
    const stage = body.stage === 'guidance' ? 'guidance' : 'questions';

    if (report.length < 5) {
      sendJson(response, 400, { error: 'Please describe what happened in a few words first.' });
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
    sendJson(response, 503, {
      error: 'The AI could not answer right now. Please check the key and your internet connection. If this feels urgent, tell a trusted adult now.',
    });
  }
};
