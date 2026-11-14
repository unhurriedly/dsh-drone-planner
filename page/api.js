/**
 * 视锥航线 · 嵌入加载器
 *
 * 宿主页面引入本文件后即可用 `OttoPlexDronePlanner` 挂载与热更新配置：
 *
 *   <div id="drone"></div>
 *   <script src="/dsh-drone-planner/api.js"></script>
 *   <script>
 *     var app = OttoPlexDronePlanner.mount('#drone', { accent: '#159b79', size: 15 })
 *     app.apply({ title: '巡检航线' })   // 不重新加载即可改主题/文案
 *   </script>
 *
 * 配置通过 URL `?cfg=` 首次下发，后续通过 postMessage 送达，因此不会丢状态。
 */
(function (global) {
  'use strict'

  var VERSION = '1.0.0'

  function encode(cfg) {
    var bytes = new TextEncoder().encode(JSON.stringify(cfg))
    var bin = ''
    for (var i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i])
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  /** 本脚本自身所在目录，即插件页面的根路径。 */
  function base() {
    var script = document.currentScript
    if (script && script.src) return script.src.replace(/\/api\.js.*$/, '/')
    return '/dsh-drone-planner/'
  }

  function mount(target, config) {
    var host = typeof target === 'string' ? document.querySelector(target) : target
    if (!host) throw new Error('OttoPlexDronePlanner.mount: 目标容器不存在')
    var cfg = Object.assign({}, config || {})
    var iframe = document.createElement('iframe')
    iframe.src = base() + (Object.keys(cfg).length ? '?cfg=' + encode(cfg) : '')
    iframe.title = '视锥航线'
    iframe.style.cssText = 'display:block;width:100%;height:' + (cfg.height || 900) + 'px;border:0'
    iframe.setAttribute('allow', 'fullscreen')
    host.innerHTML = ''
    host.appendChild(iframe)

    var api = {
      iframe: iframe,
      apply: function (patch) {
        cfg = Object.assign(cfg, patch || {})
        try {
          iframe.contentWindow.postMessage({ type: 'otp:config', cfg: cfg }, '*')
        } catch (error) {
          iframe.src = base() + '?cfg=' + encode(cfg)
        }
        return api
      },
      getConfig: function () {
        return Object.assign({}, cfg)
      },
      destroy: function () {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
      }
    }
    return api
  }

  global.OttoPlexDronePlanner = { version: VERSION, mount: mount, encode: encode }
})(window)
