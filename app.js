'use strict';
/* ============================================================
   大模型多维对比总览 v3
   渲染层：卡片网格（默认）/ 表格 双模式
   动效层（ui-motion）：卡片3D tilt + 光标聚光 + 上下文条展开 + scroll-reveal
   交互层（ui-interaction）：推荐横幅 / 筛选状态 / 弹窗生命周期
   ============================================================ */
const DATA = JSON.parse(document.getElementById('app-data').textContent);
const MODELS = DATA.models;
const TOOLS = DATA.tools;
const META = DATA.meta;
const toolById = {}; TOOLS.forEach(t => toolById[t.id] = t);
const toolBadgeClass = {
  'workbuddy':'wb','qoder':'qd','trae':'tr','cursor':'cs','claude-code':'cc',
  'gemini-cli':'gc','codex':'cx','copilot':'cp','windsurf':'ws'
};

/* ===== 状态 ===== */
const state = {
  view: 'models', mode: 'cards',
  q: '', grade: '', vendor: '', mm: '', sort: 'grade',
  includeNew: true,
  modalId: null
};

/* ===== 实时汇率（fetchFx：open.er-api.com 免费无 key）===== */
let FX = META.exchangeRate || 7.2;         // 当前汇率（初始用 meta 固定值兜底）
let FX_SOURCE = 'meta:' + FX;              // 汇率来源描述
let FX_TIME = null;                        // 汇率更新时间戳
const FX_API = 'https://open.er-api.com/v6/latest/USD';

async function fetchFx(){
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(FX_API, {signal: ctrl.signal});
    clearTimeout(timer);
    const d = await res.json();
    const cny = d && d.rates && d.rates.CNY;
    if(cny && cny > 1 && cny < 30){       // 合理区间校验
      FX = parseFloat(cny);
      FX_SOURCE = 'open.er-api.com';
      FX_TIME = d.time_last_update_unix ? d.time_last_update_unix*1000 : Date.now();
    }
  }catch(e){ /* 网络失败：保持 meta 兜底汇率 */ }
  renderFxBadge();
  if(LIVE_LOADED && state.view === 'live') renderLive();   // 汇率更新后重渲染价格
}
function renderFxBadge(){
  const el = document.getElementById('fxBadge');
  if(!el) return;
  const src = FX_SOURCE.startsWith('meta') ? '固定值' : '实时API';
  const t = FX_TIME ? new Date(FX_TIME).toLocaleTimeString('zh-CN',{hour12:false}) : '';
  el.innerHTML = `💱 汇率 <b>${FX.toFixed(3)}</b> <span class="fx-src">${src}${t?' · '+t:''}</span>`;
}

/* ===== 厂商/工具官方 Logo（构建时内联 SVG path，零网络依赖，失败回退字母色块）===== */
const ICONS = DATA.icons || {};
/* 模型厂商 → [slug, 品牌色]；slug=null 表示无官方图标，用字母+品牌色 */
const BRAND_LOGO = {
  'OpenAI': ['openai', '#10A37F'], 'Anthropic': ['anthropic', '#D4A27F'], 'Google': ['googlegemini', '#4285F4'],
  '深度求索': ['deepseek', '#4D6BFE'], '阿里': null, '月之暗面': null, '智谱 AI': null,
  'MiniMax': null, '字节跳动': null, '腾讯': ['tencentqq', '#00A4FF'], '百度': null,
  '零一万物': null, '阶跃星辰': null, 'xAI': null, 'Mistral': ['mistralai', '#FF7000'],
  'Meta': ['meta', '#0064E0'], 'Amazon': ['amazon', '#FF9900']
};
/* Agent 工具 → [slug, 品牌色]（键 = tools.json 的 id） */
const TOOL_LOGO = {
  'cursor': ['cursor', '#9A9A9A'], 'claude-code': ['claude', '#D4A27F'], 'claude-app': ['claude', '#D4A27F'],
  'codex': ['openai', '#10A37F'], 'copilot': ['githubcopilot', '#C9D4E8'], 'gemini-cli': ['googlegemini', '#4285F4'],
  'gemini-app': ['googlegemini', '#4285F4'], 'chatgpt': ['openai', '#10A37F'],
  'windsurf': ['windsurf', '#0CAFF0'], 'zed': ['zed', '#5B9CFF'], 'cline': ['cline', '#4AA8FF'],
  'cody': ['sourceforge', '#FF6644'], 'amazon-q': ['amazonq', '#FF9900'], 'replit-agent': ['replit', '#F26207'],
  'v0': ['v0', '#C9D4E8'], 'perplexity': ['perplexity', '#2FA8A8'], 'autogen': ['microsoft', '#00A4EF'],
  'langchain': ['langchain', '#5FA87F'], 'dify': ['dify', '#3B82F6'], 'n8n': ['n8n', '#EA4B71'],
  'notion-ai': ['notion', '#C9D4E8'], 'trae': null, 'qoder': null, 'workbuddy': null, 'aider': null,
  'continue': null, 'jetbrains-ai': null, 'marscode': null, 'lingma': null, 'comate': null, 'codebuddy': null,
  'lovable': null, 'bolt': null, 'devin': null, 'manus': null, 'doubao': null, 'kimi-app': null,
  'wenxiaoyan': null, 'yuanbao': null, 'hermes': null, 'crewai': null, 'flowise': null,
  'dingtalk-ai': null, 'feishu-ai': null, 'wps-ai': null, 'ima': null
};
/* 无官方图标时的品牌色字母块（键 = tools.json 的 id） */
const TOOL_BRAND_COLOR = {
  'trae': '#00D6B9', 'marscode': '#00C9A7', 'lingma': '#615CED', 'comate': '#2932E1', 'codebuddy': '#006EFF',
  'aider': '#FF6B35', 'lovable': '#FF4785', 'devin': '#10A37F', 'manus': '#7C3AED', 'hermes': '#F5C96B',
  'kimi-app': '#1693FF', 'doubao': '#26BBFB', 'wenxiaoyan': '#2E6BE6', 'yuanbao': '#00A4FF', 'crewai': '#FF7A59',
  'flowise': '#1E88E5', 'wps-ai': '#E32227', 'ima': '#00B578', 'qoder': '#615CED', 'workbuddy': '#2AAE67',
  'bolt': '#FFD43B', 'continue': '#4A7DFF', 'dingtalk-ai': '#0089FF', 'feishu-ai': '#3370FF', 'jetbrains-ai': '#FF6B35'
};
const VENDOR_FALLBACK_COLOR = {'智谱 AI':'#1E4FFF','阿里':'#FF6A00','月之暗面':'#1693FF','MiniMax':'#F24A8B','字节跳动':'#325AB4','百度':'#2932E1','零一万物':'#0033CC','阶跃星辰':'#7B5CFF','xAI':'#8A8A8A'};
/* vendorCn 别名归一化（自动收录模型的 vendorCn 变体 → 标准厂商键） */
const VENDOR_ALIAS = {'智谱AI':'智谱 AI','智谱':'智谱 AI','通义千问':'阿里','通义':'阿里','腾讯混元':'腾讯','混元':'腾讯','字节':'字节跳动','豆包':'字节跳动','深度求索':'深度求索','DeepSeek':'深度求索','月之暗面':'月之暗面','Kimi':'月之暗面','百度智能云':'百度'};
function normVendor(v){ return VENDOR_ALIAS[v] || v; }
function firstLetter(v){ return /[A-Za-z]/.test(v) ? v[0].toUpperCase() : v[0]; }
/* 通用 logo 渲染：内联官方 SVG（品牌色着色），无图标回退字母色块 */
function logoHTML(slug, color, vendorName, size){
  const letter = firstLetter(vendorName);
  const paths = slug ? ICONS[slug] : null;
  if(paths && paths.length){
    const r = Math.round(size*0.26), p = Math.round(size*0.13);
    const inner = size - p*2;
    const body = paths.map(d => `<path d="${d}" fill="${color}"/>`).join('');
    return `<span class="brand-logo" style="width:${size}px;height:${size}px;border-radius:${r}px;background:${color}14;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0"><svg viewBox="0 0 24 24" width="${inner}" height="${inner}" style="display:block">${body}</svg></span>`;
  }
  return `<span class="logo-fallback" style="width:${size}px;height:${size}px;background:${color}">${letter}</span>`;
}
/* 模型厂商 logo */
function vendorLogo(vendor, size){
  size = size || 24;
  const v = normVendor(vendor || '?');
  const entry = BRAND_LOGO[v];
  const slug = entry ? entry[0] : null;
  const color = (entry && entry[1]) || VENDOR_FALLBACK_COLOR[v] || '#5B6B8C';
  return logoHTML(slug, color, v, size);
}
/* Agent 工具 logo */
function toolLogo(tid, vendor, size){
  size = size || 22;
  const entry = TOOL_LOGO[tid];
  const slug = entry ? entry[0] : null;
  const color = (entry && entry[1]) || TOOL_BRAND_COLOR[tid] || '#5B6B8C';
  return logoHTML(slug, color, vendor || '?', size);
}

/* OpenRouter vendor 前缀 → 厂商名（实时卡 logo 用） */
function orVendorName(prefix){
  const map = {'openai':'OpenAI','anthropic':'Anthropic','google':'Google','deepseek':'深度求索','qwen':'阿里','moonshotai':'月之暗面','z-ai':'智谱 AI','minimax':'MiniMax','bytedance-seed':'字节跳动','tencent':'腾讯','x-ai':'xAI','mistralai':'Mistral','meta-llama':'Meta','amazon':'Amazon','baidu':'百度'};
  return map[prefix.toLowerCase()] || prefix;
}
function orVendorLogo(orId, size){ return vendorLogo(orVendorName((orId.split('/')[0]||'').toLowerCase()), size); }

