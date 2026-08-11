# 大模型多维对比总览

单文件 HTML 网站，对主流大模型做多维度对比：**性能等级 · 上下文窗口 · 多模态 · 费用 · 适用场景 · 擅长领域 · 内置该模型的 Agent 工具**，一眼分辨。

## 打开方式

- **双击 `用浏览器打开.bat`**（自动用 Chrome/Edge 打开，绕开 WPS 劫持 .html 的问题）
- 或直接用 Chrome/Edge 打开 `index.html`
- 或部署到 GitHub Pages / Vercel / Cloudflare Pages（单文件，无需服务器）

## 功能

| 功能 | 说明 |
|---|---|
| 📊 模型总览 | 33 个主流模型表格：等级色块 + 上下文条形图 + 多模态图标 + 擅长标签 + 费用 + 工具徽章 |
| 🔍 搜索 | 模型名 / 厂商 / 擅长领域 / 上下文（如 "Kimi"、"1M"、"办公"） |
| 🎛️ 筛选 | 等级（S/A/B/C）、厂商（中美 13 家）、能力（多模态/思考模式/1M上下文） |
| 📈 排序 | 按等级 / 上下文 / 名称 |
| 🛠️ Agent 工具视图 | 9 款工具（WorkBuddy/QoderWork/TRAE/Cursor/Claude Code 等）各自内置哪些模型，一眼对比 |
| 💬 详情弹窗 | 点任意行/模型标签 → 完整档案（等级/上下文/多模态/一句话选型/场景/擅长/工具/备注） |

## 数据来源（截至 2026-08-11）

- **WorkBuddy（腾讯）**：内置 11 模型（Hy3/GLM-5.2/Kimi-K3/DeepSeek-V4 等），来源 workbuddy.cn 官方文档
- **QoderWork（Qoder）**：Qwen3.8-Max（2.4T 参数旗舰）等，来源 qoder.com / docs.qoder.com
- **TRAE/TraeWork（字节）**：Seed-2.1-Turbo/Seed-Code/豆包，来源 trae.cn / docs.trae.cn
- **其他工具**：Cursor / Claude Code / Gemini CLI / OpenAI Codex / Copilot / Windsurf，来源各官网公开信息

> ⚠️ 等级为综合参考（能力/速度/生态），非官方评分；上下文、多模态、费用请以官方最新为准。

## 更新内容（改数据）

**严禁直接改 `index.html`**（会被构建覆盖）。改数据走生产线：

```
data/meta.json          ← 标题 / 更新日期 / 等级定义
data/models_part1~3.json ← 模型库（33 个，按 id 唯一）
data/tools.json          ← Agent 工具库（内置模型用 id 引用）
```

改完执行：`python build.py` → 重新生成 index.html

### 新增一个模型

在 `data/models_part3.json` 末尾（或任意 part 文件）追加一个对象：

```json
{
  "id": "新模型id",
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

- `contextVal` 是数字（K 为单位，1M 填 1000），用于排序和 1M 筛选
- `tools` 填 `data/tools.json` 里的工具 id；`[]` 表示未内置
- 若新模型被某工具内置，记得同时在 tools.json 的 `builtinModels` 加 id

### 更新已内置工具支持的模型

改 `data/tools.json` 对应工具的 `builtinModels` 数组（id 列表）→ `python build.py`

## 文件结构

```
llm-compare/
├── index.html          # 交付物（单文件，双击即用）
├── 用浏览器打开.bat    # 启动器（绕开 WPS 劫持）
├── template.html       # HTML 模板（CSS + 骨架）
├── app.js              # 渲染与交互
├── build.py            # 构建脚本
└── data/
    ├── meta.json
    ├── models_part1.json
    ├── models_part2.json
    ├── models_part3.json
    └── tools.json
```
