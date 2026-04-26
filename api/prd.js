// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
async function loadDashboard() {
  if (!currentProject) return;

  const inviteUrl = window.location.origin + '/app.html?code=' + (currentProject.invite_code || '');
  const linkEl = document.getElementById('invite-link');
  if (linkEl) { linkEl.textContent = inviteUrl; linkEl.dataset.url = inviteUrl; }

  const { data: interviews } = await sb.from('interviews')
    .select('id, participant_name, role, created_at, status')
    .eq('project_id', currentProject.id)
    .order('created_at', { ascending: true });

  const listEl = document.getElementById('interview-list');
  const countBadge = document.getElementById('interview-count-badge');
  const count = interviews?.length || 0;
  if (countBadge) countBadge.textContent = count + '명';

  const ROLE_LABELS = { ceo:'대표/PM', dev:'개발자', design:'디자이너', sales:'영업/CS', user:'실사용자', other:'기타' };
  const ROLE_COLORS = { ceo:'var(--lime)', dev:'#60a5fa', design:'#f472b6', sales:'#fb923c', user:'#34d399', other:'var(--g400)' };

  if (listEl) {
    if (count === 0) {
      listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--g500);font-size:14px">아직 완료된 인터뷰가 없습니다.</div>';
    } else {
      listEl.innerHTML = '';
      interviews.forEach(iv => {
        const initials = (iv.participant_name || '?').substring(0, 2).toUpperCase();
        const role = ROLE_LABELS[iv.role] || iv.role;
        const color = ROLE_COLORS[iv.role] || 'var(--g400)';
        const date = new Date(iv.created_at).toLocaleDateString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
        const div = document.createElement('div');
        div.className = 'member-item';
        div.innerHTML = `
          <div class="m-av" style="background:${color};color:#0a0a0a">${initials}</div>
          <div style="flex:1">
            <div class="m-name">${iv.participant_name}</div>
            <div style="font-size:12px;color:var(--g500);margin-top:3px">${date}</div>
          </div>
          <span class="m-role" style="background:${color}20;color:${color};border:1px solid ${color}40">${role}</span>`;
        listEl.appendChild(div);
      });
    }
  }

  const { data: latestPrd } = await sb.from('prds')
    .select('version, interview_count, created_at')
    .eq('project_id', currentProject.id)
    .order('version', { ascending: false })
    .limit(1).single();

  const versionInfo = document.getElementById('prd-version-info');
  const versionLabel = document.getElementById('prd-version-label');
  if (latestPrd && versionInfo && versionLabel) {
    versionInfo.style.display = 'block';
    versionLabel.textContent = 'v' + latestPrd.version + ' · ' + latestPrd.interview_count + '개 인터뷰 기반 · ' + new Date(latestPrd.created_at).toLocaleDateString('ko-KR');
  } else if (versionInfo) { versionInfo.style.display = 'none'; }

  const isPM = currentUser && currentProject.owner_id === currentUser.id;
  const actionsEl = document.getElementById('dashboard-actions');
  if (actionsEl) {
    actionsEl.innerHTML = '';
    if (isPM) {
      const hasPrd = !!latestPrd;
      const btnDisabled = count === 0;
      const btn = document.createElement('button');
      btn.className = 'btn-lime';
      btn.disabled = btnDisabled;
      btn.style.opacity = btnDisabled ? '0.4' : '1';
      btn.style.cursor = btnDisabled ? 'not-allowed' : 'pointer';
      btn.innerHTML = hasPrd ? 'PRD 재생성 <span style="font-size:12px;font-weight:400;margin-left:4px">새 버전</span>' : 'PRD 생성하기';
      btn.onclick = () => generatePRD(interviews, latestPrd);
      actionsEl.appendChild(btn);

      const interviewBtn = document.createElement('button');
      interviewBtn.className = 'btn-ghost';
      interviewBtn.textContent = '내 인터뷰 하기';
      interviewBtn.onclick = goToInterview;
      actionsEl.appendChild(interviewBtn);
    } else {
      const btn = document.createElement('button');
      btn.className = 'btn-lime'; btn.textContent = '인터뷰 참여하기';
      btn.onclick = goToInterview;
      actionsEl.appendChild(btn);
    }
  }
}