/* ===== 工具函数 ===== */
function esc(s){return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function gradeColor(g){ if(g==='NEW') return '#FF7B42'; return META.gradeDef[g] ? META.gradeDef[g].color : '#7A87A6'; }
function fmtCtx(v){return v >= 1000 ? (v/1000).toFixed(v%1000===0?0:1)+'M' : v+'K';}
function mmIcon(m){
  let h = '';
  if(m.includes('文本')) h += '<i>文本</i>';
  if(m.includes('图像')) h += '<i class="img">🖼️ 图像</i>';
  if(m.includes('音频')) h += '<i class="aud">🎵 音频</i>';
  if(m.includes('视频')) h += '<i class="vid">🎬 视频</i>';
  return h || '<i>—</i>';
}
function costClass(c){return c==='低'?'low':(c==='中'?'mid':'high');}
/* ===== 六边形雷达图（纯 SVG，无依赖）===== */
function radarData(m){
  const gs = m.grade==='NEW' ? 3.5 : (META.gradeScore[m.grade]||0);  // 5/4/3/2（NEW=待评估中位）
  const reasoning = (gs/5)*70 + (m.thinking?30:0);  // 等级70 + 思考30
  const code = (m.strengths||[]).some(s=>/代码|编程/.test(s)) ? 100 : (m.scenes.includes('代码')?80:40);
  const ctx = Math.min(100, m.contextVal/10);       // 1M=100
  const mm = m.multimodal.includes('视频')?100 : m.multimodal.includes('音频')?90 : m.multimodal.includes('图像')?75 : 40;
  const value = m.cost==='低'?95 : m.cost==='中'?70 : 45;
  const scenes = Math.min(100, m.scenes.length*12 + (m.country==='中国'?10:0));
  return {labels:['推理','代码','上下文','多模态','性价比','场景'], vals:[reasoning, code, ctx, mm, value, scenes]};
}
function toolRadarData(t){
  const cnt = (t.builtinModels||[]).length;
  const desc = (t.desc||'') + (t.modelMode||'') + (t.type||'');
  const diversity = Math.min(100, cnt*9);
  const agent = /Agent|智能体|SOLO|自主|自动化/.test(desc) ? 90 : /工作台|助手/.test(desc)?70:50;
  const office = /办公|文档|表格|PPT|邮件|工作|数据/.test(desc) ? 90 : 40;
  const code = /代码|编程|IDE|开发|Coding/.test(desc) ? 90 : 45;
  const eco = /腾讯|字节|阿里|GitHub|Google|OpenAI|生态/.test(t.vendor+t.desc) ? 85 : 55;
  const easy = /网页|Web|三端|浏览器|网页版/.test(t.desc+t.platform) ? 90 : (t.platform.split('/').length>=3?85:70);
  return {labels:['模型池','智能体','办公','代码','生态','易用性'], vals:[diversity, agent, office, code, eco, easy]};
}
function radarSvg(vals, color, size){
  const cx=50, cy=50, R=40;
  const N=6;
  const ang = i => -Math.PI/2 + i*2*Math.PI/N;
  const pt = (i, r) => [cx + Math.cos(ang(i))*r, cy + Math.sin(ang(i))*r].map(x=>x.toFixed(2)).join(',');
  let grid='';
  for(let l=1;l<=4;l++){
    const rr=R*l/4;
    const pts=[]; for(let i=0;i<N;i++) pts.push(pt(i,rr));
    grid+=`<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width="1"/>`;
  }
  let axes='';
  for(let i=0;i<N;i++){ const [x,y]=pt(i,R).split(','); axes+=`<line x1="50" y1="50" x2="${x}" y2="${y}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>`; }
  const dp=[]; const dp2=[];
  for(let i=0;i<N;i++){
    const r=R*Math.max(.04,Math.min(1,(vals[i]||0)/100));
    dp.push(pt(i,r)); dp2.push(pt(i,r).split(','));
  }
  const data=`<polygon points="${dp.join(' ')}" fill="${color}2e" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`;
  let dots='';
  for(let i=0;i<N;i++){ const [x,y]=dp2[i]; dots+=`<circle cx="${x}" cy="${y}" r="2.4" fill="${color}"/>`; }
  return `<svg viewBox="0 0 100 100" class="radar-svg" style="width:${size}px;height:${size}px">${grid}${axes}${data}${dots}</svg>`;
}
function radarBlock(rd, color, size){
  const rows = rd.labels.map((l,i)=>`<span class="rl-row"><span class="rl-dot" style="background:${color}"></span>${l}<b>${rd.vals[i]}</b></span>`).join('');
  return `<div class="radar-block"><div class="radar-fig">${radarSvg(rd.vals, color, size)}</div><div class="radar-labels">${rows}</div></div>`;
}
/* 雷达图固定亮色（不随主题变深，白天/黑夜一致——与模型总览等级色同风格） */
const RADAR_TOOL_COLOR = '#4FD8FF';    // 工具卡
const RADAR_LIVE_COLOR = '#4FD8FF';    // 实时动态卡
/* 费用显示：优先匹配 OpenRouter 实时价格（¥/1M），未匹配回落定性费用 */
function costDisplay(m){
  const p = findLivePrice(m);
  if(p !== null) return fmtPricePerM(p);
  return m.cost + '费用';
}
function findLivePrice(m){
  if(!LIVE || !LIVE.length) return null;
  // 1. 优先 orId 精确匹配
  if(m.orId){
    const hit = LIVE.find(x => x.id === m.orId);
    if(hit) return hit.pricing && hit.pricing.prompt;
  }
  // 2. slug 宽松匹配
  const slug = m.id.toLowerCase();
  const hit = LIVE.find(x => {
    const s = (x.id.split('/').pop() || '').toLowerCase();
    return s === slug || s.startsWith(slug) || slug.startsWith(s);
  });
  return hit ? (hit.pricing && hit.pricing.prompt) : null;
}
function toolBadges(model){
  const ids = model.tools || [];
  if(!ids.length) return '<span style="color:var(--dim);font-size:11px">未内置</span>';
  return ids.map(id => {
    const t = toolById[id]; if(!t) return '';
    const cls = toolBadgeClass[id] || 'other';
    return `<span class="tool-badge ${cls}" title="${esc(t.name)} · ${esc(t.type)}">${esc(t.name)}</span>`;
  }).join('');
}

/* ===== 任务推荐词典 ===== */
const TASKS = [
  { kw:["做ppt","ppt","演示","汇报","幻灯片","路演","提案"], label:"做PPT/演示汇报",
    scenes:["办公"], strengths:["办公"], top:["glm-5.2","qwen-3.8-max","hy3","kimi-k3","gpt-5.2"],
    reason:"需要内容组织+结构生成能力，办公类模型最擅长，GLM-5.2 长上下文适合多页内容" },
  { kw:["写代码","编程","开发","程序","脚本","写程序","修bug","调试","代码"], label:"写代码/开发",
    scenes:["代码"], strengths:["代码","编程","纯文本编程强"], top:["deepseek-v4-flash","claude-4.6","kimi-k3","deepseek-v4","gpt-5.2"],
    reason:"代码任务看重生成质量+速度，DeepSeek 系列性价比最高，Claude 4.6 综合最强" },
  { kw:["写文章","写作","文案","报告","周报","总结","公文","论文"], label:"写作/文案",
    scenes:["写作","办公"], strengths:["写作","写作质量"], top:["claude-4.6","qwen-3.8-max","gpt-5.2","glm-5.2"],
    reason:"写作需要语言组织能力，Claude 写作质量公认最好，中文场景 Qwen/GLM 更贴" },
  { kw:["分析数据","数据分析","报表","表格","excel","财务","统计","图表"], label:"数据分析",
    scenes:["数据分析","办公"], strengths:["数据处理","分析"], top:["glm-5.2","deepseek-v4","kimi-k3","qwen-3.8-max"],
    reason:"数据分析要能吃长表格+多步推理，1M 上下文的 GLM-5.2/DeepSeek 最合适" },
  { kw:["翻译","英文翻译","中译英","英译中"], label:"翻译",
    scenes:["中文","通用对话"], strengths:["中文"], top:["gpt-5.2","qwen-3.8-max","deepseek-v4","claude-4.6"],
    reason:"翻译要求双语能力，GPT/Qwen 中英互译综合最稳" },
  { kw:["长文档","合同","报告书","调研","研究","文献","文档总结","万字"], label:"长文档/研究",
    scenes:["长文档","长程任务"], strengths:["长上下文","长程任务"], top:["glm-5.2","claude-4.6","claude-4.5","deepseek-v4","kimi-k3"],
    reason:"长文档需要大上下文窗口，1M 上下文的模型才能完整吃进全文" },
  { kw:["图片","看图","识别图片","海报","图像"], label:"图片理解/生成",
    scenes:["多模态理解","图像"], strengths:["图像"], top:["gemini-3-pro","qwen-3.8-max","gemini-3-flash","glm-5v"],
    reason:"图片任务需要多模态能力，Gemini 系列多模态最全，Qwen 中文图像理解强" },
  { kw:["视频","剪辑","音视频","视频理解"], label:"视频理解",
    scenes:["视频"], strengths:["视频理解"], top:["gemini-3-pro","gemini-3-flash"],
    reason:"视频理解是稀缺能力，目前只有 Gemini 系列支持视频输入" },
  { kw:["语音","音频","会议记录","转写"], label:"语音/音频",
    scenes:["音频"], strengths:["语音"], top:["gemini-3-pro","minimax-m2","gemini-3-flash"],
    reason:"音频输入需要原生多模态，Gemini 全模态支持，MiniMax 语音特色" },
  { kw:["数学","推理","逻辑","难题","奥数"], label:"数学/推理",
    scenes:["深度推理","推理"], strengths:["数学推理","深度推理"], top:["deepseek-v4","kimi-k3","gpt-5.2","deepseek-v4-pro"],
    reason:"数学推理看重思考模式，DeepSeek/Kimi 的推理链路业界领先" },
  { kw:["自动化","agent","智能体","批量","定时","多步骤","任务流"], label:"Agent/自动化",
    scenes:["Agent","长程任务"], strengths:["Agent","长程自主"], top:["kimi-k3","claude-4.6","glm-5.2","gpt-5.2"],
    reason:"Agent 任务要稳定工具调用+长程自主，Kimi-K3/Claude 4.6 是 Agent 场景标杆" },
  { kw:["中文","公文","国企","政务","合同审核"], label:"中文/政务",
    scenes:["中文","办公"], strengths:["中文","中文办公"], top:["qwen-3.8-max","glm-5.2","hy3","deepseek-v4"],
    reason:"中文场景国产模型更懂语境，Qwen 2.4T 参数中文能力最强" },
  { kw:["教案","备课","课件","课程内容","教学设计","上课","课堂","学生","试卷","出题","学科","辅导","讲解","作业批改","网课","教育","老师","教师","班主任","教学计划"], label:"教学设计/课程内容",
    scenes:["创作","办公","中文"], strengths:["写作","写作质量","中文","中文办公"], top:["claude-4.6","qwen-3.8-max","gpt-5.2","glm-5.2","kimi-k3"],
    reason:"课程内容要结构化讲解+通俗表达，写作与中文能力强的模型更会教" },
  { kw:["语文","数学","英语","物理","化学","生物","历史","地理","政治","科学","语文课","数学课","英语课"], label:"学科课件/备课",
    scenes:["创作","办公","中文"], strengths:["写作","中文"], top:["claude-4.6","qwen-3.8-max","gpt-5.2","glm-5.2","kimi-k3"],
    reason:"学科内容需要专业讲解+趣味化呈现，全能旗舰最稳，国产模型中文更贴课堂" },
  { kw:["邮件","回信","商务邮件","跟客户","对外沟通","英文邮件"], label:"邮件沟通",
    scenes:["办公","通用对话"], strengths:["写作","中文"], top:["claude-4.6","qwen-3.8-max","gpt-5.2","deepseek-v4"],
    reason:"邮件讲究得体与简洁，写作强的模型措辞更专业" },
  { kw:["简历","求职","面试","自我介绍","竞聘","述职","职业规划"], label:"求职/简历",
    scenes:["办公","写作"], strengths:["写作","写作质量"], top:["claude-4.6","gpt-5.2","qwen-3.8-max"],
    reason:"简历求职要扬长避短+量化成果，Claude/GPT 文案打磨能力最强" },
  { kw:["营销","广告","推广","朋友圈","小红书","短视频脚本","直播话术","种草","品牌宣传"], label:"营销文案",
    scenes:["创作","中文"], strengths:["写作","中文","创作"], top:["claude-4.6","qwen-3.8-max","doubao-3","gpt-5.2"],
    reason:"营销文案要抓眼球+懂平台调性，豆包/国产模型更懂中文社交平台" },
  { kw:["创意","点子","头脑风暴","策划","活动","年会","团建","方案"], label:"创意策划",
    scenes:["创作","通用对话","深度推理"], strengths:["写作","推理"], top:["gpt-5.2","claude-4.6","qwen-3.8-max","kimi-k3"],
    reason:"策划要发散思维+落地闭环，GPT 头脑风暴强，Kimi 长程规划稳" }
];

function matchTask(q){
  const lower = q.toLowerCase();
  // 最长关键词命中优先（"超长PDF论文" → 长文档任务，而非被"论文"抢走）
  let best = null, bestLen = 0;
  for(const t of TASKS){
    for(const k of t.kw){
      if(lower.includes(k) && k.length > bestLen){ best = t; bestLen = k.length; }
    }
  }
  return best;
}

/* ===== 通用需求信号推断（面向小白：任何自然语言需求都能推荐）===== */
const SIGNALS = [
  { re:/公众号|自媒体|推文|文章|博客|写作|文案|写文|稿件|小说|故事|剧本|诗|起名|标题|广告|小红书|抖音|快手|视频脚本|直播|带货|种草|涨粉/, scenes:["创作","中文"], strengths:["写作","写作质量","中文","创作"], label:"内容创作" },
  { re:/图|画|海报|设计|照片|看图|识图|视觉|logo|封面|插画|截图|修图|p图/, scenes:["多模态理解","图像"], strengths:["图像"], label:"图像能力", needMM:true },
  { re:/视频|剪辑|音视频|影片/, scenes:["视频"], strengths:["视频理解"], label:"视频理解", needMM:true },
  { re:/语音|音频|转写|播客|配音|听写|录音|会议记录/, scenes:["音频"], strengths:["语音"], label:"音频处理", needMM:true },
  { re:/论文|文献|书|合同|长文|总结|阅读|万字|研究|调研|报告|年报|财报/, scenes:["长文档","长程任务"], strengths:["长上下文","长程任务"], label:"长文档", needBigCtx:true },
  { re:/代码|编程|开发|程序|脚本|bug|前端|后端|python|java|sql|c\+\+|网站|app|软件|算法|爬虫/, scenes:["代码"], strengths:["代码","编程","纯文本编程强"], label:"代码开发" },
  { re:/数学|推理|逻辑|计算|证明|难题|物理|化学|奥数/, scenes:["深度推理"], strengths:["数学推理","深度推理","推理"], label:"推理分析" },
  { re:/数据|表格|excel|报表|统计|图表|分析/, scenes:["数据分析","办公"], strengths:["数据处理","分析"], label:"数据分析" },
  { re:/翻译|英文|英语|日语|韩语|外语|中译|英译/, scenes:["中文","通用对话"], strengths:["中文","翻译"], label:"翻译" },
  { re:/ppt|演示|汇报|幻灯|路演|提案/, scenes:["办公"], strengths:["办公"], label:"办公演示" },
  { re:/agent|智能体|自动化|工作流|批量|定时|流程/, scenes:["Agent","长程任务"], strengths:["Agent","长程自主"], label:"Agent自动化" },
  { re:/中文|公文|政务|国企|体制|党建|机关|红头/, scenes:["中文","办公"], strengths:["中文","中文办公"], label:"中文办公" },
  { re:/学习|辅导|作业|备课|教案|课件|教学|学生|考试|刷题|网课|老师|教育/, scenes:["创作","办公","中文"], strengths:["写作","中文"], label:"教育学习" },
  { re:/聊天|陪伴|情感|心理|咨询|问答|对话/, scenes:["通用对话"], strengths:["对话"], label:"对话问答" },
  { re:/办公|邮件|会议|日程|文档|周报|日报|纪要/, scenes:["办公"], strengths:["办公","中文办公"], label:"日常办公" },
  { re:/电商|客服|营销|推广|运营|私域|社群|用户/, scenes:["办公","创作","中文"], strengths:["中文","写作"], label:"运营营销" },
  { re:/法律|法规|条款|合规|诉讼|律师/, scenes:["长文档","中文"], strengths:["长上下文","中文"], label:"法律合规", needBigCtx:true },
  { re:/医疗|健康|诊断|药|临床|病历/, scenes:["深度推理","长文档"], strengths:["推理"], label:"医疗健康" },
  { re:/金融|投资|股票|基金|理财|风控|审计|会计|税务/, scenes:["数据分析","长文档"], strengths:["数据处理","分析"], label:"金融财务" },
  { re:/便宜|免费|省钱|低成本|性价比|白菜|不花钱/, label:"低成本", costLow:true },
  { re:/最好|最强|顶级|专业|旗舰|高质量|不差钱|天花板/, label:"旗舰品质", gradeHigh:true },
  { re:/快|速度|秒回|实时|低延迟|急用/, label:"响应快" },
  { re:/新手|小白|入门|简单|易用|不懂/, label:"新手友好", costLow:true }
];

function inferTask(q){
  const lower = q.toLowerCase();
  const hits = SIGNALS.filter(s => s.re.test(lower));
  if(!hits.length) return null;
  const scenes = [...new Set(hits.flatMap(h => h.scenes || []))];
  const strengths = [...new Set(hits.flatMap(h => h.strengths || []))];
  const labels = hits.map(h => h.label);
  // 信号命中长度（与词典 PK 用：谁命中的词更长谁更具体）
  let bestLen = 0;
  for(const h of hits){
    const src = h.re.source.split('|');
    for(const w of src){ if(w.length > bestLen && lower.includes(w.toLowerCase())) bestLen = w.length; }
  }
  return {
    label: labels.slice(0, 2).join(' + '),
    scenes, strengths,
    flags: {
      needMM: hits.some(h => h.needMM),
      needBigCtx: hits.some(h => h.needBigCtx),
      costLow: hits.some(h => h.costLow),
      gradeHigh: hits.some(h => h.gradeHigh)
    },
    detected: labels,
    sigLen: bestLen,
    inferred: true,
    reason: '识别到需求：' + labels.join('、')
  };
}
/* 任意查询的任务解析：词典 vs 信号推断，命中更长者为主（更具体），另一个合并补充 */
function resolveTask(q){
  const t = matchTask(q);
  const inf = inferTask(q);
  if(!t) return inf;
  if(!inf) return t;
  const tLen = t.kw.reduce((a, k) => q.toLowerCase().includes(k) ? Math.max(a, k.length) : a, 0);
  const primary = (inf.sigLen || 0) > tLen ? inf : t;   // 更长命中 = 更具体 = 主任务
  const secondary = primary === inf ? t : inf;
  return Object.assign({}, primary, {
    scenes: [...new Set([...(primary.scenes||[]), ...(secondary.scenes||[])])],
    strengths: [...new Set([...(primary.strengths||[]), ...(secondary.strengths||[])])],
    top: primary.top || secondary.top,
    flags: Object.assign({}, secondary.flags, primary.flags),
    reason: primary.reason + '（兼顾' + secondary.label + '）'
  });
}
/* 按名称/厂商精确查找（用户明确搜某模型时） */
function findByName(q){
  const lower = q.toLowerCase();
  return allModels().filter(m => {
    const hay = [m.name, m.vendor, m.vendorCn, m.id].join(' ').toLowerCase();
    return hay.includes(lower);
  });
}
function scoreModel(m, task){
  let s = 0;
  (task.scenes||[]).forEach(sc => { if((m.scenes||[]).includes(sc)) s += 3; });
  (task.strengths||[]).forEach(st => { if((m.strengths||[]).includes(st)) s += 2; });
  if(task.top && task.top.includes(m.id)) s += 6;
  const f = task.flags || {};
  s += (META.gradeScore[m.grade]||0) * (f.gradeHigh ? 2 : 1);
  if(m.cost === '低') s += f.costLow ? 4 : 1;
  if(f.needMM && (m.multimodal.length > 1)) s += 5;
  if(f.needBigCtx && m.contextVal >= 256) s += 4;
  if(m.grade === 'NEW') s -= 2;   // 未评级稍降权
  return s;
}

/* ===== 过滤 ===== */
function filteredModels(){
  let list = allModels().slice();
  if(state.grade) list = list.filter(m => m.grade === state.grade);
  if(state.vendor) list = list.filter(m => m.vendor === state.vendor);
  if(state.mm){
    if(state.mm === '多模态') list = list.filter(m => m.multimodal.length > 1 || m.multimodal.includes('图像') || m.multimodal.includes('音频') || m.multimodal.includes('视频'));
    else if(state.mm === '思考模式') list = list.filter(m => m.thinking);
    else if(state.mm === '1M上下文') list = list.filter(m => m.contextVal >= 1000);
  }
  if(state.q){
    const q = state.q.toLowerCase();
    // 1. 明确搜某个模型/厂商名 → 精确命中优先
    const named = findByName(state.q);
    const task = resolveTask(state.q);
    if(named.length && !task){
      list = named;
    } else if(task){
      // 2. 任务/需求识别 → 按匹配度推荐（含 named 命中的加权）
      list = list.map(m => ({m, s: scoreModel(m, task) + (named.includes(m) ? 10 : 0)}))
        .sort((a,b) => b.s - a.s).slice(0, 8).map(x => x.m);
    } else {
      // 3. 普通全文搜索
      const txt = list.filter(m => {
        const hay = [m.name, m.vendor, m.vendorCn, m.bestFor, m.strengths.join(' '), m.scenes.join(' '), m.notes, fmtCtx(m.contextVal), m.context].join(' ').toLowerCase();
        return hay.includes(q);
      });
      if(txt.length){
        list = txt;
      } else {
        // 4. 都没命中 → 通用推荐兜底（综合等级 Top8，永不空手而归）
        list = list.map(m => ({m, s: (META.gradeScore[m.grade]||0) + (m.grade==='NEW'?2.5:0)}))
          .sort((a,b) => b.s - a.s).slice(0, 8).map(x => x.m);
      }
    }
  } else if(state.sort === 'context') list.sort((a,b) => b.contextVal - a.contextVal);
  else if(state.sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'zh'));
  else list.sort((a,b) => (b.grade==='NEW'?99:(META.gradeScore[b.grade]||0)) - (a.grade==='NEW'?99:(META.gradeScore[a.grade]||0)));
  return list;
}

