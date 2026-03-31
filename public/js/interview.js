// ═══════════════════════════════════════
// INTERVIEW
// ═══════════════════════════════════════
const QUESTIONS = {
  ceo:    ['안녕하세요. 대표님 관점에서 여쭤보겠습니다. 이 제품을 왜 지금 만들려고 하시나요?','예산과 일정은 어떻게 생각하고 계신가요? 성공 기준은 무엇인가요?','절대 피해야 할 것이 있나요?','이 제품의 첫 번째 고객은 누구라고 생각하시나요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
  dev:    ['안녕하세요. 개발자 관점에서 여쭤보겠습니다. 현재 기술 스택이나 제약이 있나요?','현실적으로 몇 개월이 필요하다고 보시나요? 가장 까다로운 부분은요?','기존 기술 부채나 연동해야 할 외부 시스템이 있나요?','성능·보안 측면에서 특히 신경 써야 할 부분이 있나요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
  design: ['안녕하세요. 디자인 관점에서 여쭤보겠습니다. 참고할 만한 서비스나 디자인이 있나요?','핵심 UX 원칙이 있나요? 기존 디자인 시스템이 있나요?','가장 자주 쓰이는 화면은 무엇인가요?','모바일 대응이 필요한가요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
  sales:  ['안녕하세요. 영업/CS 관점에서 여쭤보겠습니다. 고객이 가장 많이 불평하는 게 무엇인가요?','이탈 원인 1순위는 무엇인가요?','고객이 "이것만 있으면 바로 쓴다"고 한 기능이 있나요?','고객이 가장 만족하는 부분은 무엇인가요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
  user:   ['안녕하세요. 이 업무를 직접 하고 계신 분이군요. 지금 이 업무를 어떻게 처리하고 계신가요?','가장 불편한 점이 무엇인가요? 가장 시간이 오래 걸리는 작업은요?','꼭 있어야 하는 기능이 있나요?','하루 중 이 업무에 시간을 얼마나 쓰시나요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
  other:  ['안녕하세요. 이 프로젝트에 대해 자유롭게 의견을 말씀해주세요. 가장 중요하다고 생각하는 게 무엇인가요?','걱정되는 부분이 있나요?','다른 분들 의견 중 동의 안 하는 부분이 있나요?','추가로 꼭 전달하고 싶은 의견이 있나요?','감사합니다. 더 하실 말씀이 있으신가요?'],
};

function startChat(ptName) {
  if (!selectedRole) { alert('역할을 선택해주세요.'); return; }
  if (!currentProject) { alert('프로젝트를 먼저 선택하세요.'); return; }

  document.getElementById('role-selector').style.display = 'none';
  chatHistory = []; qIdx = 0; isSending = false;

  const area = document.getElementById('chatArea');
  area.innerHTML = '';
  const firstQ = QUESTIONS[selectedRole]?.[0] || '프로젝트에 대해 자유롭게 말씀해주세요.';
  chatHistory.push({ role: 'assistant', content: firstQ });
  addMsg('assistant', firstQ);
}

async function sendChat() {
  const inp = document.getElementById('chatInput');
  const txt = inp.value.trim();
  if (!txt || isSending) return;

  isSending = true; inp.disabled = true;
  addMsg('user', txt);
  chatHistory.push({ role: 'user', content: txt });
  inp.value = ''; inp.style.height = 'auto';
  qIdx++;

  addTypingIndicator();
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: selectedRole, projectName: currentProject?.name || '', projectDesc: '', messages: chatHistory, lang: 'ko' })
    });
    removeTypingIndicator();
    if (resp.ok) {
      const data = await resp.json();
      chatHistory.push({ role: 'assistant', content: data.reply });
      addMsg('assistant', data.reply);
      if (typeof data.progress === 'number') updateInterviewProgress(data.progress);
      if (data.is_complete) triggerInterviewComplete();
    } else throw new Error('API error');
  } catch(e) {
    removeTypingIndicator();
    const qs = QUESTIONS[selectedRole] || QUESTIONS.other;
    const fallback = qs[Math.min(qIdx, qs.length - 1)];
    chatHistory.push({ role: 'assistant', content: fallback });
    addMsg('assistant', fallback);
  }

  isSending = false; inp.disabled = false; inp.focus();
}

function updateInterviewProgress(pct) {
  const bar = document.getElementById('interview-progress-bar');
  const pctEl = document.getElementById('interview-progress-pct');
  if (bar) bar.style.width = Math.min(100, pct) + '%';
  if (pctEl) pctEl.textContent = Math.min(100, pct) + '%';
}

