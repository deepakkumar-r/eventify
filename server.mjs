import { createReadStream, promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};
/** Only browser assets are public; server code, tests and config are never served. */
const PUBLIC_FILES = new Set(['index.html', 'styles.css']);
const PUBLIC_DIRS = ['src'];
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Map a request URL to a file path inside the public allowlist.
 * @param {string} requestUrl
 * @returns {string | null} absolute path, or null when forbidden
 * @throws {URIError} on malformed percent-encoding
 */
export function getFilePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  if (pathname.includes('\0')) return null;
  const filePath = normalize(join(root, pathname === '/' ? '/index.html' : pathname));
  const relativePath = relative(root, filePath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) return null;
  const [first] = relativePath.split(sep);
  const isPublic = PUBLIC_FILES.has(relativePath) || (PUBLIC_DIRS.includes(first) && extname(relativePath) === '.js');
  return isPublic ? filePath : null;
}

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS, ...extraHeaders });
  response.end(body);
}

/** Build the static file server. Exported so tests can start it on a random port. */
export function createAppServer() {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      send(response, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
      return;
    }

    let filePath;
    try {
      filePath = getFilePath(request.url);
    } catch {
      send(response, 400, 'Bad request');
      return;
    }
    if (!filePath) {
      send(response, 403, 'Forbidden');
      return;
    }

    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
      response.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
        'Cache-Control': 'no-cache',
        ...SECURITY_HEADERS,
      });
      if (request.method === 'HEAD') response.end();
      else createReadStream(filePath).pipe(response);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') send(response, 404, 'Not found');
      else send(response, 500, 'Internal server error');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8080;
  const server = createAppServer();
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Set PORT to use another port.`);
      process.exitCode = 1;
      return;
    }
    throw error;
  });
  server.listen(port, () => console.log(`Event planner running at http://localhost:${port}`));
}