/* ===== 推荐横幅 ===== */
function recoBanner(){
  if(!state.q) return '';
  const task = resolveTask(state.q);
  const named = findByName(state.q);
  // 通用兜底横幅（搜什么都推荐，永不空手）
  if(!task && !named.length){
    const scored = allModels().map(m => ({m, s: (META.gradeScore[m.grade]||0) + (m.grade==='NEW'?2.5:0)}))
      .sort((a,b) => b.s - a.s).slice(0, 3);
    const chips = scored.map((x, i) => `<span class="reco-chip" style="animation-delay:${i*90}ms" onclick="openModal('${x.m.id}')">
      ${vendorLogo(x.m.vendorCn || x.m.vendor, 26)}<span class="grade-pill${x.m.grade==='NEW'?' new':''}" style="background:${gradeColor(x.m.grade)}22;color:${gradeColor(x.m.grade)};border:1px solid ${gradeColor(x.m.grade)}55">${x.m.grade}</span>
      <b>${esc(x.m.name)}</b><i>${esc((x.m.bestFor||'').split('——')[0])}</i></span>`).join('');
    return `<div class="reco">
      <div class="reco-head">💡 <b>综合推荐</b><span class="reco-reason">描述你的需求（如「做公众号」「翻译合同」「便宜好用」），我会为你匹配模型</span></div>
      <div class="reco-chips">${chips}</div>
    </div>`;
  }
  if(!task) return '';  // 只命中模型名，无需推荐横幅
  const scored = allModels().map(m => ({m, s: scoreModel(m, task) + (named.includes(m) ? 10 : 0)}))
    .sort((a,b) => b.s - a.s).slice(0, 3);
  const chips = scored.map((x, i) => {
    const m = x.m;
    return `<span class="reco-chip" style="animation-delay:${i*90}ms" onclick="openModal('${m.id}')">
      ${vendorLogo(m.vendorCn || m.vendor, 26)}<span class="grade-pill${m.grade==='NEW'?' new':''}" style="background:${gradeColor(m.grade)}22;color:${gradeColor(m.grade)};border:1px solid ${gradeColor(m.grade)}55">${m.grade}</span>
      <b>${esc(m.name)}</b>
      <i>${esc((m.bestFor||'').split('——')[0])}</i>
    </span>`;
  }).join('');
  return `<div class="reco">
    <div class="reco-head">🎯 <b>${esc(task.label)}</b><span class="reco-reason">${esc(task.reason)}</span></div>
    <div class="reco-chips">${chips}</div>
  </div>`;
}

