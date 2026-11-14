const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { askOpenAI } = require('./openai-helper');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function sendJson(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

async function readRequestBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10000) {
      throw new Error('REQUEST_TOO_LARGE');
    }
  }
  return JSON.parse(body || '{}');
}

async function serveFile(requestPath, response) {
  const requestedPath = requestPath === '/' ? '/index.html' : requestPath;
  const safePath = path.normalize(requestedPath).replace(/^([.][.][\\/])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(500);
    response.end('Server error');
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && requestUrl.pathname === '/api/health') {
      sendJson(response, 200, { ok: true, app: 'Bully Report' });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/analyze') {
      const body = await readRequestBody(request);
      const report = String(body.report || '').trim();
      const stage = body.stage === 'guidance' ? 'guidance' : 'questions';
      const followUp = String(body.followUp || '').trim();

      if (report.length < 5) {
        sendJson(response, 400, { error: 'Please describe what happened in a few words first.' });
        return;
      }

      const result = await askOpenAI({
        report,
        firstName: String(body.firstName || '').trim(),
        grade: String(body.grade || '').trim(),
        teacherName: String(body.teacherName || '').trim(),
        followUp,
        stage,
      });

      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'GET') {
      await serveFile(requestUrl.pathname, response);
      return;
    }

    response.writeHead(405);
    response.end('Method not allowed');
  } catch (error) {
    if (error.message === 'REQUEST_TOO_LARGE') {
      sendJson(response, 413, { error: 'That report is too long. Please use fewer words.' });
      return;
    }

    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: 'Please send the report again.' });
      return;
    }

    sendJson(response, 503, {
      error: 'The AI could not answer right now. Please check the key and your internet connection. If this feels urgent, tell a trusted adult now.',
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Bully Report is running at http://localhost:${PORT}`);
});
