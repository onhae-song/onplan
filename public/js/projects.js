// ═══════════════════════════════════════
// PROJECTS — LOAD & RENDER
// ═══════════════════════════════════════
async function loadProjects() {
  if (!currentUser) return;
  const listEl = document.getElementById('proj-list');
  listEl.innerHTML = '<div style="padding:12px 14px;font-size:13px;color:var(--g500)">로딩 중...</div>';

  const { data: projects, error } = await sb.from('projects')
    .select('id,name,status,phase,description,invite_code,owner_id,created_at')
    .eq('owner_id', currentUser.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const { count: trashCount } = await sb.from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', currentUser.id)
    .not('deleted_at', 'is', null);
  const tcEl = document.getElementById('trash-count');
  if (tcEl) {
    if (trashCount > 0) { tcEl.textContent = trashCount; tcEl.style.display = ''; }
    else tcEl.style.display = 'none';
  }

  if (error || !projects || projects.length === 0) {
    listEl.innerHTML = '<div style="padding:12px 14px;font-size:13px;color:var(--g500)">프로젝트가 없습니다</div>';
    updateMiniSidebar();
    return;
  }

  listEl.innerHTML = '';
  projects.forEach(p => {
    const isComplete = p.status === 'complete';
    const badge = isComplete
      ? '<span class="proj-badge badge-done">PRD</span>'
      : '<span class="proj-badge badge-on">LIVE</span>';
    const div = document.createElement('div');
    div.className = 'proj-item';
    div.dataset.id = p.id;
    div.innerHTML = `
      ${badge}
      <div class="proj-info">
        <div class="proj-name">${p.name}</div>
        <div class="proj-meta">${isComplete ? 'PRD 완성' : '인터뷰 수집 중'}</div>
      </div>
      <button class="proj-del-btn" title="삭제" data-id="${p.id}">
        <svg width="14" height="14" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>`;
    div.onclick = (e) => { if (e.target.closest('.proj-del-btn')) return; selectProject(p); };
    div.querySelector('.proj-del-btn').onclick = (e) => { e.stopPropagation(); deleteProject(p.id, p.owner_id); };
    listEl.appendChild(div);
  });

  updateMiniSidebar();
}

// ═══════════════════════════════════════
// SELECT PROJECT
// ═══════════════════════════════════════
async function selectProject(p) {
  currentProject = p;
  document.querySelectorAll('.proj-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.proj-item[data-id="${p.id}"]`)?.classList.add('active');
  document.getElementById('topbar').classList.remove('hidden');
  document.getElementById('proj-title').textContent = p.name;

  const isNew = p._isNew === true;
  const stepper = document.getElementById('stepper');

  if (isNew) {
    if (stepper) stepper.style.display = '';
    renderStepper(1, []);
    showView(1);
  } else {
    if (stepper) stepper.style.display = 'none';
    showView(2);
    await loadDashboard();
  }
}

// ═══════════════════════════════════════
// NEW PROJECT
// ═══════════════════════════════════════
function startNewProject() {
  if (!currentUser) { return; }
  currentProject = null;
  document.querySelectorAll('.proj-item').forEach(el => el.classList.remove('active'));
  document.getElementById('topbar').classList.remove('hidden');
  document.getElementById('proj-title').textContent = '새 프로젝트';
  document.getElementById('pj-name').value = '';
  document.getElementById('pj-desc').value = '';
  renderStepper(1, []);
  showView(1);
}

async function createProject() {
  const name = document.getElementById('pj-name').value.trim();
  const desc = document.getElementById('pj-desc').value.trim();
  if (!name) { alert('프로젝트명을 입력하세요.'); return; }
  if (!currentUser) return;

  if (userPlan === 'free') {
    const { count } = await sb.from('projects').select('id', { count: 'exact', head: true }).eq('owner_id', currentUser.id);
    if (count >= 2) {
      showUpgradeModal('Free 플랜은 프로젝트를 최대 2개까지 만들 수 있습니다.');
      return;
    }
  }

  const btn = document.getElementById('btn-create');
  btn.textContent = '저장 중...'; btn.disabled = true;

  try {
    const code = Math.random().toString(36).substring(2, 8);
    const { data, error } = await sb.from('projects').insert({
      name, description: desc, owner_id: currentUser.id,
      invite_code: code, phase: 'ideation', status: 'collecting'
    }).select().single();
    if (error) throw new Error(error.message);

    data._isNew = true;
    currentProject = data;
    document.getElementById('proj-title').textContent = name;
    document.getElementById('stepper').style.display = '';
    await loadProjects();
    setTimeout(() => { document.querySelector(`.proj-item[data-id="${data.id}"]`)?.classList.add('active'); }, 300);
    renderStepper(2, [1]);
    showView(2);
    await loadDashboard();
  } catch(e) {
    alert('저장 실패: ' + e.message);
  } finally {
    btn.textContent = '프로젝트 생성'; btn.disabled = false;
  }
}

// ═══════════════════════════════════════
// DELETE PROJECT
// ═══════════════════════════════════════
async function deleteProject(id, ownerId) {
  if (currentUser?.id !== ownerId) { alert('프로젝트 소유자만 삭제할 수 있습니다.'); return; }
  if (!confirm('이 프로젝트를 휴지통으로 이동할까요?')) return;
  try {
    const { error } = await sb.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id).eq('owner_id', currentUser.id);
    if (error) throw new Error(error.message);
    if (currentProject?.id === id) { currentProject = null; document.getElementById('topbar').classList.add('hidden'); showView(0); }
    await loadProjects();
  } catch(e) { alert('삭제 실패: ' + e.message); }
}

// ═══════════════════════════════════════
// INVITE
// ═══════════════════════════════════════
async function handleInviteCode(code) {
  const { data: project, error } = await sb.from('projects')
    .select('id,name,status,phase,description,invite_code,owner_id,created_at')
    .eq('invite_code', code).single();

  if (error || !project) { alert('유효하지 않은 초대 링크입니다.'); showView(0); return; }

  if (project.owner_id === currentUser?.id) { await selectProject(project); return; }

  currentProject = project;
  document.getElementById('topbar').classList.remove('hidden');
  document.getElementById('proj-title').textContent = project.name;
  document.getElementById('stepper').style.display = 'none';

  const nameInput = document.getElementById('pt-name');
  if (nameInput && currentUser) nameInput.value = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || '';

  document.getElementById('role-select').value = '';
  selectedRole = '';
  document.getElementById('ivw-meta').textContent = project.name + ' · 초대 참여';
  showView(3);
}

function copyInviteLink() {
  const url = document.getElementById('invite-link').dataset.url || document.getElementById('invite-link').textContent;
  navigator.clipboard.writeText(url).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.textContent = '복사됨!';
    setTimeout(() => btn.textContent = '링크 복사', 1500);
  });
}

function goToPRD() {
  if (!currentProject) return;
  renderStepper(4, [1,2,3]);
  showView(4);
  loadAndRenderPRD(currentProject.id);
}

function goToInterview() {
  const nameInput = document.getElementById('pt-name');
  if (nameInput && currentUser) nameInput.value = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || '';
  document.getElementById('stepper').style.display = 'none';
  showView(3);
}
