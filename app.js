'use strict';
/* ===== 数据加载 ===== */
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
  view: 'models',
  q: '', grade: '', vendor: '', mm: '', sort: 'grade',
  modalId: null
};

/* ===== 工具函数 ===== */
function esc(s){return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function gradeColor(g){return META.gradeDef[g] ? META.gradeDef[g].color : '#64748b';}
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

function toolBadges(model){
  const ids = model.tools || [];
  if(!ids.length) return '<span class="cost" style="color:#5b6478">未内置</span>';
  return ids.map(id => {
    const t = toolById[id]; if(!t) return '';
    const cls = toolBadgeClass[id] || 'other';
    return `<span class="tool-badge ${cls}" title="${esc(t.name)} · ${esc(t.type)}">${esc(t.name)}</span>`;
  }).join('');
}

/* ===== 任务推荐词典（搜索框智能推荐）===== */
const TASKS = [
  { kw:["做ppt","做ppt","ppt","演示","汇报","课件","幻灯片","路演"], label:"做PPT/演示汇报",
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
    reason:"中文场景国产模型更懂语境，Qwen 2.4T 参数中文能力最强" }
];

function matchTask(q){
  const lower = q.toLowerCase();
  for(const t of TASKS){
    if(t.kw.some(k => lower.includes(k))) return t;
  }
  return null;
}

function scoreModel(m, task){
  let s = 0;
  (task.scenes||[]).forEach(sc => { if((m.scenes||[]).includes(sc)) s += 3; });
  (task.strengths||[]).forEach(st => { if((m.strengths||[]).includes(st)) s += 2; });
  if(task.top && task.top.includes(m.id)) s += 6;
  s += (META.gradeScore[m.grade]||0);
  if(m.cost === '低') s += 1;
  return s;
}

/* ===== 过滤 ===== */
function filteredModels(){
  let list = MODELS.slice();
  if(state.grade) list = list.filter(m => m.grade === state.grade);
  if(state.vendor) list = list.filter(m => m.vendor === state.vendor);
  if(state.mm){
    if(state.mm === '多模态') list = list.filter(m => m.multimodal.length > 1 || m.multimodal.includes('图像') || m.multimodal.includes('音频') || m.multimodal.includes('视频'));
    else if(state.mm === '思考模式') list = list.filter(m => m.thinking);
    else if(state.mm === '1M上下文') list = list.filter(m => m.contextVal >= 1000);
  }
  if(state.q){
    const task = matchTask(state.q);
    if(task){
      // 推荐模式：按任务评分排序，保留 Top8
      list = list.map(m => ({m, s: scoreModel(m, task)}))
        .sort((a,b) => b.s - a.s)
        .slice(0, 8)
        .map(x => x.m);
    } else {
      const q = state.q.toLowerCase();
      list = list.filter(m => {
        const hay = [m.name, m.vendor, m.vendorCn, m.bestFor, m.strengths.join(' '), m.scenes.join(' '), m.notes, fmtCtx(m.contextVal), m.context].join(' ').toLowerCase();
        return hay.includes(q);
      });
    }
  } else if(state.sort === 'context') list.sort((a,b) => b.contextVal - a.contextVal);
  else if(state.sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'zh'));
  else list.sort((a,b) => (META.gradeScore[b.grade]||0) - (META.gradeScore[a.grade]||0));
  return list;
}

/* ===== 推荐横幅 ===== */
function recoBanner(){
  if(!state.q) return '';
  const task = matchTask(state.q);
  if(!task) return '';
  const scored = MODELS.map(m => ({m, s: scoreModel(m, task)}))
    .sort((a,b) => b.s - a.s)
    .slice(0, 3);
  const chips = scored.map(x => {
    const m = x.m;
    return `<span class="reco-chip" onclick="openModal('${m.id}')">
      <span class="grade" style="background:${gradeColor(m.grade)};width:22px;height:22px;font-size:11px;border-radius:6px">${m.grade}</span>
      <b>${esc(m.name)}</b>
      <i>${esc(m.bestFor.split('——')[0])}</i>
    </span>`;
  }).join('');
  return `<div class="reco">
    <div class="reco-head">🎯 智能推荐：<b>${esc(task.label)}</b> <span class="reco-reason">${esc(task.reason)}</span></div>
    <div class="reco-chips">${chips}</div>
    <div class="reco-tip">↓ 以下为按任务匹配度排序的前 8 个模型，点击查看详情</div>
  </div>`;
}

