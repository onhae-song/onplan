// ═══════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════
let currentAppLang = localStorage.getItem('onplan-lang') || 'ko';

function openSettings(tab) {
  tab = tab || 'general';
  document.getElementById('user-dropdown')?.classList.remove('open');
  document.getElementById('topbar').classList.add('hidden');
  showView(5);
  switchSettingsPanel(tab);
  document.getElementById('settings-email').textContent = currentUser?.email || '—';
  updateLangBtns(currentAppLang);
  const theme = localStorage.getItem('onplan-theme') || 'dark';
  document.getElementById('theme-dark-btn')?.classList.toggle('active', theme === 'dark');
  document.getElementById('theme-light-btn')?.classList.toggle('active', theme === 'light');
  renderSettingsBilling();
}

function switchSettingsPanel(panel) {
  document.querySelectorAll('.settings-nav-item').forEach(el => el.classList.toggle('active', el.dataset.panel === panel));
  document.querySelectorAll('.settings-panel').forEach(el => el.classList.remove('active'));
  document.getElementById('sp-' + panel)?.classList.add('active');
}

// ═══════════════════════════════════════
// LANG
// ═══════════════════════════════════════
const I18N = {
  ko: {
    'panel-sec-label': 'PROJECTS',
    'new-btn-text': '새 프로젝트',
    'empty-title': '프로젝트를 선택하세요',
    'empty-desc': '왼쪽에서 프로젝트를 선택하거나, 새 프로젝트를 만들어 AI 인터뷰를 시작하세요.',
    'trash-btn-text': '휴지통',
  },
  en: {
    'panel-sec-label': 'PROJECTS',
    'new-btn-text': 'New Project',
    'empty-title': 'Select a project',
    'empty-desc': 'Select a project from the left, or create a new one to start an AI interview.',
    'trash-btn-text': 'Trash',
  }
};

function setAppLang(lang) {
  currentAppLang = lang;
  localStorage.setItem('onplan-lang', lang);
  updateLangBtns(lang);
  const t = I18N[lang] || I18N.ko;
  const panelLabel = document.querySelector('.panel-sec-label');
  if (panelLabel) panelLabel.textContent = t['panel-sec-label'];
  const emptyTitle = document.querySelector('.empty-title');
  if (emptyTitle) emptyTitle.textContent = t['empty-title'];
  const emptyDesc = document.querySelector('.empty-desc');
  if (emptyDesc) emptyDesc.textContent = t['empty-desc'];
}

function updateLangBtns(lang) {
  document.getElementById('lang-ko-btn')?.classList.toggle('active', lang === 'ko');
  document.getElementById('lang-en-btn')?.classList.toggle('active', lang === 'en');
}

