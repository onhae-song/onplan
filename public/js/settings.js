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
// I18N
// ═══════════════════════════════════════
const I18N = {
  ko: {
    'panel-projects': 'PROJECTS',
    'search-ph': '검색...',
    'new-project': '새 프로젝트',
    'trash': '휴지통',
    'menu-settings': '설정',
    'menu-upgrade': '요금제 업그레이드',
    'menu-logout': '로그아웃',
    'loading': '로딩 중...',
    // Stepper
    'step1': '프로젝트 생성',
    'step2': '팀 공유',
    'step3': 'AI 인터뷰',
    'step4': 'PRD 결과',
    // View 0
    'empty-title': '프로젝트를 선택하세요',
    'empty-desc': '왼쪽에서 프로젝트를 선택하거나, 새 프로젝트를 만들어 AI 인터뷰를 시작하세요.',
    'empty-new': '새 프로젝트 만들기',
    // Popover
    'popover-title': '프로젝트 정보',
    'popover-name-ph': '프로젝트명',
    'popover-desc-ph': '배경 및 목표',
    'popover-save': '저장',
    'popover-cancel': '취소',
    // View 1
    'v1-title': '프로젝트 <em>생성</em>',
    'v1-desc': '기획하려는 제품 또는 기능의 기본 정보를 입력하세요. AI가 맞춤 인터뷰 질문을 생성합니다.',
    'v1-name-label': '프로젝트명',
    'v1-name-ph': '예: 발주 관리 시스템',
    'v1-goal-label': '배경 및 목표',
    'v1-goal-ph': '어떤 문제를 해결하려 하나요?',
    'v1-doc-label': 'SI 프로젝트 문서',
    'optional': '선택',
    'v1-upload-text': '드래그하여 업로드 또는',
    'v1-upload-link': '파일 선택',
    'v1-upload-hint': 'PDF, DOCX, PPTX · 최대 20MB',
    'v1-create': '프로젝트 생성',
    'v1-draft': '임시저장',
    // View 2
    'v2-title': '인터뷰 <em>현황</em>',
    'v2-desc': '팀원들의 인터뷰가 완료되면 PRD를 생성할 수 있습니다.',
    'v2-invite-label': '초대 링크',
    'link-generating': '링크 생성 중...',
    'v2-copy': '링크 복사',
    'v2-invite-hint': '링크가 있는 누구나 로그인 후 인터뷰에 참여할 수 있습니다.',
    'v2-interview-label': '완료된 인터뷰',
    'no-interviews': '아직 완료된 인터뷰가 없습니다.',
    'view-prd': 'PRD 보기',
    // View 3
    'v3-title': 'AI 인터뷰',
    'v3-select-project': '프로젝트를 선택해주세요',
    'v3-live': '진행 중',
    'v3-participant-label': '참여자 정보',
    'v3-name-ph': '참여자 이름',
    'v3-role-default': '역할 선택',
    'v3-role-ceo': '대표 / PM',
    'v3-role-dev': '개발자',
    'v3-role-design': '디자이너',
    'v3-role-sales': '영업 / CS',
    'v3-role-user': '실사용자',
    'v3-role-other': '기타',
    'v3-start': '인터뷰 시작',
    'progress-hint': '답변을 이어가면 AI가 인사이트를 수집합니다.',
    'v3-finish-text': '충분한 인사이트가 수집되었습니다.',
    'v3-finish-btn': '인터뷰 완료',
    'v3-input-ph': '답변을 입력하세요...',
    // View 4
    'toc': '목차',
    'v4-save': '저장',
    'v4-share': '공유',
    // Settings nav
    'nav-general': '일반',
    'nav-account': '계정',
    'nav-billing': '결제 / 플랜',
    // Settings panels
    'sp-general-title': '일반',
    'sp-general-desc': '앱 언어와 테마를 설정합니다.',
    'lang-title': '언어 Language',
    'lang-desc': '앱 내 주요 텍스트가 선택한 언어로 표시됩니다.',
    'theme-title': '테마 Theme',
    'theme-desc': '화면 밝기를 선택합니다.',
    'sp-account-title': '계정',
    'sp-account-desc': '로그인 계정 및 세션을 관리합니다.',
    'login-title': '로그인 계정',
    'session-title': '세션',
    'session-desc': '모든 기기에서 OnPlan 로그아웃합니다.',
    'session-btn': '모든 기기에서 로그아웃',
    'danger-title': '위험 구역',
    'danger-desc': '계정을 삭제하면 모든 프로젝트와 데이터가 영구 삭제됩니다.',
    'danger-btn': '계정 삭제',
    'sp-billing-title': '결제 / 플랜',
    'sp-billing-desc': '현재 구독 플랜과 결제 정보를 확인합니다.',
    // View 6
    'trash-title': '휴지통',
    'trash-desc': '30일 후 자동으로 완전 삭제됩니다.',
    'trash-back': '← 돌아가기',
  },
  en: {
    'panel-projects': 'PROJECTS',
    'search-ph': 'Search...',
    'new-project': 'New Project',
    'trash': 'Trash',
    'menu-settings': 'Settings',
    'menu-upgrade': 'Upgrade Plan',
    'menu-logout': 'Log out',
    'loading': 'Loading...',
    'step1': 'Create',
    'step2': 'Share',
    'step3': 'Interview',
    'step4': 'PRD',
    'empty-title': 'Select a project',
    'empty-desc': 'Select a project from the left, or create a new one to start an AI interview.',
    'empty-new': 'Create New Project',
    'popover-title': 'Project Info',
    'popover-name-ph': 'Project name',
    'popover-desc-ph': 'Background & goals',
    'popover-save': 'Save',
    'popover-cancel': 'Cancel',
    'v1-title': 'Create <em>Project</em>',
    'v1-desc': 'Enter basic info about the product or feature you want to plan. AI will generate tailored interview questions.',
    'v1-name-label': 'Project Name',
    'v1-name-ph': 'e.g. Order Management System',
    'v1-goal-label': 'Background & Goals',
    'v1-goal-ph': 'What problem are you solving?',
    'v1-doc-label': 'Reference Document',
    'optional': 'Optional',
    'v1-upload-text': 'Drag to upload or',
    'v1-upload-link': 'browse files',
    'v1-upload-hint': 'PDF, DOCX, PPTX · Max 20MB',
    'v1-create': 'Create Project',
    'v1-draft': 'Save Draft',
    'v2-title': 'Interview <em>Status</em>',
    'v2-desc': 'Once team interviews are complete, you can generate the PRD.',
    'v2-invite-label': 'Invite Link',
    'link-generating': 'Generating link...',
    'v2-copy': 'Copy Link',
    'v2-invite-hint': 'Anyone with the link can join after logging in.',
    'v2-interview-label': 'Completed Interviews',
    'no-interviews': 'No completed interviews yet.',
    'view-prd': 'View PRD',
    'v3-title': 'AI Interview',
    'v3-select-project': 'Select a project',
    'v3-live': 'Live',
    'v3-participant-label': 'Participant Info',
    'v3-name-ph': 'Participant name',
    'v3-role-default': 'Select role',
    'v3-role-ceo': 'CEO / PM',
    'v3-role-dev': 'Engineer',
    'v3-role-design': 'Designer',
    'v3-role-sales': 'Sales / CS',
    'v3-role-user': 'End User',
    'v3-role-other': 'Other',
    'v3-start': 'Start Interview',
    'progress-hint': 'Keep answering — AI is collecting insights.',
    'v3-finish-text': 'Enough insights collected.',
    'v3-finish-btn': 'Complete Interview',
    'v3-input-ph': 'Type your answer...',
    'toc': 'Table of Contents',
    'v4-save': 'Save',
    'v4-share': 'Share',
    'nav-general': 'General',
    'nav-account': 'Account',
    'nav-billing': 'Billing / Plan',
    'sp-general-title': 'General',
    'sp-general-desc': 'Set app language and theme.',
    'lang-title': 'Language',
    'lang-desc': 'Main text will be displayed in the selected language.',
    'theme-title': 'Theme',
    'theme-desc': 'Choose display brightness.',
    'sp-account-title': 'Account',
    'sp-account-desc': 'Manage your login account and sessions.',
    'login-title': 'Login Account',
    'session-title': 'Session',
    'session-desc': 'Sign out of OnPlan on all devices.',
    'session-btn': 'Sign out from all devices',
    'danger-title': 'Danger Zone',
    'danger-desc': 'Deleting your account will permanently remove all projects and data.',
    'danger-btn': 'Delete Account',
    'sp-billing-title': 'Billing / Plan',
    'sp-billing-desc': 'View your current subscription and billing info.',
    'trash-title': 'Trash',
    'trash-desc': 'Automatically deleted after 30 days.',
    'trash-back': '← Back',
  }
};