// ═══════════════════════════════════════
// PRD PROGRESS
// ═══════════════════════════════════════
let _prdProgressTimer = null;

function startPRDProgress() {
  const steps = [
    { msg: '인터뷰 데이터 분석 중...', pct: 5, delay: 0 },
    { msg: '역할별 발언 교차 분석 중...', pct: 18, delay: 5000 },
    { msg: '충돌 지점 감지 중...', pct: 32, delay: 12000 },
    { msg: 'PRD 섹션 작성 중...', pct: 48, delay: 20000 },
    { msg: 'ONPLAN OPINION 생성 중...', pct: 65, delay: 30000 },
    { msg: '마무리 중...', pct: 80, delay: 40000 },
    { msg: '거의 다 됐습니다...', pct: 88, delay: 50000 },
    { msg: '잠시만 기다려주세요...', pct: 93, delay: 62000 },
  ];
  if (!_prdProgressTimer) _prdProgressTimer = [];
  steps.forEach(({ msg, pct, delay }) => {
    const t = setTimeout(() => {
      const msgEl = document.getElementById('prd-progress-msg');
      const pctEl = document.getElementById('prd-progress-pct');
      const bar = document.getElementById('prd-progress-bar');
      if (msgEl) msgEl.textContent = msg;
      if (pctEl) pctEl.textContent = pct + '%';
      if (bar) bar.style.width = pct + '%';
    }, delay);
    _prdProgressTimer.push(t);
  });
}

function finishPRDProgress() {
  if (_prdProgressTimer) { _prdProgressTimer.forEach(t => clearTimeout(t)); _prdProgressTimer = null; }
  const bar = document.getElementById('prd-progress-bar');
  if (bar) bar.style.width = '100%';
  const msgEl = document.getElementById('prd-progress-msg');
  if (msgEl) msgEl.textContent = '완료!';
  const pctEl = document.getElementById('prd-progress-pct');
  if (pctEl) pctEl.textContent = '100%';
}

// ═══════════════════════════════════════
// PRD GENERATE
// ═══════════════════════════════════════
async function generatePRD(interviews, latestPrd) {
  if (!currentProject || !interviews || interviews.length === 0) return;

  const actionsEl = document.getElementById('dashboard-actions');
  if (actionsEl) actionsEl.innerHTML = `
    <div id="prd-progress-wrap" style="padding:16px 0">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:13px;color:var(--g400)" id="prd-progress-msg">인터뷰 데이터 분석 중...</span>
        <span style="font-size:12px;color:var(--g500);font-family:var(--en)" id="prd-progress-pct">0%</span>
      </div>
      <div style="height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;width:240px">
        <div id="prd-progress-bar" style="height:100%;width:0%;background:var(--lime);border-radius:2px;transition:width .6s ease"></div>
      </div>
    </div>`;
  startPRDProgress();

  try {
    const { data: fullInterviews } = await sb.from('interviews')
      .select('participant_name, role, messages')
      .eq('project_id', currentProject.id)
      .order('created_at', { ascending: true });

    const combinedLog = fullInterviews.map(iv => {
      const roleLabel = iv.participant_name + ' (' + iv.role + ')';
      const msgs = (iv.messages || []).map(m => (m.role === 'user' ? roleLabel + ': ' : 'AI: ') + m.content).join('\n');
      return '--- ' + roleLabel + ' 인터뷰 ---\n' + msgs;
    }).join('\n\n');

    const resp = await fetch('/api/prd', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: currentProject.name,
        projectDesc: currentProject.description || '',
        interviewLog: combinedLog,
        lang: (typeof currentAppLang !== 'undefined' ? currentAppLang : 'ko'),
        userId: currentUser?.id
      })
    });

    // 사용량 초과 처리
    if (resp.status === 402) {
      finishPRDProgress();
      const errData = await resp.json();
      showUsageLimitModal(errData.message || 'PRD 생성 한도를 초과했습니다.');
      await loadDashboard();
      return;
    }

    if (!resp.ok) throw new Error('PRD API error: ' + resp.status);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let rawText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawText += decoder.decode(value, { stream: true });
    }
    rawText = rawText.replace(/```json\s?/g, '').replace(/```/g, '').trim();
    let data;
    try { data = JSON.parse(rawText); } catch(e) {
      throw new Error('JSON 파싱 실패: ' + rawText.slice(0, 200));
    }
    if (!data.sections || !Array.isArray(data.sections)) throw new Error('섹션 데이터 없음');

    const newVersion = (latestPrd?.version || 0) + 1;
    const interviewedBy = fullInterviews.map(iv => ({ name: iv.participant_name, role: iv.role }));

    const { error } = await sb.from('prds').insert({
      project_id: currentProject.id,
      sections: data.sections, opinions: data.opinions || {},
      conflicts: data.conflicts || {}, role_docs: {},
      version: newVersion, interview_count: fullInterviews.length,
      interviewed_by: interviewedBy, generated_by: currentUser.id
    });
    if (error) throw new Error(error.message);

    await sb.from('projects').update({ status: 'complete' }).eq('id', currentProject.id);
    currentProject.status = 'complete';
    await loadProjects();

    finishPRDProgress();
    setTimeout(() => { renderStepper(4, [1,2,3]); showView(4); loadAndRenderPRD(currentProject.id); }, 400);

    // ─── Free 플랜은 역할별 문서 호출 안 함 (비용 절감) ───
    if (userPlan !== 'free') {
      generateRoleDocs(combinedLog, data, newVersion);
    }
  } catch(e) {
    finishPRDProgress();
    alert('PRD 생성 실패: ' + e.message);
    await loadDashboard();
  }
}

