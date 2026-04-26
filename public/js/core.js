// ═══════════════════════════════════════
// SUPABASE & GLOBALS
// ═══════════════════════════════════════
const SUPABASE_URL = 'https://dtwgrxsepotwbpaqssgm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IZ2yTDHofociWRxoYZU3pg_8MHHO9St';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser    = null;
let currentProject = null;
let userPlan       = 'free';
let selectedRole   = '';
let chatHistory    = [];
let isSending      = false;
let qIdx           = 0;

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
async function init() {
  const params = new URLSearchParams(window.location.search);
  const inviteCode = params.get('code');
  if (inviteCode) {
    localStorage.setItem('pending_invite_code', inviteCode);
    window.history.replaceState({}, '', '/app.html');
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    await setUser(session.user);
  } else {
    window.location.href = '/onplan.html';
    return;
  }

  sb.auth.onAuthStateChange((ev, session) => {
    if (session?.user) setUser(session.user);
    else window.location.href = '/onplan.html';
  });
}

async function setUser(u) {
  currentUser = u;
  const initials = (u.user_metadata?.full_name || u.email || '?').substring(0, 2).toUpperCase();
  document.getElementById('user-avatar-txt').textContent = initials;
  document.getElementById('mini-avatar-txt').textContent = initials;
  document.getElementById('user-name-txt').textContent = u.user_metadata?.full_name || u.email || '';
  document.getElementById('panel-ft').style.display = 'flex';

  try {
    const { data } = await sb.from('user_plans').select('plan').eq('user_id', u.id).single();
    if (data) {
      userPlan = data.plan || 'free';
    } else {
      // 첫 로그인 시 자동으로 free 플랜 생성
      await sb.from('user_plans').insert({
        user_id: u.id,
        plan: 'free',
        lemon_customer_email: u.email
      });
      userPlan = 'free';
    }
  } catch(e) { userPlan = 'free'; }

  const udEmail = document.getElementById('ud-email');
  const udBadge = document.getElementById('ud-plan-badge');
  if (udEmail) udEmail.textContent = u.email || '';
  if (udBadge) { udBadge.textContent = userPlan.toUpperCase(); udBadge.className = 'ud-plan plan-' + userPlan; }

  await loadProjects();

  const pendingCode = localStorage.getItem('pending_invite_code');
  if (pendingCode) {
    localStorage.removeItem('pending_invite_code');
    await handleInviteCode(pendingCode);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const targetId = params.get('id');
  if (targetId) {
    const { data: p } = await sb.from('projects')
      .select('id,name,status,phase,description,invite_code,owner_id,created_at')
      .eq('id', targetId).single();
    if (p) { await selectProject(p); window.history.replaceState({}, '', '/app.html'); }
  }
}

async function logOut() {
  await sb.auth.signOut();
  currentUser = null; currentProject = null;
  window.location.href = '/onplan.html';
}

// ═══════════════════════════════════════
// UPGRADE MODAL
// ═══════════════════════════════════════
function showUpgradeModal(msg) {
  const overlay = document.createElement('div');
  overlay.id = 'upgrade-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);padding:36px;max-width:380px;width:90%;position:relative">
      <button onclick="document.getElementById('upgrade-overlay').remove()" style="position:absolute;top:12px;right:14px;background:none;border:none;color:var(--g400);font-size:18px;cursor:pointer">×</button>
      <div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--lime);font-family:var(--en);margin-bottom:12px">Pro Plan</div>
      <div style="font-size:18px;font-weight:700;color:var(--white);margin-bottom:10px">업그레이드가 필요합니다</div>
      <div style="font-size:14px;color:var(--g400);margin-bottom:24px;line-height:1.6">${msg}</div>
      <a href="/#pricing" style="display:block;width:100%;padding:13px;background:var(--lime);color:#0a0a0a;font-family:var(--en);font-weight:800;font-size:14px;text-align:center;text-decoration:none;box-sizing:border-box">Upgrade to Pro →</a>
    </div>`;
  document.body.appendChild(overlay);
}

// ═══════════════════════════════════════
// PANEL
// ═══════════════════════════════════════
function togglePanel() {
  const panel = document.getElementById('panel');
  const btn = document.getElementById('panel-toggle');
  const mini = document.getElementById('mini-sidebar');
  const overlay = document.getElementById('panel-overlay');
  const isMobile = window.innerWidth <= 768;
  const isCollapsed = panel.classList.contains('collapsed');

  if (isCollapsed) {
    panel.classList.remove('collapsed');
    btn.classList.add('open');
    if (mini) mini.classList.remove('visible');
    if (isMobile) overlay.classList.add('visible');
    localStorage.setItem('onplan-panel', 'open');
  } else {
    panel.classList.add('collapsed');
    btn.classList.remove('open');
    if (mini) mini.classList.add('visible');
    overlay.classList.remove('visible');
    localStorage.setItem('onplan-panel', 'closed');
  }
}

function initPanel() {
  const isMobile = window.innerWidth <= 768;
  const saved = localStorage.getItem('onplan-panel');
  const panel = document.getElementById('panel');
  const btn = document.getElementById('panel-toggle');
  const mini = document.getElementById('mini-sidebar');
  if (isMobile || saved === 'closed') {
    panel.classList.add('collapsed');
    btn.classList.remove('open');
    if (mini && !isMobile) mini.classList.add('visible');
  }
}

function updateMiniSidebar() {
  const badges = document.getElementById('mini-proj-badges');
  if (!badges) return;
  badges.innerHTML = '';
  document.querySelectorAll('#proj-list .proj-item').forEach(item => {
    const name = item.querySelector('.proj-name')?.textContent || '';
    const isLive = item.querySelector('.badge-on') !== null;
    const letter = name.charAt(0).toUpperCase();
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'width:100%;display:flex;justify-content:center';
    const div = document.createElement('div');
    div.className = 'mini-badge ' + (isLive ? 'mini-badge-live' : 'mini-badge-done');
    div.textContent = letter;
    div.title = name;
    div.onclick = () => {
      item.click();
      if (document.getElementById('panel').classList.contains('collapsed')) togglePanel();
    };
    wrapper.appendChild(div);
    badges.appendChild(wrapper);
  });
}

function filterProjects(query) {
  const q = query.trim().toLowerCase();
  document.querySelectorAll('#proj-list .proj-item').forEach(item => {
    const name = item.querySelector('.proj-name')?.textContent?.toLowerCase() || '';
    item.style.display = (!q || name.includes(q)) ? '' : 'none';
  });
}

// ═══════════════════════════════════════
// THEME
// ═══════════════════════════════════════
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  setTheme(isDark ? 'light' : 'dark');
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('onplan-theme', theme);
  updateThemeIcon(theme);
  document.getElementById('theme-dark-btn')?.classList.toggle('active', theme === 'dark');
  document.getElementById('theme-light-btn')?.classList.toggle('active', theme === 'light');
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  icon.innerHTML = theme === 'light'
    ? '<path d="M13.5 8.5A6 6 0 017 2a6 6 0 100 12 6 6 0 006.5-5.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>'
    : '<circle cx="8" cy="8" r="3.5" stroke="currentColor" stroke-width="1.3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.9 2.9l1.1 1.1M12 12l1.1 1.1M2.9 13.1L4 12M12 4l1.1-1.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>';
}

function initTheme() {
  const saved = localStorage.getItem('onplan-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

// ═══════════════════════════════════════
// VIEW & STEPPER
// ═══════════════════════════════════════
function showView(n) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('visible'));
  const v = document.getElementById('view-' + n);
  if (v) v.classList.add('visible');
}

function renderStepper(active, done) {
  [1,2,3,4].forEach(n => {
    const s  = document.getElementById('s'  + n);
    const sc = document.getElementById('sc' + n);
    const sl = document.getElementById('sl' + n);
    if (!s) return;
    s.className = 'step';
    if (done.includes(n)) {
      s.classList.add('done');
      sc.innerHTML = `<svg width="16" height="16" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else if (n === active) {
      s.classList.add('active'); sc.textContent = n;
    } else {
      s.classList.add('idle'); sc.textContent = n;
    }
    if (sl) { sl.className = 'step-line'; if (done.includes(n)) sl.classList.add('done'); }
  });
}