// 번역 헬퍼 (동적 HTML 생성에서 사용)
function t(key) {
  const lang = typeof currentAppLang !== 'undefined' ? currentAppLang : 'ko';
  return (I18N[lang] || I18N.ko)[key] || key;
}

function setAppLang(lang) {
  currentAppLang = lang;
  localStorage.setItem('onplan-lang', lang);
  updateLangBtns(lang);

  const dict = I18N[lang] || I18N.ko;

  // textContent 업데이트
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key] !== undefined) el.textContent = dict[key];
  });

  // innerHTML 업데이트 (em 태그 등 포함)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });

  // placeholder 업데이트
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key] !== undefined) el.placeholder = dict[key];
  });

  // select option 업데이트
  document.querySelectorAll('[data-i18n]').forEach(el => {
    if (el.tagName === 'OPTION') {
      const key = el.dataset.i18n;
      if (dict[key] !== undefined) el.textContent = dict[key];
    }
  });
}

function updateLangBtns(lang) {
  document.getElementById('lang-ko-btn')?.classList.toggle('active', lang === 'ko');
  document.getElementById('lang-en-btn')?.classList.toggle('active', lang === 'en');
  document.getElementById('dd-lang-ko-btn')?.classList.toggle('active', lang === 'ko');
  document.getElementById('dd-lang-en-btn')?.classList.toggle('active', lang === 'en');
}