async function generateRoleDocs(combinedLog, prdData, version) {
  try {
    const prdSummary = (prdData.sections || []).slice(0, 4)
      .map(s => `[${s.num} ${s.title}]\n${(s.body || '').replace(/<[^>]+>/g, '').slice(0, 300)}`).join('\n\n');
    const resp = await fetch('/api/role-docs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectName: currentProject.name,
        projectDesc: currentProject.description || '',
        interviewLog: combinedLog,
        prdSummary,
        lang: (typeof currentAppLang !== 'undefined' ? currentAppLang : 'ko'),
        userId: currentUser?.id
      })
    });
    if (!resp.ok) return;

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let rawText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      rawText += decoder.decode(value, { stream: true });
    }
    rawText = rawText.replace(/```json\s?/g, '').replace(/```/g, '').trim();
    let roleDocs;
    try { roleDocs = JSON.parse(rawText); } catch(e) { return; }

    await sb.from('prds').update({ role_docs: roleDocs }).eq('project_id', currentProject.id).eq('version', version);
  } catch(e) { console.warn('역할별 문서 생성 실패:', e.message); }
}

// ═══════════════════════════════════════
// USAGE LIMIT MODAL
// ═══════════════════════════════════════
function showUsageLimitModal(msg) {
  const overlay = document.createElement('div');
  overlay.id = 'usage-limit-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);padding:32px;max-width:400px;width:90%;position:relative">
      <button onclick="document.getElementById('usage-limit-overlay').remove()" style="position:absolute;top:12px;right:14px;background:none;border:none;color:var(--g400);font-size:18px;cursor:pointer">×</button>
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--lime);font-family:var(--en);margin-bottom:12px">USAGE LIMIT</div>
      <div style="font-size:18px;font-weight:700;color:var(--white);margin-bottom:10px">사용 한도 초과</div>
      <div style="font-size:14px;color:var(--g300);margin-bottom:24px;line-height:1.6">${msg}</div>
      <button onclick="document.getElementById('usage-limit-overlay').remove();openSettings('billing')" style="display:block;width:100%;padding:13px;background:var(--lime);color:#0a0a0a;font-family:var(--en);font-weight:800;font-size:14px;text-align:center;border:none;cursor:pointer;box-sizing:border-box">Upgrade →</button>
    </div>`;
  document.body.appendChild(overlay);
}

// ═══════════════════════════════════════
// PRD LOAD & RENDER
// ═══════════════════════════════════════
async function loadAndRenderPRD(projectId) {
  const container = document.getElementById('prd-detail-sections');
  if (!container) return;
  container.innerHTML = '<div style="padding:60px;text-align:center;color:var(--g400);font-size:14px">불러오는 중...</div>';

  try {
    const { data, error } = await sb.from('prds')
      .select('sections, opinions, conflicts, role_docs, version, interview_count, interviewed_by, created_at')
      .eq('project_id', projectId)
      .order('version', { ascending: false }).limit(1).single();

    if (error || !data?.sections) { container.innerHTML = '<div style="padding:60px;text-align:center;color:var(--g400);font-size:14px">PRD가 없습니다.</div>'; return; }

    const titleEl = document.getElementById('prd-doc-title');
    const metaEl = document.getElementById('prd-doc-meta');
    if (titleEl) titleEl.textContent = currentProject?.name || '';
    if (metaEl) {
      const names = (data.interviewed_by || []).map(i => i.name).join(', ');
      metaEl.textContent = '생성일 ' + new Date(data.created_at).toLocaleDateString('ko-KR') + ' · v' + data.version + ' · ' + data.interview_count + '명 인터뷰 기반' + (names ? ' (' + names + ')' : '');
    }
    renderPRDSections(data, container);
  } catch(e) { container.innerHTML = '<div style="padding:60px;text-align:center;color:var(--g400);font-size:14px">오류: ' + e.message + '</div>'; }
}

function renderPRDSections(prdData, container) {
  if (!container) return;
  container.innerHTML = '';

  const sections  = Array.isArray(prdData) ? prdData : (prdData.sections || []);
  const opinions  = Array.isArray(prdData) ? {} : (prdData.opinions || {});
  const conflicts = Array.isArray(prdData) ? {} : (prdData.conflicts || {});
  const revisions = Array.isArray(prdData) ? {} : (prdData.revisions || {});
  const role_docs = Array.isArray(prdData) ? {} : (prdData.role_docs || {});

  const canViewAll = userPlan !== 'free';
  const FREE_LIMIT = 3;

  const navEl = document.getElementById('prd-nav');
  if (navEl) {
    navEl.innerHTML = '<div class="prd-nav-title">목차</div>';
    sections.forEach((s, i) => {
      const item = document.createElement('div');
      item.className = 'prd-nav-item' + (i === 0 ? ' active' : '');
      item.textContent = s.num + ' ' + s.title;
      item.onclick = function() { scrollToSec('sec-' + s.num, this); };
      navEl.appendChild(item);
    });
  }

  sections.forEach((s, i) => {
    const locked = !canViewAll && i >= FREE_LIMIT;
    const hasConflict = s.conflict || !!conflicts[s.num];
    const sec = document.createElement('div');
    sec.className = 'prd-section'; sec.id = 'sec-' + s.num;

    let badge = locked ? '<span class="sc-badge sc-badge-lock">TEAM</span>'
      : hasConflict ? '<span class="sc-badge sc-badge-conflict">ISSUE</span>'
      : '<span class="sc-badge sc-badge-done">DONE</span>';

    let html = `<div class="prd-sec-hd">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="prd-sec-num">${s.num}</span>
        <span class="prd-sec-title">${s.title}</span>${badge}
      </div>
      <span class="prd-sec-cat">${s.category || ''}</span>
    </div>`;

    if (locked) {
      html += `<div class="prd-sec-body" style="position:relative;min-height:80px">
        <div style="filter:blur(4px);opacity:.25;pointer-events:none;user-select:none">${s.body || ''}</div>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><rect x="3" y="8" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M6 8V5.5a3 3 0 116 0V8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          <span style="font-size:13px;color:var(--g400)">Pro 플랜에서 열람 가능합니다</span>
          <a href="#" onclick="openSettings('billing')" style="font-size:13px;color:var(--lime);text-decoration:none;font-weight:600">업그레이드 →</a>
        </div>
      </div>`;
    } else {
      html += `<div class="prd-sec-body">`;
      if (opinions[s.num]) html += `<div class="po"><div class="po-title">ONPLAN OPINION</div><div class="po-body">${opinions[s.num]}</div></div>`;
      if (hasConflict && conflicts[s.num]) {
        const cf = conflicts[s.num]; const cfId = 'cf-' + s.num;
        html += `<div class="cb">
          <div class="cb-title">OPEN ISSUE</div>
          <div class="cb-issue">${cf.issue}</div>
          <div class="cb-context">${cf.context}</div>
          <div class="cb-current"><div class="cb-current-title">ONPLAN RECOMMENDATION</div><div class="cb-current-body">${cf.current}</div></div>
          <div class="cb-input-area">
            <input class="cb-input" id="${cfId}-input" placeholder="이 논점에 대한 의견을 입력하세요..." onkeydown="if(event.key==='Enter')submitIssueComment('${cfId}','${s.num}')">
            <button class="cb-submit" onclick="submitIssueComment('${cfId}','${s.num}')">전송</button>
          </div>
          <div class="cb-thread" id="${cfId}-thread"></div>
        </div>`;
      }
      html += `<div class="sec-content">${s.body || ''}</div>`;
      if (revisions[s.num]) {
        html += `<div class="rev"><div class="rev-title">ONPLAN REVISION</div><div class="rev-body">${revisions[s.num]}</div>
          <div class="rev-actions">
            <button class="btn-sm btn-sm-y" onclick="this.closest('.rev').innerHTML='<div style=\\'padding:10px;font-size:13px;color:var(--lime)\\'>반영되었습니다.</div>'">승인</button>
            <button class="btn-sm btn-sm-n" onclick="this.closest('.rev').innerHTML='<div style=\\'padding:10px;font-size:13px;color:var(--g500)\\'>거부되었습니다.</div>'">거부</button>
          </div></div>`;
      }
      html += `</div>`;
    }
    sec.innerHTML = html;
    container.appendChild(sec);
  });

  if (!canViewAll && sections.length > FREE_LIMIT) {
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-top:20px;padding:28px;border:1px solid var(--lime-border);background:var(--lime-bg);text-align:center';
    banner.innerHTML = `<div style="font-size:14px;font-weight:600;color:var(--lime);margin-bottom:6px">나머지 ${sections.length - FREE_LIMIT}개 섹션이 잠겨 있습니다</div>
      <div style="font-size:13px;color:var(--g400);margin-bottom:14px">Pro로 업그레이드하면 전체 PRD, 역할별 문서, 충돌 분석을 확인할 수 있습니다.</div>
      <a href="#" onclick="openSettings('billing')" style="display:inline-block;padding:10px 24px;background:var(--lime);color:#0a0a0a;font-weight:700;font-size:13px;text-decoration:none">Upgrade to Pro →</a>`;
    container.appendChild(banner);
  }

  if (canViewAll && role_docs && Object.keys(role_docs).length > 0) renderRoleDocs(role_docs, container);
}

function renderRoleDocs(role_docs, container) {
  const ROLES = [
    { key: 'ceo', label: 'FOR CEO', sub: '사업 타당성 요약' },
    { key: 'dev', label: 'FOR DEV', sub: '기술 요구사항' },
    { key: 'design', label: 'FOR DESIGN', sub: 'UX 요구사항' },
    { key: 'sales', label: 'FOR SALES', sub: '제품 소개 요약' },
  ];
  const wrapper = document.createElement('div');
  wrapper.id = 'rd-section';
  wrapper.style.cssText = 'margin-top:32px;border-top:1px solid var(--border);padding-top:24px';
  const heading = document.createElement('div');
  heading.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--g500);margin-bottom:14px;font-family:var(--en)';
  heading.textContent = 'ROLE-BASED DOCUMENTS';
  wrapper.appendChild(heading);

  const tabs = document.createElement('div');
  tabs.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px';
  const panels = {};

  ROLES.forEach((r, idx) => {
    if (!role_docs[r.key]) return;
    const tab = document.createElement('button');
    tab.className = 'btn-ghost';
    tab.style.cssText = 'font-size:13px;padding:6px 14px;font-family:var(--en);font-weight:700;letter-spacing:.06em';
    tab.textContent = r.label; tab.dataset.role = r.key;
    tabs.appendChild(tab);

    const panel = document.createElement('div');
    panel.id = 'role-panel-' + r.key;
    panel.style.display = idx === 0 ? 'block' : 'none';
    panel.innerHTML = `<div class="prd-section"><div class="prd-sec-hd"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:13px;font-weight:700;letter-spacing:.1em;color:var(--lime);font-family:var(--en)">${r.label}</span><span class="prd-sec-title">${r.sub}</span></div></div><div class="prd-sec-body"><div class="sec-content">${role_docs[r.key]}</div></div></div>`;
    panels[r.key] = panel;
  });

  tabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-role]');
    if (!btn) return;
    Object.keys(panels).forEach(k => { panels[k].style.display = k === btn.dataset.role ? 'block' : 'none'; });
    tabs.querySelectorAll('button').forEach(b => { b.style.background = ''; b.style.color = ''; b.style.borderColor = ''; });
    btn.style.background = 'var(--bg4)'; btn.style.color = 'var(--lime)'; btn.style.borderColor = 'var(--lime-border)';
  });

  const firstBtn = tabs.querySelector('button[data-role]');
  if (firstBtn) { firstBtn.style.background = 'var(--bg4)'; firstBtn.style.color = 'var(--lime)'; firstBtn.style.borderColor = 'var(--lime-border)'; }

  wrapper.appendChild(tabs);
  Object.values(panels).forEach(p => wrapper.appendChild(p));
  container.appendChild(wrapper);
}

