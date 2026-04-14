// ═══════════════════════════════════════
// INTERVIEW
// ═══════════════════════════════════════
const QUESTIONS = {
  ko: {
    ceo:    ['안녕하세요. 대표님 관점에서 여쭤보겠습니다. 이 제품을 왜 지금 만들려고 하시나요?','예산과 일정은 어떻게 생각하고 계신가요?','절대 피해야 할 것이 있나요?','이 제품의 첫 번째 고객은 누구라고 생각하시나요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
    dev:    ['안녕하세요. 개발자 관점에서 여쭤보겠습니다. 현재 기술 스택이나 제약이 있나요?','현실적으로 몇 개월이 필요하다고 보시나요?','기존 기술 부채나 연동해야 할 외부 시스템이 있나요?','성능·보안 측면에서 신경 써야 할 부분이 있나요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
    design: ['안녕하세요. 디자인 관점에서 여쭤보겠습니다. 참고할 만한 서비스나 디자인이 있나요?','핵심 UX 원칙이 있나요?','가장 자주 쓰이는 화면은 무엇인가요?','모바일 대응이 필요한가요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
    sales:  ['안녕하세요. 영업/CS 관점에서 여쭤보겠습니다. 고객이 가장 많이 불평하는 게 무엇인가요?','이탈 원인 1순위는 무엇인가요?','고객이 꼭 있어야 한다고 한 기능이 있나요?','고객이 가장 만족하는 부분은 무엇인가요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
    user:   ['안녕하세요. 지금 이 업무를 어떻게 처리하고 계신가요?','가장 불편한 점이 무엇인가요?','꼭 있어야 하는 기능이 있나요?','하루 중 이 업무에 시간을 얼마나 쓰시나요?','추가로 전달하고 싶은 내용이 있으시면 말씀해주세요.'],
    other:  ['안녕하세요. 이 프로젝트에서 가장 중요하다고 생각하는 게 무엇인가요?','걱정되는 부분이 있나요?','다른 분들 의견 중 동의 안 하는 부분이 있나요?','추가로 전달하고 싶은 의견이 있나요?','감사합니다. 더 하실 말씀이 있으신가요?'],
  },
  en: {
    ceo:    ['Hello. From a CEO perspective — why are you building this now?','What are your budget and timeline expectations?','Are there things you absolutely want to avoid?','Who do you see as the first customer for this product?','Is there anything else you want to share?'],
    dev:    ['Hello. From an engineering perspective — what are the current tech stack constraints?','Realistically, how many months do you think this needs?','Are there any existing tech debt or external systems to integrate?','Are there specific performance or security concerns?','Is there anything else you want to share?'],
    design: ['Hello. From a design perspective — are there any services or designs you find inspiring?','Do you have core UX principles or an existing design system?','What are the most frequently used screens?','Do you need mobile support?','Is there anything else you want to share?'],
    sales:  ['Hello. From a sales/CS perspective — what do customers complain about most?','What is the #1 reason customers churn?','Is there a feature customers say they need before they'll use this?','What do customers like most about the current product?','Is there anything else you want to share?'],
    user:   ['Hello. How do you currently handle this task?','What is the most frustrating part?','Is there a feature you absolutely need?','How much time do you spend on this task per day?','Is there anything else you want to share?'],
    other:  ['Hello. What do you think is most important about this project?','Are there any concerns?','Is there anything in others\' opinions you disagree with?','Is there anything you want to add?','Thank you. Anything else?'],
  }
};

function getLang() {
  return (typeof currentAppLang !== 'undefined' ? currentAppLang : null) || localStorage.getItem('onplan-lang') || 'ko';
}

function startChat(ptName) {
  if (!selectedRole) { alert(getLang() === 'en' ? 'Please select a role.' : '역할을 선택해주세요.'); return; }
  if (!currentProject) { alert(getLang() === 'en' ? 'Please select a project first.' : '프로젝트를 먼저 선택하세요.'); return; }

  document.getElementById('role-selector').style.display = 'none';
  chatHistory = []; qIdx = 0; isSending = false;

  const progressWrap = document.getElementById('interview-progress-wrap');
  if (progressWrap) progressWrap.style.display = 'block';
  updateInterviewProgress(0);

  const area = document.getElementById('chatArea');
  area.innerHTML = '';
  area.style.background = '';

  const lang = getLang();
  const firstQ = QUESTIONS[lang]?.[selectedRole]?.[0] || QUESTIONS.ko[selectedRole]?.[0] || '프로젝트에 대해 자유롭게 말씀해주세요.';
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
      body: JSON.stringify({ role: selectedRole, projectName: currentProject?.name || '', projectDesc: '', messages: chatHistory, lang: getLang() })
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
    const lang = getLang();
    const qs = QUESTIONS[lang]?.[selectedRole] || QUESTIONS.ko[selectedRole] || QUESTIONS.ko.other;
    const fallback = qs[Math.min(qIdx, qs.length - 1)];
    chatHistory.push({ role: 'assistant', content: fallback });
    addMsg('assistant', fallback);
  }

  isSending = false; inp.disabled = false; inp.focus();
}

function updateInterviewProgress(pct) {
  const bar = document.getElementById('interview-progress-bar');
  const pctEl = document.getElementById('progress-pct');
  const hint = document.getElementById('progress-hint');
  const val = Math.min(100, pct);
  if (bar) bar.style.width = val + '%';
  if (pctEl) pctEl.textContent = val + '%';
  if (hint) {
    const isEn = getLang() === 'en';
    if (val >= 80) hint.textContent = isEn ? 'Key insights collected.' : '핵심 인사이트 수집 완료';
    else if (val >= 60) hint.textContent = isEn ? 'A bit more to go.' : '조금 더 이야기해주세요.';
    else if (val >= 40) hint.textContent = isEn ? 'Good insights coming in.' : '좋은 인사이트가 쌓이고 있습니다.';
    else hint.textContent = isEn ? 'Keep answering — AI is collecting insights.' : '답변을 이어가면 AI가 인사이트를 수집합니다.';
  }
}

function triggerInterviewComplete() {
  updateInterviewProgress(100);
  const isEn = getLang() === 'en';
  const chatArea = document.getElementById('chatArea');
  if (chatArea) {
    chatArea.style.transition = 'background .6s ease';
    chatArea.style.background = 'rgba(212,245,60,.04)';
    const card = document.createElement('div');
    card.style.cssText = 'margin:8px 0;padding:16px 20px;background:var(--lime-bg);border:1px solid var(--lime-border);border-radius:var(--radius-sm);display:flex;align-items:center;gap:12px;';
    card.innerHTML = `
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style="flex-shrink:0;color:var(--lime)">
        <circle cx="11" cy="11" r="10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M7 11l3 3 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--lime);font-family:var(--en);letter-spacing:.06em;margin-bottom:2px">INTERVIEW COMPLETE</div>
        <div style="font-size:13px;color:var(--g300)">${isEn ? 'Enough insights collected. Click the button above to finish.' : '충분한 인사이트가 수집되었습니다. 위 버튼을 눌러 완료해주세요.'}</div>
      </div>`;
    chatArea.appendChild(card);
    chatArea.scrollTop = chatArea.scrollHeight;
  }
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
  const isEn = getLang() === 'en';
  const area = document.getElementById('chatArea');
  if (area) area.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;padding:60px 40px">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style="color:var(--lime)">
        <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 20l5 5 11-11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div style="font-family:var(--en);font-size:16px;font-weight:800;color:var(--white)">${isEn ? 'Interview Complete' : '인터뷰 완료'}</div>
      <div style="font-size:14px;color:var(--g400);line-height:1.7;max-width:280px">${isEn ? 'Thank you for sharing your insights.<br>Once the PM generates the PRD, you can review the results.' : '소중한 의견을 남겨주셨습니다.<br>PM이 PRD를 생성하면 결과를 확인할 수 있습니다.'}</div>
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
    el.innerHTML = `<div class="msg-av user-av">${(currentUser?.user_metadata?.full_name || 'ME').substring(0,2).toUpperCase()}</div><div class="msg-inner"><div class="msg-sender">${getLang() === 'en' ? 'Me' : '나'}</div><div class="bubble">${text.replace(/</g,'&lt;')}</div></div>`;
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