/* ===== 表格渲染 ===== */
function renderModels(){
  const list = filteredModels();
  const wrap = document.getElementById('main');
  if(!list.length){
    wrap.innerHTML = '<div class="empty"><b>没有匹配的模型</b>试试放宽筛选条件或清空搜索</div>';
    return;
  }
  const rows = list.map(m => `
    <tr onclick="openModal('${m.id}')">
      <td><span class="m-name"><span class="grade" style="background:${gradeColor(m.grade)}">${m.grade}</span>${esc(m.name)}<span class="flag">${m.country==='中国'?'🇨🇳':'🇺🇸'}</span></span><div class="m-vendor">${esc(m.vendorCn || m.vendor)}</div></td>
      <td class="ctx-cell"><div class="ctxbar"><div class="bar"><div class="fill" style="width:${Math.min(100, m.contextVal/10)}%"></div></div><span class="txt">${fmtCtx(m.contextVal)}</span></div></td>
      <td><div class="mm">${mmIcon(m.multimodal)}</div></td>
      <td>${m.thinking?'<span class="tag think">🧠 思考</span>':''}${(m.strengths||[]).slice(0,3).map(s=>`<span class="tag">${esc(s)}</span>`).join('')}</td>
      <td><span class="cost ${costClass(m.cost)}">${m.cost}</span></td>
      <td><div class="toolcell">${toolBadges(m)}</div></td>
    </tr>`).join('');
  wrap.innerHTML = recoBanner() + `
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>模型</th><th>上下文</th><th>多模态</th><th>擅长领域</th><th>费用</th><th>Agent 工具</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  // stagger 入场动画（Motion-Driven）
  requestAnimationFrame(() => {
    document.querySelectorAll('#main tbody tr').forEach((tr, i) => {
      tr.style.opacity = '0';
      tr.style.transform = 'translateY(6px)';
      setTimeout(() => {
        tr.style.transition = 'opacity .3s ease, transform .3s ease';
        tr.style.opacity = '1';
        tr.style.transform = 'translateY(0)';
      }, Math.min(i * 18, 400));
    });
  });
}

/* ===== 工具视图渲染 ===== */
function renderTools(){
  const wrap = document.getElementById('main');
  const cards = TOOLS.map(t => {
    const models = t.builtinModels.map(id => MODELS.find(m => m.id === id)).filter(Boolean);
    return `
    <div class="toolcard">
      <h3>${esc(t.name)} <span class="grade" style="background:#3a4154;font-size:11px;width:auto;padding:0 8px">${esc(t.type)}</span></h3>
      <div class="t-sub">${esc(t.vendor)} · ${esc(t.platform)}</div>
      <div class="t-desc">${esc(t.desc)}</div>
      <div class="t-mode">模型模式：<b>${esc(t.modelMode)}</b></div>
      <div class="t-mode">模型选择：<b>${esc(t.modelSelect)}</b></div>
      <div class="t-models">${models.map(m => `<span class="tm" onclick="openModal('${m.id}')" title="点击查看模型详情">${esc(m.name)}</span>`).join('')}</div>
      <div class="t-hl">⭐ ${esc(t.highlight)}</div>
      <div class="t-src">来源：${esc(t.source)}</div>
    </div>`;
  }).join('');
  wrap.innerHTML = `<div class="toolgrid">${cards}</div>`;
}

/* ===== 实时动态（OpenRouter API）===== */
let LIVE = [];          // 清洗后的实时模型
let LIVE_LOADED = false;
const OR_API = 'https://openrouter.ai/api/v1/models';

function isLocalModel(orId){
  // 本地已收录匹配：用 slug 主体与本地 id 精确匹配
  const slug = (orId.split('/').pop() || '').toLowerCase();
  return MODELS.some(m => {
    const mid = m.id.toLowerCase();
    return slug === mid || slug.startsWith(mid) || slug.includes(mid);
  });
}
function fmtPricePerM(p){
  const n = parseFloat(p);
  if(isNaN(n) || n < 0) return '—';
  const perM = n * 1e6;
  if(perM === 0) return '$0';
  if(perM < 0.01) return '$'+perM.toFixed(3);
  if(perM < 1) return '$'+perM.toFixed(2);
  return '$'+perM.toFixed(0);
}
function liveModality(mods){
  const m = mods || [];
  if(!m.length) return '';
  const icons = m.map(x => x==='text'?'文本':(x==='image'?'🖼️':(x==='audio'?'🎵':(x==='video'?'🎬':x))));
  return icons.slice(0,4).join(' ');
}
function liveVendor(id){
  return id.split('/')[0] || '?';
}

async function fetchLive(){
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(OR_API, {signal: ctrl.signal});
    clearTimeout(timer);
    const d = await res.json();
    const raw = d.data || [];
    // 清洗：去掉变体、无效项、OpenRouter 特殊路由模型
    const SKIP_ID = /router|fusion|body builder|:batch|:extended|:nightly|:free/i;
    LIVE = raw.filter(m =>
      m.id && !SKIP_ID.test(m.id) && !m.id.startsWith('~') &&
      (m.context_length || 0) > 0 &&
      parseFloat(m.pricing?.prompt ?? '') >= 0
    );
    LIVE_LOADED = true;
  }catch(e){
    LIVE_LOADED = false;
    LIVE = [];
  }
  renderLive();
}

function renderLive(){
  const tab = document.getElementById('tabLive');
  if(!tab) return;
  if(!LIVE_LOADED){
    tab.style.display = 'none';
    if(state.view === 'live'){ showView('models'); }
    return;
  }
  tab.style.display = '';
  if(state.view !== 'live') return;

  // 三块数据
  const newest = [...LIVE].filter(m => m.created > 0).sort((a,b) => b.created - a.created).slice(0, 10);
  const bigCtx = [...LIVE].sort((a,b) => (b.context_length||0) - (a.context_length||0)).slice(0, 10);
  const cheap = [...LIVE].filter(m => (parseFloat(m.pricing?.prompt)||1) <= 0.0000012 && (m.context_length||0) >= 128000)
    .sort((a,b) => parseFloat(a.pricing?.prompt) - parseFloat(b.pricing?.prompt)).slice(0, 10);

  const wrap = document.getElementById('main');
  wrap.innerHTML = `
    <div class="live-head">
      <span class="live-dot"></span>
      <b>实时模型动态</b>
      <span class="live-src">OpenRouter API 实时拉取 · ${LIVE.length} 个模型 · ${new Date().toLocaleString('zh-CN',{hour12:false})}</span>
    </div>
    ${liveSection('🆕 最新上线', newest, 'created')}
    ${liveSection('🚀 超长上下文 (1M+)', bigCtx, 'ctx')}
    ${liveSection('💰 低价精选 (≥128K 上下文)', cheap, 'price')}
    <div class="live-note">⚡ 数据来自 OpenRouter 公开 API，实时反映各厂商最新上架模型；标 <b class="new-tag">NEW</b> 为本站未收录新模型，<b class="have-tag">✓</b> 为本地已有档案。价格 = 输入 $/1M tokens。</div>
  `;
}

function liveSection(title, list, kind){
  const cards = list.map(m => {
    const local = isLocalModel(m.id);
    const created = m.created ? new Date(m.created*1000).toLocaleDateString('zh-CN') : '?';
    const cutoff = m.knowledge_cutoff || '—';
    const tag = local ? '<span class="have-tag">✓ 已收录</span>' : '<span class="new-tag">NEW</span>';
    const sub = kind==='created' ? `上线 ${created}` : (kind==='ctx' ? `${Math.round((m.context_length||0)/1000)}K` : fmtPricePerM(m.pricing?.prompt));
    return `<div class="live-card" onclick="openLive('${esc(m.id)}')">
      <div class="live-top"><span class="live-name">${esc(m.name || m.id)}</span>${tag}</div>
      <div class="live-id">${esc(m.id)}</div>
      <div class="live-meta">
        <span>上下文 <b>${Math.round((m.context_length||0)/1000)}K</b></span>
        <span>输入 <b>${fmtPricePerM(m.pricing?.prompt)}</b></span>
        <span>知识截止 <b>${cutoff}</b></span>
      </div>
      <div class="live-mm">${liveModality(m.architecture?.input_modalities)}${m.reasoning?.supported_efforts ? ' 🧠推理' : ''}</div>
      <div class="live-sub">${sub} · ${esc(liveVendor(m.id))}</div>
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
    <h2>${esc(m.name || m.id)} ${local?'<span class="tag think">✓ 本地已收录</span>':'<span class="tag" style="background:rgba(240,199,94,.15);color:var(--gold2);border-color:rgba(240,199,94,.4)">🆕 新模型</span>'}</h2>
    <div class="m-sub">${esc(m.id)} · OpenRouter 实时数据</div>
    <div class="m-grid">
      <div class="m-item"><div class="k">上下文窗口</div><div class="v">${Math.round((m.context_length||0)/1000)}K</div></div>
      <div class="m-item"><div class="k">输入价格</div><div class="v">${fmtPricePerM(m.pricing?.prompt)}/1M</div></div>
      <div class="m-item"><div class="k">输出价格</div><div class="v">${fmtPricePerM(m.pricing?.completion)}/1M</div></div>
      <div class="m-item"><div class="k">知识截止</div><div class="v">${m.knowledge_cutoff || '—'}</div></div>
    </div>
    <div class="m-sec"><h4>🔧 输入模态</h4><div class="m-row"><span class="tag">${liveModality(mods) || '文本'}</span>${m.reasoning?.supported_efforts ? '<span class="tag think">🧠 支持推理模式</span>' : ''}</div></div>
    <div class="m-sec"><h4>📅 上线时间</h4><p>${m.created ? new Date(m.created*1000).toLocaleString('zh-CN') : '未知'}</p></div>
    ${m.description ? `<div class="m-sec"><h4>📝 官方描述</h4><p>${esc(m.description.slice(0,300))}</p></div>` : ''}
    ${local ? `<div class="m-sec"><h4>🔗 本站档案</h4><p>此模型已有本地实测档案，<a href="#" onclick="closeModal();openModal('${local.id}');return false;">点击查看</a>（等级/场景/Agent工具）</p></div>` : ''}
    <div class="m-sec"><h4>🔗 来源</h4><p>OpenRouter API：<a href="https://openrouter.ai/${esc(m.id)}" target="_blank">https://openrouter.ai/${esc(m.id)}</a></p></div>`;
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
  const m = MODELS.find(x => x.id === id); if(!m) return;
  const tools = (m.tools||[]).map(tid => toolById[tid]).filter(Boolean);
  const toolStr = tools.length ? tools.map(t => `<span class="tool-badge ${toolBadgeClass[t.id]||'other'}" style="cursor:default">${esc(t.name)}</span>`).join('') : '<span style="color:#5b6478">未内置任何 Agent 工具</span>';
  document.getElementById('modalBody').innerHTML = `
    <button class="close" onclick="closeModal()">✕</button>
    <h2><span class="grade" style="background:${gradeColor(m.grade)}">${m.grade}</span>${esc(m.name)}</h2>
    <div class="m-sub">${esc(m.vendorCn||m.vendor)} · ${m.country} · ${fmtCtx(m.contextVal)} 上下文 · ${m.cost}费用${m.thinking?' · 🧠 思考模式':''}</div>
    <div class="m-grid">
      <div class="m-item"><div class="k">综合等级</div><div class="v" style="color:${gradeColor(m.grade)}">${m.grade} · ${META.gradeDef[m.grade].label}</div></div>
      <div class="m-item"><div class="k">上下文窗口</div><div class="v">${fmtCtx(m.contextVal)}</div></div>
      <div class="m-item"><div class="k">多模态输入</div><div class="v">${m.multimodal.join(' / ')}</div></div>
      <div class="m-item"><div class="k">费用水平</div><div class="v">${m.cost}</div></div>
    </div>
    <div class="m-sec"><h4>💡 一句话选型</h4><p>${esc(m.bestFor)}</p></div>
    <div class="m-sec"><h4>🎯 适用场景</h4><div class="m-row">${m.scenes.map(s=>`<span class="tag">${esc(s)}</span>`).join('')}</div></div>
    <div class="m-sec"><h4>🏆 擅长领域</h4><div class="m-row">${m.strengths.map(s=>`<span class="tag think">${esc(s)}</span>`).join('')}</div></div>
    <div class="m-sec"><h4>🧩 内置此模型的 Agent 工具</h4><div class="m-row">${toolStr}</div></div>
    <div class="m-sec"><h4>📝 备注</h4><p>${esc(m.notes)}</p></div>`;
  document.getElementById('modalMask').classList.add('show');
}
function closeModal(){ document.getElementById('modalMask').classList.remove('show'); }
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeModal(); });

