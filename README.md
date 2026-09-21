# 大模型多维对比总览

单文件 HTML 网站，对主流大模型做多维度对比：**性能等级 · 上下文窗口 · 多模态 · 费用 · 适用场景 · 擅长领域 · 内置该模型的 Agent 工具**，一眼分辨。

**在线版**：https://likuku521.github.io/llm-compare/

## 打开方式

- **双击 `用浏览器打开.bat`**（自动用 Chrome/Edge 打开，绕开 WPS 劫持 .html 的问题）
- 或直接用 Chrome/Edge 打开 `index.html`
- 或部署到 GitHub Pages / Vercel / Cloudflare Pages（单文件，无需服务器）

## 三大视图

| 视图 | 说明 |
|---|---|
| 📊 模型总览 | 33 个精选档案 + **自动收录的 OpenRouter 新旗舰（NEW·待评级）**，卡片/表格双模式，六维雷达图 |
| 🛠️ Agent 工具 | **45 款工具**分 5 类（编程 22/办公 6/AI 助手 10/框架 6/其他 1），每卡 📡 生态实时统计 |
| 🛰️ 实时动态 | OpenRouter 实时拉取：最新上线 / 1M+ 上下文 / 低价精选 |

## 实时更新能力（无需服务器，纯前端）

| 能力 | 数据源 | 说明 |
|---|---|---|
| 🆕 新模型自动收录 | OpenRouter API | 主流厂商近 120 天新旗舰（上下文≥32K）自动并入主视图，橙色 NEW 徽章置顶，家族去重 |
| 💰 实时价格 | OpenRouter + orId 精确映射 | 本地模型命中显示 ¥/1M 实时价，未命中回落定性费用 |
| 💱 实时汇率 | open.er-api.com | 美元→人民币自动折算，失败回退 meta.json 固定值 |
| 📡 工具生态动态 | OpenRouter vendor 映射 | 每款工具的生态模型数 / 近7天新增 / 最新模型 |
| 💾 断网兜底 | localStorage 缓存 | API 挂掉时显示最近一次数据（标"缓存数据"） |

## 交互功能

- 🔍 **搜索智能推荐**：输入任务（"做PPT"/"写代码"/"备课"…18 类）→ 🎯 推荐横幅 Top3 + 按匹配度排序
- 🎛️ 筛选：等级（S/A/B/C/**NEW**）、厂商、能力（多模态/思考/1M 上下文）
- 🕸️ 六维雷达图：模型（推理/代码/上下文/多模态/性价比/场景）、工具（模型池/智能体/办公/代码/生态/易用性）、实时（上下文/输入价/输出价/多模态/推理/新颖度）
- 💬 详情弹窗 + 悬浮提示（hover 卡片看增量信息）
- 🌙/☀️ 黑夜/白天双主题（记忆偏好）
- 🎚️ `🆕 新增` 开关：隐藏/显示自动收录的新模型

## 更新内容（改数据）

**严禁直接改 `index.html`**（会被构建覆盖）。改数据走生产线：

```
data/meta.json           ← 标题 / 更新日期 / 等级定义 / 汇率兜底
data/models_part1~3.json ← 精选模型库（33 个，按 id 唯一，orId=OpenRouter 精确映射）
data/tools.json          ← Agent 工具库（45 款：category 分类 / liveVendors 生态映射）
```

改完执行：`python build.py` → 重新生成 index.html

### 新增一个精选模型

在 `data/models_part3.json` 末尾追加：

```json
{
  "id": "新模型id",
  "orId": "openrouter/完整id（可精确匹配实时价，可省略）",
  "name": "显示名",
  "vendor": "厂商英文(筛选用)",
  "vendorCn": "厂商中文",
  "country": "中国/美国",
  "grade": "S/A/B/C",
  "context": "256K",
  "contextVal": 256,
  "multimodal": ["文本", "图像", "音频", "视频"],
  "thinking": true,
  "cost": "低/中/高",
  "scenes": ["适用场景"],
  "strengths": ["擅长领域"],
  "bestFor": "一句话选型",
  "notes": "备注",
  "tools": ["workbuddy", "cursor"]
}
```

- `contextVal` 数字（K 单位，1M=1000）；`tools` 填工具 id；双向引用 build.py 会校验
- 自动收录的 NEW 模型想转正为精选档案：人工补 grade/bestFor/notes 后加入 models_part*.json，它会自动从 NEW 列表消失（家族去重）

### 新增一个 Agent 工具

`data/tools.json` 追加（必填 `category` 和 `liveVendors`）：

```json
{
  "id": "工具id", "name": "显示名", "vendor": "厂商", "type": "AI IDE",
  "platform": "桌面/Web", "category": "编程工具",
  "desc": "一句话描述", "modelMode": "模型模式", "modelSelect": "模型选择",
  "highlight": "选型建议", "builtinModels": ["模型id"],
  "liveVendors": ["openrouter-vendor前缀"], "source": "来源"
}
```

> ⚠️ 等级为综合参考（能力/速度/生态），非官方评分；数据以官方最新为准。

## 文件结构

```
llm-compare/
├── index.html          # 交付物（单文件）
├── 用浏览器打开.bat    # 启动器
├── template.html       # HTML 模板（CSS + 骨架）
├── app.js              # 渲染与交互（含自动收录引擎）
├── build.py            # 构建脚本
└── data/               # meta / models_part1~3 / tools
```

## 部署

```bash
git add -A && git commit -m "..." && git push origin master
# Windows SSL 报错时：git config http.sslVerify false → push → 恢复 true
# GitHub Pages CDN 缓存约 1-2 分钟生效
```