function triggerInterviewComplete() {
  // 프로그레스 100%
  updateInterviewProgress(100);

  // 채팅 영역 배경 lime tint
  const chatArea = document.getElementById('chatArea');
  if (chatArea) {
    chatArea.style.transition = 'background .6s ease';
    chatArea.style.background = 'rgba(212,245,60,.04)';

    // 채팅 내 완료 카드
    const card = document.createElement('div');
    card.style.cssText = 'margin:8px 0;padding:16px 20px;background:var(--lime-bg);border:1px solid var(--lime-border);border-radius:var(--radius-sm);display:flex;align-items:center;gap:12px;';
    card.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style="flex-shrink:0;color:var(--lime)">
        <circle cx="11" cy="11" r="10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M7 11l3 3 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--lime);font-family:var(--en);letter-spacing:.06em;margin-bottom:2px">INTERVIEW COMPLETE</div>
        <div style="font-size:13px;color:var(--g300)">충분한 인사이트가 수집되었습니다. 위 버튼을 눌러 완료해주세요.</div>
      </div>`;
    chatArea.appendChild(card);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // 완료 버튼 배너 표시
  document.getElementById('finish-bar')?.classList.remove('hidden');
}

async function finishInterview() {
  if (!currentProject || chatHistory.length < 2) return;
  try {
    const ptName = document.getElementById('pt-name')?.value?.trim() || '참여자';
    await sb.from('interviews').insert({
      project_id: currentProject.id,
      participant_name: ptName,
      role: selectedRole,
      messages: chatHistory,
      summary: chatHistory.map(m => (m.role === 'user' ? 'User: ' : 'AI: ') + m.content).join('\n').substring(0, 2000),
      status: 'complete'
    });

    chatHistory = []; selectedRole = '';
    document.getElementById('role-selector').style.display = '';

    const isPM = currentUser && currentProject.owner_id === currentUser.id;
    if (isPM) {
      renderStepper(2, [1]); showView(2); await loadDashboard();
    } else {
      showInterviewComplete();
    }
  } catch(e) { alert('저장 실패: ' + e.message); }
}

function showInterviewComplete() {
  const area = document.getElementById('chatArea');
  if (area) area.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:60px 40px">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="color:var(--lime)">
        <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 20l5 5 11-11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div style="font-family:var(--en);font-size:16px;font-weight:800;color:var(--white)">인터뷰 완료</div>
      <div style="font-size:14px;color:var(--g400);line-height:1.7;max-width:280px">소중한 의견을 남겨주셨습니다.<br>PM이 PRD를 생성하면 결과를 확인할 수 있습니다.</div>
    </div>`;
  document.querySelector('.chat-in').style.display = 'none';
  document.getElementById('finish-bar').style.display = 'none';
}

// ═══════════════════════════════════════
// CHAT UI HELPERS
// ═══════════════════════════════════════
function addMsg(role, text) {
  const area = document.getElementById('chatArea');
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  if (role === 'assistant') {
    el.innerHTML = `<div class="msg-av ai-av">ON</div><div class="msg-inner"><div class="msg-sender">OnPlan AI</div><div class="bubble">${text.replace(/\n/g,'<br>')}</div></div>`;
  } else {
    el.innerHTML = `<div class="msg-av user-av">${(currentUser?.user_metadata?.full_name || 'ME').substring(0,2).toUpperCase()}</div><div class="msg-inner"><div class="msg-sender">나</div><div class="bubble">${text.replace(/</g,'&lt;')}</div></div>`;
  }
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
}

function addTypingIndicator() {
  const area = document.getElementById('chatArea');
  const el = document.createElement('div');
  el.className = 'msg assistant'; el.id = 'typing-indicator';
  el.innerHTML = `<div class="msg-av ai-av">ON</div><div class="msg-inner"><div class="bubble" style="padding:10px 14px"><span style="display:inline-flex;gap:4px"><span style="width:5px;height:5px;border-radius:50%;background:var(--g400);animation:blink 1s .0s infinite"></span><span style="width:5px;height:5px;border-radius:50%;background:var(--g400);animation:blink 1s .2s infinite"></span><span style="width:5px;height:5px;border-radius:50%;background:var(--g400);animation:blink 1s .4s infinite"></span></span></div></div>`;
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
}

function removeTypingIndicator() { document.getElementById('typing-indicator')?.remove(); }

// ═══════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  const chatInput = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) sendBtn.addEventListener('click', sendChat);
  if (chatInput) chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
});