// ═══════════════════════════════════════
// OPEN ISSUE
// ═══════════════════════════════════════
const issueDiscussions = {};

async function submitIssueComment(cfId, secNum) {
  const inp = document.getElementById(cfId + '-input');
  if (!inp) return;
  const t = inp.value.trim();
  if (!t) return;

  const thread = document.getElementById(cfId + '-thread');
  inp.value = ''; inp.disabled = true;

  const userItem = document.createElement('div');
  userItem.className = 'cb-thread-item';
  userItem.innerHTML = `<div class="cb-thread-label is-user">YOUR OPINION</div><div class="cb-thread-body">${t}</div>`;
  thread.appendChild(userItem);

  if (!issueDiscussions[secNum]) issueDiscussions[secNum] = [];

  const typingEl = document.createElement('div');
  typingEl.className = 'cb-thread-item'; typingEl.id = cfId + '-typing';
  typingEl.innerHTML = `<div class="cb-thread-label is-ai">ONPLAN FEEDBACK</div><div class="cb-thread-body" style="color:var(--g500)">분석 중...</div>`;
  thread.appendChild(typingEl);

  try {
    const cbEl = inp.closest('.cb');
    const conflictIssue = cbEl?.querySelector('.cb-issue')?.textContent || '';
    const conflictCtx   = cbEl?.querySelector('.cb-context')?.textContent || '';
    const recommendText = cbEl?.querySelector('.cb-current-body')?.textContent || '';
    const conflictFull  = `이슈: ${conflictIssue}\n맥락: ${conflictCtx}\nAI 권장안: ${recommendText}`;

    const prevDiscussion = [...issueDiscussions[secNum]];
    const messages = prevDiscussion.length === 0
      ? [{ role: 'user', content: `[이슈 맥락]\n${conflictFull}\n\n[팀원 의견]\n${t}` }]
      : [{ role: 'user', content: `[이슈 맥락]\n${conflictFull}\n\n[팀원 의견]\n${prevDiscussion[0].content}` },
         ...prevDiscussion.slice(1).map(m => ({ role: m.role, content: m.content })),
         { role: 'user', content: t }];

    issueDiscussions[secNum].push({ role: 'user', content: t });

    const resp = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'conflict', conflictContext: conflictFull, messages, lang: (typeof currentAppLang !== 'undefined' ? currentAppLang : 'ko') })
    });
    typingEl.remove();
    let aiText = '의견을 확인했습니다.';
    if (resp.ok) { const data = await resp.json(); aiText = data.reply || aiText; }
    issueDiscussions[secNum].push({ role: 'assistant', content: aiText });

    const aiItem = document.createElement('div');
    aiItem.className = 'cb-thread-item';
    aiItem.innerHTML = `<div class="cb-thread-label is-ai">ONPLAN FEEDBACK</div><div class="cb-thread-body">${aiText}</div>`;
    thread.appendChild(aiItem);

    const confirmBtnId = cfId + '-confirm';
    if (!document.getElementById(confirmBtnId)) {
      const confirmBtn = document.createElement('button');
      confirmBtn.id = confirmBtnId; confirmBtn.className = 'btn-lime';
      confirmBtn.style.cssText = 'margin-top:14px;width:100%;justify-content:center;font-size:13px;';
      confirmBtn.textContent = '이 방향으로 섹션 재생성';
      confirmBtn.onclick = () => confirmAndRegenSection(cfId, secNum);
      thread.appendChild(confirmBtn);
    }
  } catch(e) {
    typingEl.remove();
    const errItem = document.createElement('div');
    errItem.className = 'cb-thread-item';
    errItem.innerHTML = `<div class="cb-thread-label is-ai">ONPLAN FEEDBACK</div><div class="cb-thread-body">의견을 확인했습니다.</div>`;
    thread.appendChild(errItem);
  } finally { inp.disabled = false; inp.focus(); }
}

