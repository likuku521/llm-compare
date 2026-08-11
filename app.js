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
    const q = state.q.toLowerCase();
    list = list.filter(m => {
      const hay = [m.name, m.vendor, m.vendorCn, m.bestFor, m.strengths.join(' '), m.scenes.join(' '), m.notes, fmtCtx(m.contextVal), m.context].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  if(state.sort === 'context') list.sort((a,b) => b.contextVal - a.contextVal);
  else if(state.sort === 'name') list.sort((a,b) => a.name.localeCompare(b.name, 'zh'));
  else list.sort((a,b) => (META.gradeScore[b.grade]||0) - (META.gradeScore[a.grade]||0));
  return list;
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
  wrap.innerHTML = `
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

/* ===== 视图切换 ===== */
function showView(v){
  state.view = v;
  document.getElementById('tabModels').classList.toggle('on', v==='models');
  document.getElementById('tabTools').classList.toggle('on', v==='tools');
  if(v==='models') renderModels(); else renderTools();
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