/* ===== 筛选器构建 ===== */
function buildFilters(){
  const grades = Object.keys(META.gradeDef);
  document.getElementById('gradeFilter').innerHTML =
    `<span style="opacity:.7">等级</span>` +
    grades.map(g => `<button class="fbtn ${state.grade===g?'on':''}" data-k="grade" data-v="${g}">${g} ${META.gradeDef[g].label}</button>`).join('');
  const vendors = [...new Set(MODELS.map(m => m.vendor))].sort();
  document.getElementById('vendorFilter').innerHTML =
    `<span style="opacity:.7">厂商</span>` +
    vendors.map(v => `<button class="fbtn vendor-${v} ${state.vendor===v?'on':''}" data-k="vendor" data-v="${v}">${v}</button>`).join('');
  const mms = ['多模态','思考模式','1M上下文'];
  document.getElementById('mmFilter').innerHTML =
    `<span style="opacity:.7">能力</span>` +
    mms.map(m => `<button class="fbtn ${state.mm===m?'on':''}" data-k="mm" data-v="${m}">${m}</button>`).join('');
  document.querySelectorAll('.fgroup button.fbtn').forEach(b => {
    b.addEventListener('click', () => toggleFilter(b.dataset.k, b.dataset.v));
  });
}
function toggleFilter(k, v){
  state[k] = (state[k] === v) ? '' : v;
  syncFilterUI(); renderModels();
}
function syncFilterUI(){
  document.querySelectorAll('.fgroup button.fbtn').forEach(b => {
    const k = b.dataset.k;
    b.classList.toggle('on', b.dataset.v === state[k]);
  });
}

/* ===== 统计 ===== */
function renderStats(){
  const gs = Object.keys(META.gradeDef);
  document.getElementById('hdStats').innerHTML = `
    <span class="stat"><b>${MODELS.length}</b>个模型</span>
    <span class="stat"><b>${TOOLS.length}</b>款 Agent 工具</span>
    ${gs.map(g => `<span class="stat"><span style="color:${META.gradeDef[g].color};font-weight:800">${g}</span> × ${MODELS.filter(m=>m.grade===g).length}</span>`).join('')}
    <span class="stat"><b>${MODELS.filter(m=>m.contextVal>=1000).length}</b>款支持 1M 上下文</span>
    <span class="stat"><b>${MODELS.filter(m=>m.multimodal.includes('图像')).length}</b>款支持图像输入</span>`;
}

/* ===== 初始化 ===== */
document.getElementById('searchBox').addEventListener('input', e => { state.q = e.target.value.trim(); renderModels(); });
document.getElementById('sortBox').addEventListener('change', e => { state.sort = e.target.value; renderModels(); });
renderStats();
buildFilters();
renderModels();
fetchLive();  // 异步拉取实时模型，失败自动隐藏 tab
