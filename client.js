window.__ModuleLoader__.load({
  id: '@local/drone-planner',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useRef, useState } = React

    const NS = 'drone.planner'
    const PANEL_ID = 'drone-planner'
    const PAGE_URL = '/dsh-drone-planner/'

    const zh = {
      panel: '智飞航线规划',
      loading: '正在载入本地航线 Demo…',
      failedTitle: 'Demo 页面没有载入',
      failedBody:
        '宿主没有在 /dsh-drone-planner 返回页面。请重试；如果仍然失败，确认「智飞航线规划」插件已启用且 page/index.html 还在插件目录里。',
      retry: '重试',
      openExternal: '在新标签打开',
      frameTitle: '智飞航线规划 · 工作台',
    }

    const en = {
      panel: 'Smart flight route planner',
      loading: 'Loading the local route demo…',
      failedTitle: 'The demo page did not load',
      failedBody:
        'The host did not return the page at /dsh-drone-planner. Retry; if it keeps failing, check that the “Drone route lab” plugin is enabled and page/index.html still exists in its package directory.',
      retry: 'Retry',
      openExternal: 'Open in new tab',
      frameTitle: 'Smart flight route planner',
    }

    const CSS = `
.dp-root{position:relative;box-sizing:border-box;display:flex;flex-direction:column;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary)}
.dp-root *,.dp-root *::before,.dp-root *::after{box-sizing:border-box}
.dp-frame{display:block;flex:1;width:100%;height:100%;min-width:0;min-height:0;border:0;background:#f7f9fd}
.dp-center{display:flex;flex:1;align-items:center;justify-content:center;padding:28px;overflow:auto}
.dp-loading{display:flex;flex-direction:column;align-items:center;gap:12px;font-size:12.5px;color:var(--dsw-alias-label-secondary)}
.dp-spin{width:20px;height:20px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-brand-primary);animation:dp-spin .8s linear infinite}
@keyframes dp-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.dp-spin{animation-duration:2s}}
.dp-card{width:100%;max-width:460px}
.dp-card-title{margin:0 0 8px;font-size:15px;font-weight:600;line-height:1.4}
.dp-card-body{margin:0;font-size:12.5px;line-height:1.75;color:var(--dsw-alias-label-secondary)}
.dp-card-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.dp-btn{display:inline-flex;align-items:center;height:30px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-brand-primary);color:#fff;font:inherit;font-size:12px;line-height:1;cursor:pointer}
.dp-btn:hover{filter:brightness(1.06)}
.dp-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dp-btn.ghost{border-color:var(--dsw-alias-border-l1);background:transparent;color:var(--dsw-alias-label-primary)}
.dp-btn.ghost:hover{background:var(--dsw-alias-bg-layer-2)}
`

    function DronePage({ t }) {
      const [status, setStatus] = useState('checking')
      const [nonce, setNonce] = useState(0)
      const alive = useRef(true)

      useEffect(() => {
        alive.current = true
        setStatus('checking')
        fetch(PAGE_URL, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' })
          .then((response) => {
            if (alive.current) setStatus(response.ok ? 'ready' : 'error')
          })
          .catch(() => {
            if (alive.current) setStatus('error')
          })
        return () => {
          alive.current = false
        }
      }, [nonce])

      const openExternal = () => {
        window.open(PAGE_URL, '_blank', 'noopener,noreferrer')
      }

      let body
      if (status === 'ready') {
        body = h('iframe', {
          key: nonce,
          className: 'dp-frame',
          src: PAGE_URL,
          title: t('frameTitle'),
          referrerPolicy: 'no-referrer',
          allow: 'fullscreen; clipboard-write',
        })
      } else if (status === 'checking') {
        body = h(
          'div',
          { className: 'dp-center' },
          h('div', { className: 'dp-loading' }, h('span', { className: 'dp-spin' }), h('span', null, t('loading'))),
        )
      } else {
        body = h(
          'div',
          { className: 'dp-center' },
          h(
            'div',
            { className: 'dp-card' },
            h('p', { className: 'dp-card-title' }, t('failedTitle')),
            h('p', { className: 'dp-card-body' }, t('failedBody')),
            h(
              'div',
              { className: 'dp-card-actions' },
              h('button', { type: 'button', className: 'dp-btn', onClick: () => setNonce((n) => n + 1) }, t('retry')),
              h('button', { type: 'button', className: 'dp-btn ghost', onClick: openExternal }, t('openExternal')),
            ),
          ),
        )
      }

      return h(
        React.Fragment,
        null,
        h('style', { 'data-drone-planner': '' }, CSS),
        h('div', { className: 'dp-root' }, body),
      )
    }

    function DroneIcon({ size = 20 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block' },
        },
        h('circle', { cx: 6.6, cy: 6.6, r: 2.8, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('circle', { cx: 17.4, cy: 6.6, r: 2.8, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('circle', { cx: 6.6, cy: 17.4, r: 2.8, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('circle', { cx: 17.4, cy: 17.4, r: 2.8, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('rect', { x: 9.1, y: 9.1, width: 5.8, height: 5.8, rx: 1.7, stroke: 'currentColor', strokeWidth: 1.6 }),
        h('path', {
          d: 'M8.7 8.1 9.6 9M15.3 8.1 14.4 9M8.7 15.9 9.6 15M15.3 15.9 14.4 15',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
        }),
      )
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'drone-planner: dictionaries')
      const t = ctx.locale.bind(NS)

      ctx.slots.inject('main', () =>
        ctx.slots.register({ name: 'main', key: PANEL_ID, locale: NS, inject: () => ({ t }) }, DronePage),
      )

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          { name: 'sidebar.panellist', id: PANEL_ID, order: 30, locale: NS, label: () => t('panel') },
          DroneIcon,
        ),
      )
    }

    return { inject: ['slots', 'locale'], apply }
  },
})