function goStep(n) {
  if (!currentProject) return;
  if (n === 1) { startNewProject(); return; }
  const done = [];
  for (let i = 1; i < n; i++) done.push(i);
  renderStepper(n, done);
  showView(n);
}

// ═══════════════════════════════════════
// USER DROPDOWN
// ═══════════════════════════════════════
function toggleUserDropdown() {
  document.getElementById('user-dropdown').classList.toggle('open');
}

// ═══════════════════════════════════════
// PROJ POPOVER
// ═══════════════════════════════════════
function toggleProjPopover() {
  const pop = document.getElementById('proj-popover');
  if (!pop) return;
  if (pop.classList.contains('open')) { closeProjPopover(); return; }
  document.getElementById('popover-name').value = currentProject?.name || '';
  document.getElementById('popover-desc').value = currentProject?.description || '';
  pop.classList.add('open');
  setTimeout(() => document.getElementById('popover-name').focus(), 50);
}

function closeProjPopover(e) {
  if (e) e.stopPropagation();
  document.getElementById('proj-popover')?.classList.remove('open');
}

async function saveProjPopover(e) {
  e.stopPropagation();
  const name = document.getElementById('popover-name').value.trim();
  const desc = document.getElementById('popover-desc').value.trim();
  if (!name) { alert('프로젝트명을 입력하세요.'); return; }
  try {
    const { error } = await sb.from('projects').update({ name, description: desc }).eq('id', currentProject.id).eq('owner_id', currentUser.id);
    if (error) throw new Error(error.message);
    currentProject.name = name; currentProject.description = desc;
    document.getElementById('proj-title').textContent = name;
    await loadProjects();
    setTimeout(() => { document.querySelector(`.proj-item[data-id="${currentProject.id}"]`)?.classList.add('active'); }, 100);
    closeProjPopover();
  } catch(err) { alert('저장 실패: ' + err.message); }
}

// ═══════════════════════════════════════
// PRD NAV
// ═══════════════════════════════════════
function scrollToSec(id, el) {
  document.querySelectorAll('.prd-nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');
  const target = document.getElementById(id);
  const body = document.getElementById('prdBody');
  if (target && body) body.scrollTo({ top: target.offsetTop - 16, behavior: 'smooth' });
}

// ═══════════════════════════════════════
// GLOBAL CLICK HANDLER
// ═══════════════════════════════════════
document.addEventListener('click', (e) => {
  if (e.target.closest('input, textarea, select')) return;
  const dd = document.getElementById('user-dropdown');
  const ft = document.getElementById('panel-ft');
  const miniIconBtn = e.target.closest('.mini-icon-btn');
  if (dd && !dd.contains(e.target) && !ft?.contains(e.target) && !miniIconBtn) {
    dd.classList.remove('open');
  }
  const pop = document.getElementById('proj-popover');
  const titleWrap = document.querySelector('.proj-title-wrap');
  if (pop && titleWrap && !titleWrap.contains(e.target)) pop.classList.remove('open');
});

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = '@keyframes blink{0%,100%{opacity:.2}50%{opacity:1}}';
  document.head.appendChild(style);
  initTheme();
  initPanel();
  init();
});
