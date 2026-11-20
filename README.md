# 智飞航线规划 · DeepSeek Harness 工作台插件

把无人机航线规划工作台作为 **DeepSeek Harness Web UI** 的中央面板打开。同一个页面里用 tab
分成 **航线规划** 与 **开发配置** 两个模块，后者用一段前端代码维护主题/字体/文案/尺寸，并复制接入代码。

已在 [awesome-dsh-plugin](https://awesome-dsh-plugin.com) 插件市场收录（`tools` 分类），可直接在市场里搜索安装，见[安装](#方式一插件市场安装推荐)。

单页两 tab（结构参考 vision-model 的 `module-tabs`）：

| Tab | 地址 | 用途 |
| --- | --- | --- |
| 航线规划 | `/dsh-drone-planner/`、`/dsh-drone-planner/?tab=planner` | 业务界面：飞行区域、航线预设、航线规划、航点编辑、模拟飞行 |
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

## 电量不足时的两种执行策略

风险条里的能耗评估一旦判定「无法飞完全程」，下方会出现**执行策略**面板（够飞时隐藏）：

**策略 1 · 断点续飞**（默认）
飞到电量下限就返航，落地充满后再起飞继续剩余航点。按当前续航给出架次划分，例如：

```
架次 1：WP 1–16 · 1,170 m · 3.9 min ✓
架次 2：WP 17–32 · 1,196 m · 4 min ✓
```

每架次都包含「从起飞点出发 → 覆盖该段 → 返回起飞点」，因此预算要扣掉往返；某段单程已超过续航时该架次标红「超限」，提示需换电/换机或提高续航。

**策略 2 · 多机协同**
把任务区域拆成 2–6 台无人机的分区航线（k-means 按航点位置分区，各机从自己的起飞点按最近邻串起本区航点），并先告诉你**按续航至少需要几台**：

| 无人机 | 起飞点纬度 / 经度 | 负责航点 | 航程 | 预计用时 | 状态 |
| --- | --- | --- | --- | --- | --- |
| D1 | 39.9… / 116.4…（可改） | 16 个 | 894 m | 3.0 min | 满足 |
| D2 | 39.9… / 116.4…（可改） | 16 个 | 894 m | 3.0 min | 满足 |

- **每台无人机有自己的起飞点经纬度**：默认取该分区中心，可直接在表格里改，改完即时重算该机航程与用时；
- 机队数量 2–6 可调，调整后按新数量重新分区；
- 分区航线在画布上用不同颜色绘制（含起飞点三角标记与返航虚线），与航线规划 tab 的绿色覆盖叠加显示。

**机队不够时怎么办（重点）**：需要 3 台而手上只有 2 台时，把用不上的那台起飞点**清空**即可——
留空代表该机不可用，界面会立刻给出可执行性结论：

- 汇总行写明「按续航至少需要 N 台；当前 1/3 个分区有可用起飞点」；
- 表格「能否飞完」列逐机标注 **满足 / 超限 / 缺起飞点**；
- 顶部红字提示点名哪几台飞不完：「⚠ D2、D3 未提供起飞点，对应分区当前飞不完：补齐经纬度、增派无人机，或改用策略 1 断点续飞」；
- 画布上缺起飞点的分区改为**红色虚线**并标注「D2 缺起飞点」，有起飞点的分区仍按颜色正常绘制；
- 补回经纬度后提示立即消失，该分区恢复「满足」。

需要台数超过 6 台时汇总显示「≥6 台（已达分区上限）」，避免给出做不到的数字。

**口径**：分区只看航点位置，不考虑禁飞区、地形与空域；用时＝(去程＋区内航段＋返航)÷航线速度＋等待，与「能耗参数」里的续航/余量联动。两种策略都只做方案计算与可视化，不会真的下发任务。

## 模拟飞行

画布工具条右侧「▶ 模拟飞行」：机体沿当前航线匀速飞行，一边飞一边画它此刻的视锥。

- **怎么跑**：按预设的「全局航线速度」推进（不是逐帧跳点），位置、机身水平角、云台俯仰、变焦、高度都在相邻航点之间插值；
  右上角状态显示 `WP 15/32 · 45% · 用时 2:35`。
- **看什么**：橙色机身标记（带机头指向）、已飞过的实心轨迹、当前视锥的地面投影（半透明填充 + 实线边界）；
  叠加「原始视锥 / 裁切」时同时显示未裁切的橙色轮廓；切到**三维视锥**可见机体、垂线与锥体棱线。
- **倍速**：`×1 / ×4 / ×16`，只改变观看速度，不改变「用时」（用时＝已飞距离 ÷ 航线速度）。
- **控制**：按钮在「模拟飞行 / ⏸ 暂停 / ▶ 继续 / ▶ 重新模拟」间切换；「停止」清除轨迹并隐藏状态。
  暂停时轨迹与视锥保留，可慢慢查看。

自动行为：飞到终点自动停止并提示；重新生成航线、编辑航点或改目标会重置模拟；切到「开发配置」tab 自动暂停。

模拟只按航线顺序匀速运动，不含加/减速、转弯半径、爬升率与停留动作的耗时——它是几何过程的演示，不是飞控仿真。

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
起飞点经纬度（面板里的折叠项「无人机起飞点」）。

**航线规划**：航线覆盖率、观察航点数量、连续航程、航点间距；经纬度航点表（高度、机身水平角、
云台俯仰角、焦距、有效面积、超视距裁切）；风险评估（低高度提醒、间距冲突、能耗；电量不足时给出断点续飞 / 多机协同两种执行策略）。

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
| `check-defaults.cjs` | 浏览器验收（默认值、航线形态、模拟飞行、执行策略、响应式对齐） |
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