// ═══════════════════════════════════════
// BILLING
// ═══════════════════════════════════════
async function renderSettingsBilling() {
  const plan = userPlan || 'free';
  const container = document.getElementById('sp-billing');
  if (!container) return;

  const billingSection = container.querySelector('#billing-content');
  if (!billingSection) return;

  // Supabase에서 구독 정보 로드
  let planData = {};
  try {
    const { data } = await sb.from('user_plans')
      .select('plan, card_brand, card_last_four, renews_at, activated_at, lemon_customer_email')
      .eq('user_id', currentUser.id)
      .single();
    if (data) planData = data;
  } catch(e) {}

  const cardInfo = planData.card_last_four
    ? `${(planData.card_brand || '카드').toUpperCase()} •••• ${planData.card_last_four}`
    : '—';

  const renewsAt = planData.renews_at
    ? new Date(planData.renews_at).toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' })
    : '—';

  const activatedAt = planData.activated_at
    ? new Date(planData.activated_at).toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric' })
    : '—';

  const billingEmail = planData.lemon_customer_email || currentUser?.email || '—';

  const planCards = {
    free: `
      <div class="plan-card-grid">
        <div class="plan-card current">
          <div class="plan-card-badge">CURRENT</div>
          <div class="plan-card-name">Free</div>
          <div class="plan-card-price">$0</div>
          <div class="plan-card-desc">기획서가 진짜 나오는지 직접 확인하세요.</div>
          <ul class="plan-card-features">
            <li>무제한 프로젝트</li>
            <li>팀원 5명</li>
            <li>PRD 1~2섹션 미리보기</li>
          </ul>
          <span class="plan-card-btn outline" style="cursor:default;opacity:.5">현재 플랜</span>
        </div>
        <div class="plan-card">
          <div class="plan-card-name">Pro</div>
          <div class="plan-card-price">$29<span>/월</span></div>
          <div class="plan-card-desc">팀과 함께 기획을 완성하세요.</div>
          <ul class="plan-card-features">
            <li>PRD 전체 열람</li>
            <li>ONPLAN OPINION 전체</li>
            <li>충돌 감지 + 역할별 문서</li>
            <li>PDF 내보내기</li>
          </ul>
          <a href="https://onhae.lemonsqueezy.com/checkout/buy/d841a6c5-454f-4d05-a3d4-cb9d9806042b" target="_blank" class="plan-card-btn lime">월간 $29 →</a>
        </div>
      </div>
      <div style="margin-top:16px;padding:18px 20px;background:var(--lime-bg);border:1px solid var(--lime-border)">
        <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--lime);font-family:var(--en);margin-bottom:6px">EARLY BIRD LIMITED</div>
        <div style="font-size:15px;font-weight:700;color:var(--white);margin-bottom:4px">$79 · Max 평생 이용권</div>
        <div style="font-size:13px;color:var(--g400);margin-bottom:14px">100석 한정. Max 전체 기능을 1회 결제로 평생 사용.</div>
        <a href="https://onhae.lemonsqueezy.com/checkout/buy/089c9937-219b-4b63-a14d-f82375df84f3" target="_blank" class="plan-card-btn lime" style="display:inline-block;padding:10px 28px;text-decoration:none">Get It — $79</a>
      </div>`,

    pro: `
      <div class="plan-card current" style="margin-bottom:20px">
        <div class="plan-card-badge">CURRENT</div>
        <div class="plan-card-name">Pro</div>
        <div class="plan-card-price">$29<span>/월</span></div>
        <div class="plan-card-desc">팀과 함께 기획을 완성하고 있습니다.</div>
      </div>
      <div class="settings-block">
        <div class="settings-block-title">구독 정보</div>
        <div class="billing-info-row"><span class="billing-info-label">결제 이메일</span><span class="billing-info-value">${billingEmail}</span></div>
        <div class="billing-info-row"><span class="billing-info-label">결제 수단</span><span class="billing-info-value">${cardInfo}</span></div>
        <div class="billing-info-row"><span class="billing-info-label">다음 결제일</span><span class="billing-info-value">${renewsAt}</span></div>
        <div class="billing-info-row"><span class="billing-info-label">구독 시작일</span><span class="billing-info-value">${activatedAt}</span></div>
      </div>
      <a href="https://app.lemonsqueezy.com/my-orders" target="_blank" class="plan-card-btn outline" style="display:inline-block;padding:10px 24px;text-decoration:none;max-width:280px;margin-top:8px">구독 포털에서 관리 →</a>`,

    max: `
      <div class="plan-card current" style="margin-bottom:20px">
        <div class="plan-card-badge">CURRENT</div>
        <div class="plan-card-name">Max</div>
        <div class="plan-card-price">$79<span>/월</span></div>
        <div class="plan-card-desc">조직 전체의 기획 인프라를 사용 중입니다.</div>
      </div>
      <div class="settings-block">
        <div class="settings-block-title">구독 정보</div>
        <div class="billing-info-row"><span class="billing-info-label">결제 이메일</span><span class="billing-info-value">${billingEmail}</span></div>
        <div class="billing-info-row"><span class="billing-info-label">결제 수단</span><span class="billing-info-value">${cardInfo}</span></div>
        <div class="billing-info-row"><span class="billing-info-label">다음 결제일</span><span class="billing-info-value">${renewsAt}</span></div>
        <div class="billing-info-row"><span class="billing-info-label">구독 시작일</span><span class="billing-info-value">${activatedAt}</span></div>
      </div>
      <a href="https://app.lemonsqueezy.com/my-orders" target="_blank" class="plan-card-btn outline" style="display:inline-block;padding:10px 24px;text-decoration:none;max-width:280px;margin-top:8px">구독 포털에서 관리 →</a>`,

    lifetime: `
      <div class="plan-card current" style="margin-bottom:20px">
        <div class="plan-card-badge">LIFETIME</div>
        <div class="plan-card-name">Early Bird LTD</div>
        <div class="plan-card-price">$79<span> once</span></div>
        <div class="plan-card-desc">Max 전체 기능을 평생 사용하고 있습니다.</div>
      </div>
      <div class="settings-block">
        <div class="settings-block-title">결제 정보</div>
        <div class="billing-info-row"><span class="billing-info-label">결제 이메일</span><span class="billing-info-value">${billingEmail}</span></div>
        <div class="billing-info-row"><span class="billing-info-label">구독 시작일</span><span class="billing-info-value">${activatedAt}</span></div>
        <div class="billing-info-row"><span class="billing-info-label">만료일</span><span class="billing-info-value" style="color:var(--lime)">평생</span></div>
      </div>`,
  };

  billingSection.innerHTML = planCards[plan] || planCards.free;
}

