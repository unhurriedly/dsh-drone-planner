/**
 * Host half of the 视锥航线 (drone-planner) panel.
 *
 * The demo is one self-contained `page/index.html`: no build step, no network
 * access. It is served from the Harness web server as a same-origin page so the
 * Client panel can frame it and every demo feature (canvas, pointer editing,
 * Blob download) keeps working exactly as when the file is opened locally.
 *
 * Route:
 *   GET|HEAD /dsh-drone-planner/            -> page/index.html
 *   GET|HEAD /dsh-drone-planner/index.html  -> page/index.html
 *
 * The file is read per request and sent with `cache-control: no-store`, so
 * editing the bundled demo and reloading the panel shows the change without
 * reinstalling the plugin.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const inject = ['webServer']

const PREFIX = '/dsh-drone-planner'
const PAGE_FILE = fileURLToPath(new URL('./page/index.html', import.meta.url))
const PAGE_PATHS = new Set([PREFIX, `${PREFIX}/index.html`])

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.statusCode = status
  res.setHeader('content-type', contentType)
  res.setHeader('content-length', String(Buffer.byteLength(body)))
  res.setHeader('cache-control', 'no-store')
  res.setHeader('x-content-type-options', 'nosniff')
  res.end(body)
}

function pathnameOf(req) {
  try {
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
    return path.length > 1 ? path.replace(/\/+$/, '') : path
  } catch {
    return ''
  }
}

export function apply(ctx) {
  async function handler(req, res) {
    const method = req.method ?? 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
      res.setHeader('allow', 'GET, HEAD')
      sendText(res, 405, 'method not allowed')
      return
    }
    if (!PAGE_PATHS.has(pathnameOf(req))) {
      sendText(res, 404, 'not found')
      return
    }
    try {
      const page = await readFile(PAGE_FILE)
      res.statusCode = 200
      res.setHeader('content-type', 'text/html; charset=utf-8')
      res.setHeader('content-length', String(page.byteLength))
      res.setHeader('cache-control', 'no-store')
      res.setHeader('x-content-type-options', 'nosniff')
      res.end(method === 'HEAD' ? undefined : page)
    } catch (error) {
      console.warn(`[drone-planner] ${error instanceof Error ? error.message : String(error)}`)
      sendText(res, 500, 'drone-planner page is missing')
    }
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: PREFIX, handler }),
    'drone-planner: local demo page route',
  )
}
