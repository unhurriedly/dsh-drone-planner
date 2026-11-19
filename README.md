# 智飞航线规划 · DeepSeek Harness 工作台插件

把无人机航线规划工作台作为 **DeepSeek Harness Web UI** 的中央面板打开。同一个页面里用 tab
分成 **航线规划** 与 **开发配置** 两个模块，后者用一段前端代码维护主题/字体/文案/尺寸，并复制接入代码。

已在 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 插件市场收录（`tools` 分类），可直接在市场里搜索安装，见[安装](#方式一插件市场安装推荐)。

单页两 tab（结构参考 vision-model 的 `module-tabs`）：

| Tab | 地址 | 用途 |
| --- | --- | --- |
| 航线规划 | `/dsh-drone-planner/`、`/dsh-drone-planner/?tab=planner` | 业务界面：飞行区域、航线预设、航线规划、航点编辑 |
| 开发配置 | `/dsh-drone-planner/?tab=dev` | 配置代码、安装/引用/API 代码复制 |

旧的 `/dsh-drone-planner/dev.html` 路由仍然保留，只做跳转到 `?tab=dev`。

「立即执行」按钮属于**航线规划** tab，位于画布工具条右侧（俯视 / 三维切换旁边，
与目标范围摘要、规划状态同一行）：看到航线后就在同一视角里执行。它是界面示意，
点击只提示不会执行真实飞行。

面板内容就是 `page/index.html` 本身（单文件、离线、自包含），所以画布绘制、航线生成、
逐点编辑、三维视锥、超视距裁切、重叠区域与风险评估都与浏览器直接打开完全一致。

> 版本 1.1.0 起：产品名改为「智飞航线规划」，新增开发者模式与 `api.js` 嵌入加载器。
> 1.1.1 修正面板自身字典里的旧名「视锥航线」。
> **1.2.0**：原「开发者模式」独立页并入正式页面，成为第二个 tab「开发配置」；
> `dev.html` 改为跳转入口，不再维护两份页面。

## 在 DeepSeek Harness 中引用

插件已收录进 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 插件市场（`tools` 分类），
仓库：<https://github.com/unhurriedly/dsh-drone-planner>。

包名 `dsh-drone-planner`，`package.json` 声明 `dsh.bundle`（`cordis.patch.yml`）与 `dsh.client`；
**没有依赖，也没有构建脚本**，安装不触发 `allowBuilds` 授权。

### 方式一：插件市场安装（推荐）

**Harness Desktop**：打开 **设置 → 插件**，切到 **插件市场** 标签（dsh 0.2.1 起也在 Plugins 页），
搜索 `智飞航线规划` 或 `dsh-drone-planner`，点安装。装完侧边栏即出现图标，无需重启。

**自建 profile / `dsh web`**：profile 装有 `dshmarket` 时同样可从「插件市场」搜索安装；
没装市场就走方式二。

### 方式二：命令行从 GitHub 安装

```bash
dsh plugin --profile <profile> add github:unhurriedly/dsh-drone-planner
```

- `<profile>` 换成实际 profile：Desktop 用 `desktop`，`dsh web` 默认 `web`；
- **Desktop 用户请优先用方式一**：在终端里往 `web` profile 安装不会出现在 Desktop 里，
  因为 Desktop 管理的是 `desktop` profile。

### 方式三：本地克隆（开发或需要改代码时）

本地目录安装是**符号链接**，改完仓库里的文件即时生效：

```bash
git clone https://github.com/unhurriedly/dsh-drone-planner.git
```

然后在 Harness 里让 agent 用 `plugin_manager` 安装该**绝对路径**（这是插件管理工具，不是 shell 命令）：

```
plugin_manager install_bundle /绝对路径/dsh-drone-planner
```

等价命令行写法：

```bash
dsh plugin --profile <profile> add /绝对路径/dsh-drone-planner
```

### 验证安装

- 侧边栏出现「智飞航线规划」图标，点击即在工作台中央面板打开正式页面；
- 两条路由可访问（端口以实际 Harness Web 地址为准）：

```bash
curl -I http://127.0.0.1:<harness-port>/dsh-drone-planner/
curl -I "http://127.0.0.1:<harness-port>/dsh-drone-planner/?tab=dev"
```

### 已安装时的更新

```bash
cd dsh-drone-planner && git pull
```

然后重新安装以刷新版本与面板元数据：市场里点「更新」，或重复一次上面的安装命令。

- **只改了 `page/` 下的页面/脚本**（`index.html`、`dev.html`、`api.js`）：刷新面板即可，无需重装；
  这些文件是逐请求读取并带 `cache-control: no-store`。
- **改了 `index.js` 的路由、`client.js`、`package.json`、locale 或图标**：需要重新加载插件
  （停用再启用，或重装），因为路由表与面板注册在插件加载时建立。

### 面板如何工作

- **Host 半区**（`index.js`）向 Harness Web 服务器注册只读路由：

  ```
  GET|HEAD /dsh-drone-planner/            -> page/index.html   正式页面
  GET|HEAD /dsh-drone-planner/index.html  -> page/index.html
  GET|HEAD /dsh-drone-planner/dev.html    -> page/dev.html     旧入口，跳转到 ?tab=dev
  GET|HEAD /dsh-drone-planner/dev         -> page/dev.html
  GET|HEAD /dsh-drone-planner/api.js      -> page/api.js       嵌入加载器
  ```

  路径白名单固定映射到 `page/` 下三个文件，不做参数拼路径。

- **Client 半区**（`client.js`）注册 `sidebar.panellist` 图标与同 id 的 `main` 面板；面板先对
  `/dsh-drone-planner/` 做一次 `HEAD` 自检，正常则铺满同源 iframe，路由缺失则显示带「重试」的错误卡片。

## 开发配置（第二个 tab）

地址：`http://127.0.0.1:<harness-port>/dsh-drone-planner/?tab=dev`（旧 `dev.html` 会跳到这里）

点顶部 tab 或直接访问 `?tab=dev` 即可进入，**不离开当前页面**：

1. **配置代码**（左）：一份 **前端代码形式** 的配置对象，输入即生效（350 ms 防抖）。
   解析失败会标红提示，并保留上一次有效配置；下面是「恢复默认」「复制配置」。
   ```js
   const config = {
     accent: '#4459f5',   // 主题色
     ink: '#172b59',      // 文字色
     bg: '#f7f9fd',       // 背景色
     font: '',            // 字体族，留空为系统默认
     size: 14,            // 基础字号 px
     sceneH: 520,         // 画布高度 px
     title: '智飞航线规划',
     subtitle: '航线让无人机视野覆盖目标区域'
   };
   ```
2. **代码接入**（右，三块纵向排列）：安装命令、iframe 引用代码、`api.js` API 配置，各带复制按钮；
   引用地址里的 `?cfg=` 是当前配置的 URL-safe base64 编码。

**没有独立的预览窗**：配置直接作用于本页，改完切回「航线规划」tab 就是新样式
（画布高度变化会自动重绘）。因此看到的始终是真实页面，而不是缩小版预览。

右上角「新标签打开 ↗」在新标签页打开 `?tab=planner`；若浏览器或沙箱拦截弹窗，
会自动降级为当前页打开并提示。

### 配置落到正式页面

三种方式，任选其一：

- **URL**：`/dsh-drone-planner/?cfg=<base64>`，页面启动即应用；
- **API**：宿主页面引入 `api.js` 后 `OttoPlexDronePlanner.mount('#el', cfg)`，`apply()` 可热更新；
- **页面内**：已加载的正式页面暴露 `window.OttoPlexDronePlanner.init(cfg)`。

```html
<div id="drone"></div>
<script src="http://127.0.0.1:<harness-port>/dsh-drone-planner/api.js"></script>
<script>
  const app = OttoPlexDronePlanner.mount('#drone', { accent: '#159b79', size: 15 })
  app.apply({ title: '巡检航线' })   // 不重载即可热更新
</script>
```

## 产品构成

**航线预设**：高度模式（相对地形/海拔）、全局速度 0.1–15 m/s、偏航角模式（沿航线方向/固定机身姿态，
机身角度/云台俯仰/变焦均可留空取默认）、航点是否停留、航线结束动作、超视距裁切距离、最小航点间距、
起飞点经纬度。

**航线规划**：航线覆盖率、观察航点数量、连续航程、航点间距；经纬度航点表（高度、机身水平角、
云台俯仰角、焦距、有效面积、超视距裁切）；风险评估（低高度提醒、间距冲突、能耗与断点续飞）。

**航点编辑**：坐标/经纬度、逐点高度、机身水平角、云台俯仰角、变焦、视锥明细、航点动作
（智拍/云台/挂载，按「是否停留」门控）。

**飞行区域**：点、线、区域、斜面（坡度+坡向）、几何体（圆柱体，默认高 200 m）。
区域与斜面生成弓字形（往复扫描）航线并补齐未覆盖采样；路线沿折线等距布点；几何体绕柱螺旋上升。

## 文件

| 文件 | 作用 |
|---|---|
| `index.js` | Host：只读路由（正式页面 / 旧开发者入口 / api.js） |
| `client.js` | Client：侧边栏图标 + 中央面板（iframe + 自检） |
| `page/index.html` | 单页两 tab：航线规划 + 开发配置（单文件、离线、自包含） |
| `page/dev.html` | 旧入口：跳转到 `?tab=dev`（开发配置已并入正式页面） |
| `page/api.js` | 嵌入加载器 `OttoPlexDronePlanner.mount/apply` |
| `check-redesign.cjs` | 函数级验收（几何、斜面、圆柱螺旋、弓字形扫描等） |
| `check-defaults.cjs` | 浏览器验收（默认值、航线形态、响应式对齐） |
| `check-dev-mode.cjs` | 浏览器验收（单页两 tab、开发配置、立即执行归属、代码接入） |
| `locale/zh.json`、`locale/en.json` | 插件管理里显示的标题与说明 |
| `icon.svg` | 侧边栏与详情页图标 |

## 自检

```bash
# 路由（前两条见「验证安装」）
curl -I http://127.0.0.1:<harness-port>/dsh-drone-planner/api.js

# 验收（需要本机 Chrome 与 Playwright）
node check-redesign.cjs
PW=<playwright 路径> BASE=http://127.0.0.1:<port>/dsh-drone-planner/ node check-defaults.cjs
PW=<playwright 路径> BASE=http://127.0.0.1:<port>/dsh-drone-planner/ node check-dev-mode.cjs
```

## 安全边界

- 只注册 `GET` / `HEAD`，只读，无写入路径。
- 只返回 `page/` 下白名单内的三个文件，不接受参数拼路径。
- 路由由 Harness Web 服务器提供，只监听本机回环地址。
- 「正式页面」与面板内链接都指向同源地址，不跳转外部站点。