async function confirmDeleteAccount() {
  if (!confirm('정말로 계정을 삭제하시겠습니까?\n모든 프로젝트와 데이터가 영구 삭제됩니다.')) return;
  const code = prompt('확인을 위해 "DELETE"를 입력하세요:');
  if (code !== 'DELETE') return;
  alert('계정 삭제는 현재 지원되지 않습니다. onhaesong@gmail.com으로 문의해주세요.');
}

// ═══════════════════════════════════════
// TRASH — PAGE
// ═══════════════════════════════════════
async function openTrash() {
  document.getElementById('topbar').classList.add('hidden');
  showView(6);
  await loadTrashItems();
}

async function loadTrashItems() {
  const body = document.getElementById('trash-list');
  if (!body) return;
  body.innerHTML = '<div style="padding:20px;color:var(--g500);font-size:13px">불러오는 중...</div>';

  const { data: items } = await sb.from('projects')
    .select('id,name,deleted_at')
    .eq('owner_id', currentUser.id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (!items || items.length === 0) {
    body.innerHTML = '<div style="padding:40px;text-align:center;color:var(--g500);font-size:13px">휴지통이 비어 있습니다.</div>';
    return;
  }
  body.innerHTML = '';
  items.forEach(p => {
    const date = new Date(p.deleted_at).toLocaleDateString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const div = document.createElement('div');
    div.className = 'trash-item';
    div.innerHTML = `
      <div class="trash-item-info">
        <div class="trash-item-name">${p.name}</div>
        <div class="trash-item-date">삭제일 ${date}</div>
      </div>
      <div class="trash-item-actions">
        <button class="btn-restore" onclick="restoreProject('${p.id}')">복원</button>
        <button class="btn-hard-del" onclick="hardDeleteProject('${p.id}', '${p.name}')">완전삭제</button>
      </div>`;
    body.appendChild(div);
  });
}

async function restoreProject(id) {
  const { error } = await sb.from('projects').update({ deleted_at: null }).eq('id', id).eq('owner_id', currentUser.id);
  if (error) { alert('복원 실패: ' + error.message); return; }
  await loadProjects();
  await loadTrashItems();
}

async function hardDeleteProject(id, name) {
  if (!confirm(`'${name}' 프로젝트를 완전히 삭제할까요?\n복구할 수 없습니다.`)) return;
  try {
    await sb.from('interviews').delete().eq('project_id', id);
    await sb.from('prds').delete().eq('project_id', id);
    const { error } = await sb.from('projects').delete().eq('id', id).eq('owner_id', currentUser.id);
    if (error) throw new Error(error.message);
    await loadProjects();
    await loadTrashItems();
  } catch(e) { alert('완전삭제 실패: ' + e.message); }
}