async function confirmAndRegenSection(cfId, secNum) {
  if (!currentProject) return;
  const confirmBtn = document.getElementById(cfId + '-confirm');
  if (confirmBtn) { confirmBtn.textContent = '재생성 중...'; confirmBtn.disabled = true; }
  try {
    const { data: prdData } = await sb.from('prds')
      .select('sections, opinions, conflicts, role_docs, version, interview_count, interviewed_by')
      .eq('project_id', currentProject.id)
      .order('version', { ascending: false }).limit(1).single();
    if (!prdData) throw new Error('PRD 데이터 없음');

    const section = prdData.sections?.find(s => s.num === secNum);
    const conflict = prdData.conflicts?.[secNum];
    const conflictContext = conflict ? `이슈: ${conflict.issue}\n맥락: ${conflict.context}\nAI 권장안: ${conflict.current}` : '';

    const resp = await fetch('/api/prd-section', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName: currentProject.name, sectionNum: secNum, sectionTitle: section?.title || '', originalBody: section?.body || '', conflictContext, discussion: issueDiscussions[secNum] || [], lang: (typeof currentAppLang !== 'undefined' ? currentAppLang : 'ko') })
    });
    if (!resp.ok) throw new Error('섹션 재생성 API 오류');
    const result = await resp.json();

    const updatedSections = prdData.sections.map(s => s.num !== secNum ? s : { ...s, body: result.body, conflict: false });
    const updatedConflicts = { ...(prdData.conflicts || {}) };
    delete updatedConflicts[secNum];
    const updatedOpinions = { ...(prdData.opinions || {}) };
    if (result.opinion) updatedOpinions[secNum] = result.opinion;

    await sb.from('prds').update({ sections: updatedSections, conflicts: updatedConflicts, opinions: updatedOpinions }).eq('project_id', currentProject.id).order('version', { ascending: false }).limit(1);

    const secEl = document.getElementById('sec-' + secNum);
    if (secEl) {
      const bodyEl = secEl.querySelector('.prd-sec-body');
      if (bodyEl) {
        bodyEl.innerHTML = `<div class="sec-content">${result.body}</div>`;
        if (result.opinion) bodyEl.innerHTML = `<div class="po"><div class="po-title">ONPLAN OPINION</div><div class="po-body">${result.opinion}</div></div>` + bodyEl.innerHTML;
      }
      const badgeEl = secEl.querySelector('.sc-badge-conflict');
      if (badgeEl) { badgeEl.className = 'sc-badge sc-badge-done'; badgeEl.textContent = 'DONE'; }
      secEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    delete issueDiscussions[secNum];
  } catch(e) {
    alert('섹션 재생성 실패: ' + e.message);
    if (confirmBtn) { confirmBtn.textContent = '이 방향으로 섹션 재생성'; confirmBtn.disabled = false; }
  }
}