/* ===== 卡片视图渲染 ===== */
function renderCards(list){
  const cards = list.map((m, i) => {
    const ctxPct = Math.min(100, m.contextVal/10);
    return `<div class="mcard rise" style="animation-delay:${Math.min(i*40,500)}ms" data-mid="${m.id}" data-tip-key="model:${m.id}"
      onclick="openModal('${m.id}')">
      <div class="mc-top">
        <div class="mc-logo">${vendorLogo(m.vendorCn || m.vendor, 40)}</div>
        <div>
          <div class="mc-name">${esc(m.name)}<span class="grade-pill${m.grade==='NEW'?' new':''}" style="background:${gradeColor(m.grade)}22;color:${gradeColor(m.grade)};border:1px solid ${gradeColor(m.grade)}55">${m.grade}</span><span class="flag">${m.country==='中国'?'🇨🇳':'🇺🇸'}</span></div>
          <div class="mc-vendor">${esc(m.vendorCn || m.vendor)}<span class="mc-dot">·</span><span class="mc-price">${costDisplay(m)}</span></div>
        </div>
        <div class="mc-radar" title="六维能力分析">${radarSvg(radarData(m).vals, gradeColor(m.grade), 76)}</div>
      </div>
      <p class="mc-best">${esc(m.bestFor)}</p>
      <div class="mc-ctx">
        <div class="ctx-label"><span>上下文窗口</span><b>${fmtCtx(m.contextVal)}</b></div>
        <div class="bar"><div class="fill" style="width:${ctxPct}%"></div></div>
      </div>
      <div class="mc-tags">
        ${m.thinking?'<span class="tag think">🧠 思考</span>':''}
        ${(m.strengths||[]).slice(0,3).map(s=>`<span class="tag">${esc(s)}</span>`).join('')}
      </div>
      <div class="mc-foot">
        <span class="mc-cost ${costClass(m.cost)}">${m.cost}成本</span>
        <div class="mc-tools">${toolBadges(m)}</div>
      </div>
    </div>`;
  }).join('');
  return `<div class="cards-wrap">${cards}</div>`;
}

