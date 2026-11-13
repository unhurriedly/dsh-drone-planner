# 视锥航线 · Harness 工作台插件

把一份单文件的无人机视锥航线 Demo 作为 Harness Web UI 的中央面板打开。
面板内容就是那份原本用浏览器直接打开的 `index.html`（已随插件打包到 `page/index.html`），
因此绘制飞行区域、航线预设、生成航线、逐点编辑、三维视锥、超视距裁切与重叠区域都与本地打开完全一致。

侧边栏图标排在已有图标之后，图标悬停显示「视锥航线」。

## 工作方式

- **Host 半区**（`index.js`）在 Harness Web 服务器上注册一条只读路由：

  ```
  GET|HEAD /dsh-drone-planner/            -> page/index.html
  GET|HEAD /dsh-drone-planner/index.html  -> page/index.html
  ```

  Demo 是单文件、离线、自包含的 HTML（无 CDN、无外部字体、无图片请求），所以宿主只做
  「把这份文件按 `text/html` 发回去」这一件事。文件每次请求时读取，响应带
  `cache-control: no-store`：改完 `page/index.html` 后刷新面板即可生效，不需要重装插件。

- **Client 半区**（`client.js`）注册 `sidebar.panellist` 菜单图标与同 id 的 `main` 面板。
  面板先对 `/dsh-drone-planner/` 做一次 `HEAD` 自检：

  - 正常 → 整个面板铺满同源 iframe，Demo 全屏运行；
  - 路由缺失 → 显示一张错误卡片，带「重试」和「在新标签打开」。

## 为什么用 iframe

Demo 是一套自带配色、画布布局和交互的独立页面（浅色主题、Canvas 等轴三维视图），
不是按 Harness 主题 token 写的页面。要「功能与本地打开一致」，最稳的做法是原样托管、原样嵌入；
代价是面板内容不跟随 Harness 的深色主题——这是 Demo 自身的设计，不是插件能改的。

如果你更想要一个跟随主题的原生面板，那需要把 Demo 的渲染逻辑重写成 React 组件，属于另一个工作量级。

## 文件

| 文件 | 作用 |
|---|---|
| `index.js` | Host：只读 HTML 路由 |
| `client.js` | Client：侧边栏图标 + 中央面板（iframe + 自检） |
| `page/index.html` | Demo 页面副本（单文件、离线、自包含） |
| `locale/zh.json`、`locale/en.json` | 插件管理里显示的标题与说明 |
| `icon.svg` | 侧边栏与详情页图标 |

产品构成分三部分：**航线预设**（高度模式、全局速度、偏航角模式、可选机身姿态、停留、结束动作、超视距裁切距离、间距、起飞点经纬度）、**航线规划**（航线覆盖率、观察航点数量、连续航程、航点间距、采样指标、经纬度航点表）、**航点编辑**（坐标/经纬度、逐点高度、机身水平角、云台俯仰角、变焦、视锥明细）。

本仓库包含运行所需的页面、插件代码与 `check-redesign.cjs` 验收脚本（`node check-redesign.cjs`）；Demo 早期的导出 JSON、任务文本解析等能力已按改版规格移除。

## 环境要求

- 已安装并运行 DeepSeek Harness（带 Web UI 与 `plugin_manager`）；
- 无构建步骤、无 npm 依赖，纯 ESM + 单文件 HTML。

## 安装

```bash
git clone https://github.com/unhurriedly/dsh-drone-planner.git
plugin_manager install_bundle ~/code/dsh-drone-planner
```

把 `~/code/dsh-drone-planner` 换成实际克隆路径。安装后无需重启，侧边栏出现「视锥航线」条目。
自检路由（端口以实际 Harness Web 地址为准）：

```bash
curl -I http://127.0.0.1:<harness-port>/dsh-drone-planner/
```

## 更新 Demo 内容

用新的 `index.html` 覆盖 `page/index.html`（本地目录安装是链接方式，覆盖即生效），
然后在面板里刷新页面，或重新打开「视锥航线」。

## 安全边界

- 只注册 `GET` / `HEAD`，只读，无写入路径。
- 只返回 `page/index.html` 一个文件，路径白名单固定，不接受参数拼路径。
- 路由由 Harness Web 服务器提供，只监听本机回环地址。
- 面板的「在新标签打开」指向同源的 `/dsh-drone-planner/`，不跳转外部站点。