// 앱 시작 시 저장된 언어 적용
document.addEventListener('DOMContentLoaded', () => {
  const savedLang = localStorage.getItem('onplan-lang') || 'ko';
  setAppLang(savedLang);
});

// ═══════════════════════════════════════
// BILLING
// ═══════════════════════════════════════
async function renderSettingsBilling() {
  const plan = userPlan || 'free';
  const container = document.getElementById('sp-billing');
  if (!container) return;

  const billingSection = container.querySelector('#billing-content');
  if (!billingSection) return;

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
  body.innerHTML = `<div style="padding:20px;color:var(--g500);font-size:13px">${t('loading')}</div>`;

  const { data: items } = await sb.from('projects')
    .select('id,name,deleted_at')
    .eq('owner_id', currentUser.id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (!items || items.length === 0) {
    body.innerHTML = `<div style="padding:40px;text-align:center;color:var(--g500);font-size:13px">${currentAppLang === 'en' ? 'Trash is empty.' : '휴지통이 비어 있습니다.'}</div>`;
    return;
  }
  body.innerHTML = '';
  items.forEach(p => {
    const date = new Date(p.deleted_at).toLocaleDateString(currentAppLang === 'en' ? 'en-US' : 'ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
    const div = document.createElement('div');
    div.className = 'trash-item';
    div.innerHTML = `
      <div class="trash-item-info">
        <div class="trash-item-name">${p.name}</div>
        <div class="trash-item-date">${currentAppLang === 'en' ? 'Deleted' : '삭제일'} ${date}</div>
      </div>
      <div class="trash-item-actions">
        <button class="btn-restore" onclick="restoreProject('${p.id}')">${currentAppLang === 'en' ? 'Restore' : '복원'}</button>
        <button class="btn-hard-del" onclick="hardDeleteProject('${p.id}', '${p.name}')">${currentAppLang === 'en' ? 'Delete' : '완전삭제'}</button>
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
  if (!confirm(`'${name}' ${currentAppLang === 'en' ? 'will be permanently deleted. Continue?' : '프로젝트를 완전히 삭제할까요?\n복구할 수 없습니다.'}`)) return;
  try {
    await sb.from('interviews').delete().eq('project_id', id);
    await sb.from('prds').delete().eq('project_id', id);
    const { error } = await sb.from('projects').delete().eq('id', id).eq('owner_id', currentUser.id);
    if (error) throw new Error(error.message);
    await loadProjects();
    await loadTrashItems();
  } catch(e) { alert('완전삭제 실패: ' + e.message); }
}