/* ===== 表格视图渲染 ===== */
function renderTable(list){
  const rows = list.map(m => `
    <tr onclick="openModal('${m.id}')">
      <td><span class="m-name">${vendorLogo(m.vendorCn || m.vendor, 24)}<span class="grade${m.grade==='NEW'?' new':''}" style="background:${gradeColor(m.grade)}">${m.grade}</span>${esc(m.name)}<span class="flag">${m.country==='中国'?'🇨🇳':'🇺🇸'}</span></span><div class="m-vendor">${esc(m.vendorCn || m.vendor)}</div></td>
      <td class="ctx-cell"><div class="ctxbar"><div class="bar"><div class="fill" style="width:${Math.min(100, m.contextVal/10)}%"></div></div><span class="txt">${fmtCtx(m.contextVal)}</span></div></td>
      <td><div class="mm">${mmIcon(m.multimodal)}</div></td>
      <td>${m.thinking?'<span class="tag think">🧠 思考</span>':''}${(m.strengths||[]).slice(0,3).map(s=>`<span class="tag">${esc(s)}</span>`).join('')}</td>
      <td><span class="cost ${costClass(m.cost)}">💱 ${costDisplay(m)}</span></td>
      <td><div class="toolcell">${toolBadges(m)}</div></td>
    </tr>`).join('');
  return `<div class="tbl-wrap"><table>
    <thead><tr><th>模型</th><th>上下文</th><th>多模态</th><th>擅长领域</th><th>费用</th><th>Agent 工具</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

/* ===== 模型视图入口 ===== */
function renderModels(){
  const list = filteredModels();
  const wrap = document.getElementById('main');
  if(!list.length){
    wrap.innerHTML = `<div class="empty view-enter"><div class="empty-icon">🔍</div><b>没有匹配的模型</b>试试放宽筛选条件或清空搜索</div>`;
    return;
  }
  wrap.innerHTML = `<div class="view-enter">${recoBanner()}${state.mode==='cards'?renderCards(list):renderTable(list)}</div>`;
  initCardFX();
}

/* ===== 视图模式切换 ===== */
function setMode(mode){
  state.mode = mode;
  document.getElementById('vmCards').classList.toggle('on', mode==='cards');
  document.getElementById('vmTable').classList.toggle('on', mode==='table');
  renderModels();
}
/* ===== 新收录模型开关 ===== */
function toggleNew(){
  state.includeNew = !state.includeNew;
  try{ localStorage.setItem('llm-include-new', state.includeNew ? '1' : '0'); }catch(e){}
  syncNewBtn();
  if(state.grade === 'NEW' && !state.includeNew) state.grade = '';
  syncFilterUI(); renderModels();
}
function syncNewBtn(){
  const btn = document.getElementById('newToggle');
  if(!btn) return;
  const n = AUTONEW.length;
  btn.classList.toggle('on', state.includeNew && n > 0);
  btn.textContent = n > 0 ? `🆕 新增 ${n}` : '🆕 新增';
  btn.style.display = (LIVE_LOADED && n > 0) ? '' : 'none';
}

/* ===== 工具生态动态（从 OpenRouter LIVE 实时统计）===== */
function toolEcoStats(t){
  if(!LIVE || !LIVE.length) return null;
  const vs = (t.liveVendors || []).map(v => v.toLowerCase());
  if(!vs.length) return null;
  const eco = LIVE.filter(m => {
    const v = (m.id.split('/')[0] || '').toLowerCase();
    return vs.some(x => v === x || v.includes(x) || x.includes(v));
  });
  const now = Date.now() / 1000;
  const weekAgo = now - 7*24*3600;
  const recent = eco.filter(m => m.created > weekAgo);
  const newest = eco.filter(m => m.created > 0).sort((a,b) => b.created - a.created)[0];
  return {
    count: eco.length,
    recent7: recent.length,
    newestName: newest ? (newest.name || newest.id) : null,
    newestDays: newest ? Math.max(0, Math.round((now - newest.created)/86400)) : null
  };
}
function toolEcoHTML(t){
  const s = toolEcoStats(t);
  if(!s) return '';
  const live = LIVE_LOADED ? `<span class="eco-live">LIVE</span>` : '';
  const recent = s.recent7 > 0 ? `<b class="eco-hot">+${s.recent7}</b> 7天` : `<b>0</b> 7天`;
  const newest = s.newestName ? `最新 <b>${esc(s.newestName)}</b>` : '';
  return `<div class="t-eco">📡 ${s.count}${newest?` · ${newest}`:''}${recent?` · ${recent}`:''}${live}</div>`;
}

/* ===== 工具视图 ===== */
let toolCat = '';  // 工具分类筛选（''=全部）
function renderTools(){
  const wrap = document.getElementById('main');
  // 分类 tab
  const cats = ['', '编程工具', '办公工作台', 'AI 助手', 'Agent 框架'];
  const tabs = cats.map(c => `<button class="cat-tab ${toolCat===c?'on':''}" onclick="setToolCat('${c}')">${c===''?'🌐 全部':c}</button>`).join('');
  const list = toolCat ? TOOLS.filter(t => t.category === toolCat) : TOOLS;
  const cards = list.map((t, i) => {
    const models = t.builtinModels.map(id => MODELS.find(m => m.id === id)).filter(Boolean);
    return `<div class="toolcard rise" style="animation-delay:${Math.min(i*40,400)}ms" data-mid="tool-${t.id}" data-tip-key="tool:${t.id}">
      <div class="tc-top">
        <div class="tc-logo">${toolLogo(t.id, t.name, 42)}</div>
        <div>
          <h3>${esc(t.name)} <span style="font-size:11px;background:rgba(255,255,255,.08);padding:2px 8px;border-radius:6px;color:var(--muted);font-weight:600">${esc(t.type)}</span></h3>
          <div class="t-sub">${esc(t.vendor)} · ${esc(t.platform)}</div>
        </div>
        <div class="tc-radar" title="六维能力分析">${radarSvg(toolRadarData(t).vals, RADAR_TOOL_COLOR, 72)}</div>
      </div>
      ${toolEcoHTML(t)}
      <div class="t-desc">${esc(t.desc)}</div>
      <div class="t-models">${models.map(m => `<span class="tm" onclick="openModal('${m.id}')" title="点击查看模型详情">${esc(m.name)}</span>`).join('')}</div>
      <div class="t-hl">⭐ ${esc(t.highlight)}</div>
    </div>`;
  }).join('');
  wrap.innerHTML = `<div class="view-enter">
    <div class="cat-tabs">${tabs}<span class="cat-count">共 ${list.length} 款</span></div>
    <div class="toolgrid">${cards}</div>
  </div>`;
  initCardFX();
}
function setToolCat(c){
  toolCat = c;
  renderTools();
}

/* ===== 实时动态（OpenRouter API）===== */
let LIVE = [];
let LIVE_LOADED = false;
let AUTONEW = [];               // 从 LIVE 自动收录的新旗舰模型（并入主视图）
const OR_API = 'https://openrouter.ai/api/v1/models';

/* OpenRouter 主流厂商映射：vendor前缀 → [中文厂商名, 国家] */
const OR_VENDOR = {
  'openai':['OpenAI','美国'], 'anthropic':['Anthropic','美国'], 'google':['Google','美国'],
  'deepseek':['深度求索','中国'], 'qwen':['阿里','中国'], 'moonshotai':['月之暗面','中国'],
  'z-ai':['智谱 AI','中国'], 'minimax':['MiniMax','中国'], 'bytedance-seed':['字节跳动','中国'],
  'tencent':['腾讯','中国'], 'x-ai':['xAI','美国'], 'mistralai':['Mistral','法国'],
  'meta-llama':['Meta','美国'], 'amazon':['Amazon','美国'], 'baidu':['百度','中国']
};
const VENDOR_CN = {'深度求索':'深度求索','阿里':'通义千问','智谱 AI':'智谱AI','腾讯':'腾讯混元'};

/* 本地档案已覆盖的 slug 集合（用于判重） */
function localSlugSet(){
  const s = new Set();
  MODELS.forEach(m => { s.add(m.id.toLowerCase()); if(m.orId) s.add(m.orId.split('/').pop().toLowerCase()); });
  return s;
}
/* 系列家族键：从 slug 提取「字母前缀+版本号」，如 gpt-5.6-luna → gpt5.6 */
function famKey(slug){
  const s = slug.toLowerCase();
  const m = s.match(/([a-z]+-?)?(\d+(?:\.\d+)?)/);
  const k = m ? (m[1]||'') + m[2] : s;
  return k.replace(/-/g,'');
}
/* 本地档案已覆盖的家族集合 */
function localFamSet(){
  const s = new Set();
  MODELS.forEach(m => {
    s.add((m.id.split('/')[0]||'').toLowerCase() + '|' + famKey(m.id.split('/').pop()));
    if(m.orId) s.add((m.orId.split('/')[0]||'').toLowerCase() + '|' + famKey(m.orId.split('/').pop()));
  });
  // 本地 id 无 vendor 前缀，补充「厂商→vendor前缀」的家族键
  const VENDOR2OR = {'OpenAI':'openai','Anthropic':'anthropic','Google':'google','深度求索':'deepseek','阿里':'qwen','月之暗面':'moonshotai','智谱 AI':'z-ai','MiniMax':'minimax','字节跳动':'bytedance-seed','腾讯':'tencent','百度':'baidu'};
  MODELS.forEach(m => {
    const ov = VENDOR2OR[m.vendor];
    if(ov) s.add(ov + '|' + famKey(m.id));
  });
  return s;
}
/* 从 LIVE 构建自动收录的新模型（每个系列家族取最新，近120天，主流厂商） */
function buildAutoNew(){
  AUTONEW = [];
  if(!LIVE || !LIVE.length) return;
  const local = localSlugSet();
  const localFam = localFamSet();
  const now = Date.now()/1000;
  const cutoff = now - 120*24*3600;                 // 近 120 天上线
  // 候选：主流厂商 + 近期上线 + 有上下文 + 非本地已收录/同家族
  const cand = LIVE.filter(m => {
    const vendor = (m.id.split('/')[0]||'').toLowerCase();
    if(!OR_VENDOR[vendor]) return false;
    if(!(m.created > cutoff)) return false;
    if(!(m.context_length >= 32000)) return false;   // 排除小上下文专用模型
    const slug = (m.id.split('/').pop()||'').toLowerCase();
    if(local.has(slug)) return false;
    if(local.has(m.id.toLowerCase())) return false;
    if(localFam.has(vendor + '|' + famKey(slug))) return false;
    return true;
  });
  // 按上线时间降序，家族去重（同厂商同系列只留最新一个）
  cand.sort((a,b) => b.created - a.created);
  const seenFam = new Set();
  const picked = [];
  for(const m of cand){
    const vendor = (m.id.split('/')[0]||'').toLowerCase();
    const fam = vendor + '|' + famKey(m.id.split('/').pop());
    if(seenFam.has(fam)) continue;
    seenFam.add(fam);
    picked.push(m);
    if(picked.length >= 14) break;                   // 最多收录 14 个
  }
  AUTONEW = picked.map(or => orToLocal(or));
  // 注册 hover 提示
  AUTONEW.forEach(m => { TIP_DB['model:'+m.id] = autoTipFn(m); });
}
/* OpenRouter 模型 → 本地模型结构 */
function orToLocal(or){
  const vendorKey = (or.id.split('/')[0]||'').toLowerCase();
  const [vendor, country] = OR_VENDOR[vendorKey] || [vendorKey, '—'];
  const ctxK = Math.round((or.context_length||0)/1000);
  const mods = or.architecture?.input_modalities || [];
  const multimodal = ['文本'];
  if(mods.includes('image')) multimodal.push('图像');
  if(mods.includes('audio')) multimodal.push('音频');
  if(mods.includes('video')) multimodal.push('视频');
  const thinking = !!(or.reasoning && (or.reasoning.supported_efforts?.length || or.reasoning.mandatory || or.reasoning.default_enabled));
  const pIn = parseFloat(or.pricing?.prompt);
  const perM = isNaN(pIn) ? 3 : pIn*1e6;
  const cost = perM < 0.5 ? '低' : perM < 3 ? '中' : '高';
  const slug = or.id.split('/').pop();
  return {
    id: 'auto:' + or.id, orId: or.id, name: or.name || slug,
    vendor, vendorCn: VENDOR_CN[vendor] || vendor, country,
    grade: 'NEW', context: fmtCtx(ctxK), contextVal: ctxK,
    multimodal, thinking, cost,
    scenes: ['新上架'], strengths: [thinking?'推理':'文本', ...(mods.includes('image')?['图像']:[])],
    bestFor: 'OpenRouter 新收录旗舰（自动同步，待实测评级）',
    notes: '由 OpenRouter 实时数据自动收录，尚未人工评级。价格/上下文为官方实时值。',
    tools: [], isAuto: true, created: or.created || 0,
    liveRef: or
  };
}
function autoTipFn(m){
  return () => `<div class="tip-title"><span class="tip-dot" style="background:#FF7B42"></span>${esc(m.name)} · NEW · ${m.cost}费用</div>
    <div class="tip-models">🆕 OpenRouter 自动收录 · ${fmtCtx(m.contextVal)} 上下文${m.thinking?' · 🧠推理':''}</div>
    <div class="tip-notes">待人工评级 · 点击查看详情</div>`;
}
/* 全部模型（本地档案 + 自动收录） */
function allModels(){ return state.includeNew ? MODELS.concat(AUTONEW) : MODELS; }

function isLocalModel(orId){
  const slug = (orId.split('/').pop() || '').toLowerCase();
  const inAuto = AUTONEW.some(m => m.orId === orId);
  if(inAuto) return true;
  return MODELS.some(m => {
    const mid = m.id.toLowerCase();
    return slug === mid || slug.startsWith(mid) || slug.includes(mid);
  });
}
function fmtPricePerM(p){
  const n = parseFloat(p);
  if(isNaN(n) || n < 0) return '—';
  const perM = n * 1e6 * FX;  // 美元 → 人民币（FX 实时汇率，见 fetchFx）
  if(perM === 0) return '¥0';
  if(perM < 0.01) return '¥'+perM.toFixed(3);
  if(perM < 1) return '¥'+perM.toFixed(2);
  if(perM < 100) return '¥'+perM.toFixed(1);
  return '¥'+Math.round(perM);
}
function liveModality(mods){
  const m = mods || [];
  if(!m.length) return '';
  const icons = m.map(x => x==='text'?'文本':(x==='image'?'🖼️':(x==='audio'?'🎵':(x==='video'?'🎬':x))));
  return icons.slice(0,4).join(' ');
}
function liveVendor(id){ return id.split('/')[0] || '?'; }

/* ===== 实时模型六维雷达（OpenRouter 硬指标推导）===== */
function liveRadarData(m){
  const ctx = Math.min(100, (m.context_length||0)/10000);          // 1M=100, 524K=52, 262K=26
  const pIn = parseFloat(m.pricing?.prompt);                       // 输入价性价比（越低越高分）
  const inScore = isNaN(pIn) ? 50 : Math.round(100 * (0.5 / (pIn*1e6 + 0.5)));
  const pOut = parseFloat(m.pricing?.completion);
  const outScore = isNaN(pOut) ? 50 : Math.round(100 * (1.5 / (pOut*1e6 + 1.5)));
  const mods = m.architecture?.input_modalities || [];
  let mm = 20;
  if(mods.includes('image')) mm += 35;
  if(mods.includes('audio')) mm += 25;
  if(mods.includes('video')) mm += 20;
  if(mods.includes('file')) mm += 10;
  mm = Math.min(100, mm);
  const r = m.reasoning || {};
  const reason = r.mandatory ? 100 : (r.supported_efforts && r.supported_efforts.length ? 85 : (r.default_enabled ? 80 : 40));
  const created = m.created || 0;
  const fresh = created > 0 ? Math.round(Math.max(0, Math.min(100, (created - 1735689600) / 40000000 * 100))) : 50;  // 2025-01 起线性
  return {labels:['上下文','输入价','输出价','多模态','推理','新颖度'], vals:[ctx, inScore, outScore, mm, reason, fresh]};
}

async function fetchLive(){
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(OR_API, {signal: ctrl.signal});
    clearTimeout(timer);
    const d = await res.json();
    const raw = d.data || [];
    const SKIP_ID = /router|fusion|body builder|:batch|:extended|:nightly|:free|:custom|preview-customtools/i;
    LIVE = raw.filter(m =>
      m.id && !SKIP_ID.test(m.id) && !m.id.startsWith('~') &&
      (m.context_length || 0) > 0 &&
      parseFloat(m.pricing?.prompt ?? '') >= 0
    );
    LIVE_LOADED = true;
    // 缓存到 localStorage（断网/API 挂掉时可兜底）
    try{ localStorage.setItem('llm-live-cache', JSON.stringify({ts: Date.now(), n: LIVE.length, models: LIVE.slice(0, 200)})); }catch(e){}
  }catch(e){
    // 失败时尝试用缓存兜底
    try{
      const c = JSON.parse(localStorage.getItem('llm-live-cache') || 'null');
      if(c && c.models && c.models.length){ LIVE = c.models; LIVE_LOADED = true; LIVE_CACHED = true; }
    }catch(e2){}
    if(!LIVE_LOADED){ LIVE_LOADED = false; LIVE = []; }
  }
  buildAutoNew();          // 自动收录新旗舰进主视图
  renderLive();
  renderStats();           // 统计数字含新收录
  buildFilters();          // 筛选器加 NEW 等级
  syncNewBtn();            // 新增开关按钮
  updateHeroStamp();       // hero 时间戳
  // 汇率/实时价格到位后，模型视图的卡片费用也刷新；工具视图生态统计也刷新
  if(state.view === 'models') renderModels();
  if(state.view === 'tools') renderTools();
}
let LIVE_CACHED = false;
function updateHeroStamp(){
  const el = document.getElementById('heroUpdated');
  if(!el) return;
  const t = new Date().toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false});
  const newN = AUTONEW.length;
  el.querySelector('.dot').textContent = `${t} 实时同步${newN ? ` · 🆕 自动收录 ${newN} 个新模型` : ''}${LIVE_CACHED ? ' · 缓存数据' : ''}`;
}

function renderLive(){
  const tab = document.getElementById('tabLive');
  if(!tab) return;
  if(!LIVE_LOADED){ tab.style.display='none'; if(state.view==='live') showView('models'); return; }
  tab.style.display = '';
  if(state.view !== 'live') return;

  const newest = [...LIVE].filter(m => m.created > 0).sort((a,b) => b.created - a.created).slice(0, 10);
  const bigCtx = [...LIVE].sort((a,b) => (b.context_length||0) - (a.context_length||0)).slice(0, 10);
  const cheap = [...LIVE].filter(m => (parseFloat(m.pricing?.prompt)||1) <= 0.0000012 && (m.context_length||0) >= 128000)
    .sort((a,b) => parseFloat(a.pricing?.prompt) - parseFloat(b.pricing?.prompt)).slice(0, 10);

  const wrap = document.getElementById('main');
  wrap.innerHTML = `<div class="view-enter">
    <div class="live-head">
      <span class="live-dot"></span>
      <b>实时动态</b>
      <span class="live-src">OpenRouter · ${LIVE.length} 个模型 · ${new Date().toLocaleString('zh-CN',{hour12:false})}</span>
    </div>
    ${liveSection('🆕 最新', newest, 'created')}
    ${liveSection('🚀 1M+ 上下文', bigCtx, 'ctx')}
    ${liveSection('💰 低价', cheap, 'price')}
    <div class="live-note">⚡ OpenRouter 实时数据 · 价格 ¥/1M tokens（汇率 ${FX.toFixed(3)}）· <b class="new-tag">NEW</b> 未收录 / <b class="have-tag">✓</b> 已有档案</div>
  </div>`;
}

function liveSection(title, list, kind){
  const cards = list.map((m, i) => {
    const local = isLocalModel(m.id);
    const created = m.created ? new Date(m.created*1000).toLocaleDateString('zh-CN') : '?';
    const cutoff = m.knowledge_cutoff || '—';
    const tag = local ? '<span class="have-tag">✓ 已收录</span>' : '<span class="new-tag">NEW</span>';
    const sub = kind==='created' ? `上线 ${created}` : (kind==='ctx' ? `${Math.round((m.context_length||0)/1000)}K` : fmtPricePerM(m.pricing?.prompt));
    return `<div class="live-card" style="animation-delay:${Math.min(i*70,600)}ms" onclick="openLive('${esc(m.id)}')">
      <div class="lc-body">
        <div class="lc-logo">${orVendorLogo(m.id, 34)}</div>
        <div class="lc-info">
          <div class="live-top"><span class="live-name">${esc(m.name || m.id)}</span>${tag}</div>
          <div class="live-id">${esc(m.id)}</div>
          <div class="live-meta">
            <span>上下文 <b>${Math.round((m.context_length||0)/1000)}K</b></span>
            <span>输入 <b>${fmtPricePerM(m.pricing?.prompt)}</b></span>
            <span>知识截止 <b>${cutoff}</b></span>
          </div>
          <div class="live-mm">${liveModality(m.architecture?.input_modalities)}${m.reasoning?.supported_efforts ? ' 🧠推理' : ''}</div>
          <div class="live-sub">${sub} · ${esc(liveVendor(m.id))}</div>
        </div>
        <div class="lc-radar" title="六维能力分析">${radarSvg(liveRadarData(m).vals, RADAR_LIVE_COLOR, 66)}</div>
      </div>
    </div>`;
  }).join('');
  return `<div class="live-sec"><h3>${title} <span class="live-count">${list.length}</span></h3><div class="live-grid">${cards}</div></div>`;
}

function openLive(id){
  const m = LIVE.find(x => x.id === id); if(!m) return;
  const local = MODELS.find(x => id.toLowerCase().includes(x.id.toLowerCase()));
  const mods = m.architecture?.input_modalities || [];
  document.getElementById('modalBody').innerHTML = `
    <button class="close" onclick="closeModal()">✕</button>
    <h2>${orVendorLogo(m.id, 30)} ${esc(m.name || m.id)} ${local?'<span class="tag think">✓ 本地已收录</span>':'<span class="tag" style="background:rgba(245,201,107,.15);color:var(--gold2);border-color:rgba(245,201,107,.4)">🆕 新模型</span>'}</h2>
    <div class="m-sub">${esc(m.id)} · OpenRouter 实时数据</div>
    <div class="m-grid">
      <div class="m-item"><div class="k">上下文窗口</div><div class="v">${Math.round((m.context_length||0)/1000)}K</div></div>
      <div class="m-item"><div class="k">输入价格</div><div class="v">${fmtPricePerM(m.pricing?.prompt)}/1M</div></div>
      <div class="m-item"><div class="k">输出价格</div><div class="v">${fmtPricePerM(m.pricing?.completion)}/1M</div></div>
      <div class="m-item"><div class="k">知识截止</div><div class="v">${m.knowledge_cutoff || '—'}</div></div>
    </div>
    <div class="m-sec"><h4>输入模态</h4><div class="m-row"><span class="tag">${liveModality(mods) || '文本'}</span>${m.reasoning?.supported_efforts ? '<span class="tag think">🧠 推理</span>' : ''}</div></div>
    <div class="m-sec"><h4>六维能力</h4><div class="m-row" style="align-items:flex-start">${radarBlock(liveRadarData(m), RADAR_LIVE_COLOR, 170)}</div></div>
    <div class="m-sec"><h4>上线</h4><p>${m.created ? new Date(m.created*1000).toLocaleString('zh-CN') : '未知'}</p></div>
    ${m.description ? `<div class="m-sec"><h4>描述</h4><p>${esc(m.description.slice(0,300))}</p></div>` : ''}
    ${local ? `<div class="m-sec"><h4>本地档案</h4><p><a href="#" onclick="closeModal();openModal('${local.id}');return false;">查看本地档案</a></p></div>` : ''}
    <div class="m-sec"><h4>来源</h4><p><a href="https://openrouter.ai/${esc(m.id)}" target="_blank">OpenRouter</a></p></div>`;
  document.getElementById('modalMask').classList.add('show');
}

/* ===== 视图切换 ===== */
function showView(v){
  state.view = v;
  document.getElementById('tabModels').classList.toggle('on', v==='models');
  document.getElementById('tabTools').classList.toggle('on', v==='tools');
  const tl = document.getElementById('tabLive');
  if(tl) tl.classList.toggle('on', v==='live');
  if(v==='models') renderModels();
  else if(v==='tools') renderTools();
  else renderLive();
}

/* ===== 详情弹窗 ===== */
function openModal(id){
  const m = allModels().find(x => x.id === id); if(!m) return;
  if(m.isAuto) return openAutoModal(m);
  const tools = (m.tools||[]).map(tid => toolById[tid]).filter(Boolean);
  const toolStr = tools.length ? tools.map(t => `<span class="tool-badge ${toolBadgeClass[t.id]||'other'}" style="cursor:default">${esc(t.name)}</span>`).join('') : '<span style="color:var(--dim)">未内置任何 Agent 工具</span>';
  document.getElementById('modalBody').innerHTML = `
    <button class="close" onclick="closeModal()">✕</button>
    <h2>${vendorLogo(m.vendorCn || m.vendor, 30)}<span class="grade" style="background:${gradeColor(m.grade)}">${m.grade}</span>${esc(m.name)}</h2>
    <div class="m-sub">${esc(m.vendorCn||m.vendor)} · ${m.country} · ${fmtCtx(m.contextVal)} 上下文 · ${m.cost}费用${m.thinking?' · 🧠 思考模式':''}</div>
    <div class="m-grid">
      <div class="m-item"><div class="k">综合等级</div><div class="v" style="color:${gradeColor(m.grade)}">${m.grade} · ${META.gradeDef[m.grade].label}</div></div>
      <div class="m-item"><div class="k">上下文窗口</div><div class="v">${fmtCtx(m.contextVal)}</div></div>
      <div class="m-item"><div class="k">多模态输入</div><div class="v">${m.multimodal.join(' / ')}</div></div>
      <div class="m-item"><div class="k">费用水平</div><div class="v">${m.cost}</div></div>
    </div>
    <div class="m-sec"><h4>选型</h4><p>${esc(m.bestFor)}</p></div>
    <div class="m-sec"><h4>六维能力</h4><div class="m-row" style="align-items:flex-start">${radarBlock(radarData(m), gradeColor(m.grade), 170)}</div></div>
    <div class="m-sec"><h4>场景</h4><div class="m-row">${m.scenes.map(s=>`<span class="tag">${esc(s)}</span>`).join('')}</div></div>
    <div class="m-sec"><h4>擅长</h4><div class="m-row">${m.strengths.map(s=>`<span class="tag think">${esc(s)}</span>`).join('')}</div></div>
    <div class="m-sec"><h4>Agent 工具</h4><div class="m-row">${toolStr}</div></div>
    <div class="m-sec"><h4>备注</h4><p>${esc(m.notes)}</p></div>`;
  document.getElementById('modalMask').classList.add('show');
}
/* 自动收录模型弹窗（用 OpenRouter 实时数据） */
function openAutoModal(m){
  const or = m.liveRef || {};
  const days = m.created ? Math.max(0, Math.round((Date.now()/1000 - m.created)/86400)) : null;
  document.getElementById('modalBody').innerHTML = `
    <button class="close" onclick="closeModal()">✕</button>
    <h2>${vendorLogo(m.vendorCn || m.vendor, 30)}<span class="grade new" style="background:${gradeColor('NEW')}">NEW</span>${esc(m.name)}</h2>
    <div class="m-sub">${esc(m.vendorCn)} · ${m.country} · ${fmtCtx(m.contextVal)} 上下文 · ${m.cost}费用${m.thinking?' · 🧠 推理':''}${days!==null?` · ${days}天前上线`:''}</div>
    <div class="m-grid">
      <div class="m-item"><div class="k">状态</div><div class="v" style="color:#FF7B42">新收录 · 待评级</div></div>
      <div class="m-item"><div class="k">输入价格</div><div class="v">${fmtPricePerM(or.pricing?.prompt)}/1M</div></div>
      <div class="m-item"><div class="k">输出价格</div><div class="v">${fmtPricePerM(or.pricing?.completion)}/1M</div></div>
      <div class="m-item"><div class="k">多模态</div><div class="v">${m.multimodal.join(' / ')}</div></div>
    </div>
    <div class="m-sec"><h4>六维能力（实时指标推导）</h4><div class="m-row" style="align-items:flex-start">${radarBlock(liveRadarData(or), RADAR_LIVE_COLOR, 170)}</div></div>
    ${or.description ? `<div class="m-sec"><h4>官方描述</h4><p>${esc(or.description.slice(0,300))}</p></div>` : ''}
    <div class="m-sec"><h4>来源</h4><p>OpenRouter 自动收录 · <a href="https://openrouter.ai/${esc(m.orId)}" target="_blank">模型主页</a></p></div>`;
  document.getElementById('modalMask').classList.add('show');
}
function closeModal(){ document.getElementById('modalMask').classList.remove('show'); }
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });

/* ===== 筛选器构建 ===== */
function buildFilters(){
  const grades = Object.keys(META.gradeDef).concat(AUTONEW.length ? ['NEW'] : []);
  document.getElementById('gradeFilter').innerHTML =
    `<span>等级</span>` +
    grades.map(g => {
      const lbl = g === 'NEW' ? '新收录' : META.gradeDef[g].label;
      return `<button class="fbtn ${state.grade===g?'on':''}" data-k="grade" data-v="${g}">${g} ${lbl}</button>`;
    }).join('');
  const vendors = [...new Set(allModels().map(m => m.vendor))].sort();
  document.getElementById('vendorFilter').innerHTML =
    `<span>厂商</span>` +
    vendors.map(v => `<button class="fbtn vendor-${v} ${state.vendor===v?'on':''}" data-k="vendor" data-v="${v}">${v}</button>`).join('');
  const mms = ['多模态','思考模式','1M上下文'];
  document.getElementById('mmFilter').innerHTML =
    `<span>能力</span>` +
    mms.map(m => `<button class="fbtn ${state.mm===m?'on':''}" data-k="mm" data-v="${m}">${m}</button>`).join('');
  document.querySelectorAll('.fgroup button.fbtn').forEach(b => {
    b.addEventListener('click', e => {
      // ripple 反馈（ui-interaction：点击有位置反馈）
      const rect = b.getBoundingClientRect();
      b.style.setProperty('--rx', (e.clientX-rect.left)+'px');
      b.style.setProperty('--ry', (e.clientY-rect.top)+'px');
      toggleFilter(b.dataset.k, b.dataset.v);
    });
  });
}
function toggleFilter(k, v){
  state[k] = (state[k] === v) ? '' : v;
  syncFilterUI(); renderModels();
}
function syncFilterUI(){
  document.querySelectorAll('.fgroup button.fbtn').forEach(b => {
    b.classList.toggle('on', b.dataset.v === state[b.dataset.k]);
  });
}

/* ===== 统计图表（v3.1：环形图/堆叠条）===== */
function renderStats(){
  const list = allModels();
  const gs = Object.keys(META.gradeDef).concat(AUTONEW.length ? ['NEW'] : []);
  const total = list.length;
  // 数据
  const gradeCount = {};
  gs.forEach(g => gradeCount[g] = list.filter(m=>m.grade===g).length);
  const thinkN = list.filter(m=>m.thinking).length;
  const mmN = list.filter(m => m.multimodal.length>1 || m.multimodal.includes('图像') || m.multimodal.includes('音频') || m.multimodal.includes('视频')).length;
  const oneMN = list.filter(m=>m.contextVal>=1000).length;
  // 上下文分段
  const ctx256 = list.filter(m=>m.contextVal>=256 && m.contextVal<1000).length;
  const ctx128 = list.filter(m=>m.contextVal<256).length;
  // 环形图 arc 生成（SVG stroke-dasharray 动画 + data-tip 悬浮）
  function donut(segs, centerNum, centerLbl){
    const R = 42, C = 2*Math.PI*R;
    let acc = 0;
    const arcs = segs.map(s => {
      const len = C * s.v / total;
      const el = `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${s.c}" stroke-width="13"
        stroke-dasharray="0 500" style="--len:${len.toFixed(2)} 500" class="donut-arc"
        data-tip="${esc(s.tipTitle)}" data-models="${esc(s.tipModels.join(','))}"
        transform="rotate(${acc.toFixed(1)} 50 50)"/>`;
      acc += len;
      return el;
    }).join('');
    const legend = segs.map(s => `<div class="dl-row"><span class="dl-dot" style="background:${s.c}"></span>${s.l}<b>${s.v}</b><span class="dl-pct">${Math.round(s.v/total*100)}%</span></div>`).join('');
    return `<div class="donut-wrap">
      <div class="donut-box"><svg viewBox="0 0 100 100">${arcs}</svg>
        <div class="donut-center"><span class="dc-num">${centerNum}</span><span class="dc-lbl">${centerLbl}</span></div>
      </div>
      <div class="donut-legend">${legend}</div>
    </div>`;
  }
  const gradeSegs = gs.map(g => ({
    v: gradeCount[g], c: g==='NEW' ? '#FF7B42' : META.gradeDef[g].color, l: g+'级',
    tipTitle: g==='NEW' ? '新收录模型' : g+' 级模型', tipModels: list.filter(m=>m.grade===g).map(m=>m.name)
  })).filter(s => s.v > 0);
  const thinkModels = list.filter(m=>m.thinking).map(m=>m.name);
  const mmModels = list.filter(m => !m.thinking && (m.multimodal.length>1 || m.multimodal.includes('图像') || m.multimodal.includes('音频') || m.multimodal.includes('视频'))).map(m=>m.name);
  const textModels = list.filter(m => !m.thinking && !(m.multimodal.length>1 || m.multimodal.includes('图像') || m.multimodal.includes('音频') || m.multimodal.includes('视频'))).map(m=>m.name);
  const capSegs = [
    {v: thinkN, c: 'var(--gold)', l: '思考模式', tipTitle: '思考模式模型', tipModels: thinkModels},
    {v: mmModels.length, c: 'var(--violet)', l: '多模态', tipTitle: '多模态模型（无思考）', tipModels: mmModels},
    {v: textModels.length, c: 'rgba(255,255,255,.14)', l: '纯文本', tipTitle: '纯文本模型', tipModels: textModels}
  ].filter(s => s.v > 0);
  const ctxSegs = [
    {v: oneMN, c: 'var(--gold)', l: '1M+', tipTitle: '1M+ 上下文模型', tipModels: list.filter(m=>m.contextVal>=1000).map(m=>m.name)},
    {v: ctx256, c: 'var(--cyan)', l: '256K~999K', tipTitle: '256K~999K 模型', tipModels: list.filter(m=>m.contextVal>=256 && m.contextVal<1000).map(m=>m.name)},
    {v: ctx128, c: 'rgba(255,255,255,.22)', l: '<256K', tipTitle: '<256K 上下文模型', tipModels: list.filter(m=>m.contextVal<256).map(m=>m.name)}
  ].filter(s => s.v > 0);
  const ctxBars = ctxSegs.map(s => `<div class="bs-seg" style="background:${s.c};flex-basis:${s.v/total*100}%"
    data-tip="${esc(s.tipTitle)}" data-models="${esc(s.tipModels.join(','))}"></div>`).join('');
  const ctxRows = ctxSegs.map(s => `<div class="bs-row"><span class="bs-dot" style="background:${s.c}"></span>${s.l}<b>${s.v}</b><span class="bs-pct">${Math.round(s.v/total*100)}%</span></div>`).join('');

  document.getElementById('hdStats').innerHTML = `
    <div class="stat rise">
      <div class="stat-title">模型库</div>
      <div class="stat-hero">
        <div class="hero-num" data-count="${total}">0</div>
        <div class="hero-sub">
          <div class="sub-item">工具 <b data-count2="${TOOLS.length}">0</b> · 1M+ <b style="color:var(--gold)">${oneMN}</b></div>
        </div>
      </div>
    </div>
    <div class="stat rise" style="animation-delay:80ms">
      <div class="stat-title">等级</div>
      ${donut(gradeSegs, total, '模型')}
    </div>
    <div class="stat rise" style="animation-delay:160ms">
      <div class="stat-title">能力</div>
      ${donut(capSegs, thinkN, '思考')}
    </div>
    <div class="stat rise" style="animation-delay:240ms">
      <div class="stat-title">上下文</div>
      <div class="barstack">
        <div class="bs-track">${ctxBars}</div>
        ${ctxRows}
      </div>
    </div>`;
  // count-up 动画（hero 数字 + 工具数）
  const t0 = performance.now(), dur = 1100;
  const step = now => {
    const p = Math.min(1, (now - t0)/dur), ease = 1 - Math.pow(1-p, 3);
    const n1 = document.querySelector('.hero-num[data-count]');
    const n2 = document.querySelector('[data-count2]');
    if(n1) n1.textContent = Math.round(total * ease);
    if(n2) n2.textContent = Math.round(TOOLS.length * ease);
    if(p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ===== 动效系统（ui-motion 方法论）===== */
let reducedMotion = false;
try{ reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}

/* scroll-reveal：IO 观察，进入视口渐入 */
function initReveal(){
  if(reducedMotion){ document.querySelectorAll('.scroll-reveal').forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, {threshold: .08, rootMargin: '0px 0px -40px 0px'});
  document.querySelectorAll('.scroll-reveal').forEach(el => io.observe(el));
}

/* 卡片 3D tilt + 光标聚光：输入(pointer) → lerp 状态 → transform/CSS变量 */
function initCardFX(){
  if(reducedMotion) return;
  const cards = document.querySelectorAll('.mcard, .toolcard');
  cards.forEach(card => {
    if(card.dataset.fx) return;
    card.dataset.fx = '1';
    let target = {x:0, y:0, mx:50, my:0};
    let smooth = {x:0, y:0};
    let raf = null;
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;   // 0..1
      const py = (e.clientY - r.top) / r.height;
      target.x = (px - .5) * 8;                     // 最大 ±4°
      target.y = (py - .5) * -8;
      target.mx = px * 100; target.my = py * 100;
      if(!raf){
        raf = requestAnimationFrame(function tick(){
          smooth.x += (target.x - smooth.x) * .14;  // lerp 系数
          smooth.y += (target.y - smooth.y) * .14;
          card.style.setProperty('--rx', smooth.x.toFixed(2)+'deg');
          card.style.setProperty('--ry', smooth.y.toFixed(2)+'deg');
          card.style.setProperty('--mx', target.mx+'%');
          card.style.setProperty('--my', target.my+'%');
          if(Math.abs(target.x - smooth.x) > .02 || Math.abs(target.y - smooth.y) > .02){
            raf = requestAnimationFrame(tick);
          } else { raf = null; }
        });
      }
    });
    card.addEventListener('mouseleave', () => {
      target = {x:0, y:0, mx:50, my:0};
      if(raf){ cancelAnimationFrame(raf); raf = null; }
      card.style.setProperty('--rx','0deg');
      card.style.setProperty('--ry','0deg');
    });
  });
  // 上下文条展开动画
  requestAnimationFrame(() => {
    document.querySelectorAll('.mcard .mc-ctx').forEach((el, i) => {
      setTimeout(() => el.classList.add('ctx-in'), 150 + i*35);
    });
  });
}

/* ===== 图表/卡片悬浮提示（事件委托 + 生命周期）===== */
(function(){
  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.id = 'chartTip';
  document.body.appendChild(tip);
  let hideTimer = null;
  function showTip(html){
    tip.innerHTML = html;
    tip.classList.add('show');
  }
  function hideTip(){ clearTimeout(hideTimer); tip.classList.remove('show'); }
  // 内容生成：data-tip（标题+芯片）或 data-tip-key（模型/工具索引）
  function tipContent(el){
    const key = el.dataset.tipKey;
    if(key){ return TIP_DB[key] ? TIP_DB[key]() : null; }
    const models = (el.dataset.models || '').split(',').filter(Boolean);
    const chips = models.slice(0, 8).map(n => `<span class="tm">${esc(n)}</span>`).join('');
    const more = models.length > 8 ? `<div class="tip-more">… 共 ${models.length} 个</div>` : '';
    return `<div class="tip-title"><span class="tip-dot" style="background:var(--gold)"></span>${esc(el.dataset.tip || '模型')}</div>
      <div class="tip-models">${chips}${more}</div>`;
  }
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip], [data-tip-key]');
    if(!el) { hideTip(); return; }
    const html = tipContent(el);
    if(html) showTip(html); else hideTip();
  });
  document.addEventListener('mousemove', e => {
    if(!tip.classList.contains('show')) return;
    const pad = 14;
    const tw = 280, th = 150; // 预估尺寸用于边缘翻转
    let x = e.clientX + pad, y = e.clientY + pad;
    if(x + tw > window.innerWidth) x = e.clientX - tw - pad;
    if(y + th > window.innerHeight) y = e.clientY - th - pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  });
  document.addEventListener('mouseout', e => {
    if(e.target.closest && !e.target.closest('[data-tip], [data-tip-key]')) hideTip();
  });
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('resize', hideTip);
})();

/* ===== 模型卡/工具卡悬浮内容库 ===== */
const TIP_DB = {};
MODELS.forEach(m => {
  TIP_DB['model:' + m.id] = () => `
    <div class="tip-title"><span class="tip-dot" style="background:${gradeColor(m.grade)}"></span>${esc(m.name)} · ${m.grade}级 · ${m.cost}费用</div>
    <div class="tip-models">🎯 ${m.scenes.slice(0,4).map(s=>`<span class="tm">${esc(s)}</span>`).join('')}</div>
    ${m.notes ? `<div class="tip-notes">${esc(m.notes)}</div>` : ''}`;
});
TOOLS.forEach(t => {
  const cnt = (t.builtinModels||[]).length;
  TIP_DB['tool:' + t.id] = () => `
    <div class="tip-title"><span class="tip-dot" style="background:var(--cyan)"></span>${esc(t.name)} · ${cnt} 个内置模型</div>
    <div class="tip-models">⚙️ ${esc(t.modelMode)}<br>🎚️ ${esc(t.modelSelect)}</div>
    <div class="tip-notes">⭐ ${esc(t.highlight)}</div>`;
});

/* ===== 主题切换（黑夜/白天）===== */
function currentTheme(){
  return document.documentElement.getAttribute('data-theme') || 'dark';
}
function toggleTheme(){
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try{ localStorage.setItem('llm-theme', next); }catch(e){}
  syncThemeBtn();
}
function syncThemeBtn(){
  const btn = document.getElementById('themeBtn');
  if(!btn) return;
  const dark = currentTheme() === 'dark';
  btn.textContent = dark ? '🌙' : '☀️';
  btn.title = dark ? '切换到白天模式' : '切换到黑夜模式';
}

/* ===== 初始化 ===== */
document.getElementById('searchBox').addEventListener('input', e => { state.q = e.target.value.trim(); renderModels(); });
document.getElementById('sortBox').addEventListener('change', e => { state.sort = e.target.value; renderModels(); });
try{ state.includeNew = localStorage.getItem('llm-include-new') !== '0'; }catch(e){}
renderStats();
buildFilters();
renderModels();
syncThemeBtn();
syncNewBtn();
fetchLive();
fetchFx();  // 异步拉取实时汇率，失败自动回退 meta 固定值
