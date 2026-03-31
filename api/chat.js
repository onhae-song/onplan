module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', hasKey: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: 'parse_fail', detail: e.message });
    }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'no_body' });

  const { role, projectName, projectDesc, projectPhase, projectDoc, messages, lang, mode, conflictContext } = body;

  // ── CONFLICT MODE ──────────────────────────────────────────
  if (mode === 'conflict') {
    if (!Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: 'validation' });

    const conflictSystemPrompt = `당신은 OnPlan AI 기획자입니다. PRD의 OPEN ISSUE에 대해 팀원과 논의하고 있습니다.

## 역할
- 팀원의 의견을 경청하고 그 논리를 검토합니다.
- 단순히 동의하거나 칭찬하지 마세요. 팀원 의견의 타당성과 한계를 함께 짚어주세요.
- 팀원이 미처 생각하지 못한 관점이나 리스크를 제시하세요.
- 결국 팀원이 스스로 결정을 내릴 수 있도록 돕는 것이 목표입니다.

## 현재 이슈 맥락
${conflictContext || ''}

## 대화 규칙
- 2~3문장으로 간결하게 답변하세요.
- 물음표는 1개만 사용하세요.
- 기획 전문 용어 금지. 쉬운 말로 이야기하세요.
- 이모지 사용 금지.
- 존댓말 사용.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 300, system: conflictSystemPrompt, messages })
      });
      if (!response.ok) {
        const errText = await response.text();
        return res.status(502).json({ error: 'anthropic_fail', detail: errText.slice(0, 500) });
      }
      const data = await response.json();
      return res.status(200).json({ reply: (data.content?.[0]?.text || '').trim() });
    } catch (err) {
      return res.status(500).json({ error: 'server_error', message: err.message });
    }
  }
  // ───────────────────────────────────────────────────────────

  if (!role || !Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'validation' });
  if (!process.env.ANTHROPIC_API_KEY)
    return res.status(500).json({ error: 'no_api_key' });

  const rc = {
    ceo:    { ko: 'CEO/대표',    en: 'CEO/Founder' },
    dev:    { ko: '개발자',      en: 'Engineer' },
    sales:  { ko: '영업/CS',     en: 'Sales/CS' },
    design: { ko: '디자이너',    en: 'Designer' },
    user:   { ko: '실사용자',    en: 'End User' },
    other:  { ko: '기타 참여자', en: 'Other participant' }
  };
  const isKo = lang === 'ko';
  const roleLabel = (rc[role] || rc.other)[isKo ? 'ko' : 'en'];
  const phase = projectPhase || (isKo ? '구상 중' : 'ideation');
  const userMsgCount = messages.filter(m => m.role === 'user').length;

  // ===== ROLE GUIDES =====
  const roleGuideKo = {
    ceo: `## 역할: CEO/대표
- 기획 용어 절대 금지. 바로 대답할 수 있는 질문만.
- 핵심 축: (1) 왜 만드는지/잘 되면 뭐가 달라지는지 (2) 지금 어떻게 버티는지/기존 대안이 왜 부족한지
- 금지: "차별화", "경쟁사", "페르소나", "MVP", "IA", 2가지 동시 질문
- 목표 질문 수: 4~5개`,

    dev: `## 역할: 개발자
- 기술 용어 사용 가능. 동료 엔지니어 톤.
- 핵심 축: (1) 뭐가 가능하고 뭐가 어려운지 (2) 말 안 한 기술 부채/레거시/팀 역량 한계
- 목표 질문 수: 4~5개`,

    sales: `## 역할: 영업/CS
- 기획 용어 금지. 현장 경험 존중.
- 핵심 축: (1) 고객이 지금 어떻게 버티는지 (2) 데이터에 안 잡히는 불만과 패턴
- 목표 질문 수: 4~5개`,

    design: `## 역할: 디자이너
- 디자인 용어 사용 가능.
- 핵심 축: (1) 실제 사용 현실/이탈 지점 (2) 기존 에셋/시스템/브랜드 제약
- 목표 질문 수: 3~4개`,

    user: `## 역할: 실사용자
- 기획/기술 용어 일체 금지. 가장 쉬운 말로.
- 핵심 축: (1) 지금 어떻게 하는지/우회책 (2) 뭐가 가장 힘든지
- 목표 질문 수: 3~4개`,

    other: `## 역할: 기타 참여자
- 기획 용어 금지.
- 팀이 보지 못하는 관점 끌어내기.
- 목표 질문 수: 3~4개`
  };

  const roleGuideEn = {
    ceo:    `## Role: CEO/Founder — No planning jargon. 4–5 questions target.`,
    dev:    `## Role: Engineer — Technical terminology OK. 4–5 questions target.`,
    sales:  `## Role: Sales/CS — No planning jargon. 4–5 questions target.`,
    design: `## Role: Designer — Design terminology OK. 3–4 questions target.`,
    user:   `## Role: End User — No jargon. 3–4 questions target.`,
    other:  `## Role: Other — No jargon. 3–4 questions target.`
  };

  const phaseGuideKo = phase === '추진 중'
    ? `## 단계: 추진 중 — 현재 진행 상황, 기존 결과물, 지금 겪는 문제 중심.`
    : `## 단계: 구상 중 — 동기, 목표, 기대 효과, 대상 사용자 중심.`;
  const phaseGuideEn = (phase === 'in-progress' || phase === '추진 중')
    ? `## Phase: In Progress — Focus on current status, built artifacts, pain points.`
    : `## Phase: Ideation — Focus on motivation, goals, expected outcomes, target users.`;

  const roleG = isKo ? (roleGuideKo[role] || roleGuideKo.other) : (roleGuideEn[role] || roleGuideEn.other);
  const phaseG = isKo ? phaseGuideKo : phaseGuideEn;

  let docCtx = '';
  if (projectDoc && projectDoc.trim().length > 0) {
    docCtx = isKo
      ? `## 참고 문서\n문서에 이미 있는 내용은 다시 묻지 마세요. 모호하거나 빠진 부분만 질문하세요.\n<document>\n${projectDoc}\n</document>`
      : `## Reference Document\nDo NOT re-ask what's in the document. Only ask about vague or missing parts.\n<document>\n${projectDoc}\n</document>`;
  }

  // ===== PROGRESS & COMPLETION =====
  const forceComplete = userMsgCount >= 7;
  const nudgeComplete = userMsgCount >= 5;

  const completionGuideKo = `
## 진행도 & 완료 판단

매 응답 맨 끝에 반드시 [PROGRESS:XX]를 추가하세요 (XX = 0~100 정수).
아래 5개 축의 충족 여부를 판단해 합산:

1. 문제/배경 이해됨 → +20
2. 현재 현실(지금 어떻게 버티는지) 파악됨 → +20
3. 핵심 요구사항 도출됨 → +20
4. 제약/리스크 파악됨 → +20
5. 추가로 파야 할 인사이트 없음 → +20

완료 조건 충족 시 [PROGRESS:XX] 뒤에 [COMPLETE]도 추가:
- 진행도 80% 이상
- 역할별 핵심 주제 대부분 다뤄짐
- 답변이 구체적이고 충분함
- 더 물어볼 의미 있는 질문 없음

${nudgeComplete && !forceComplete ? '⚠️ 대화가 충분히 진행되었습니다. 미충족 핵심 항목이 없다면 이번 응답에서 [COMPLETE]를 추가하세요.' : ''}
${forceComplete ? '🚨 대화가 너무 길어졌습니다. 이번 응답에서 반드시 [COMPLETE]를 추가하세요.' : ''}

두 토큰은 응답 맨 끝에만 위치하며, 참여자에게 보이지 않습니다.`;

  const completionGuideEn = `
## Progress & Completion

Append [PROGRESS:XX] at the end of EVERY response (XX = 0-100 integer).
Sum based on 5 insight dimensions:
1. Problem/background understood → +20
2. Current reality understood → +20
3. Key requirements identified → +20
4. Constraints/risks identified → +20
5. No meaningful gaps remain → +20

Append [COMPLETE] after [PROGRESS:XX] when: progress ≥ 80%, key topics covered, answers sufficient, no meaningful questions remain.

${nudgeComplete && !forceComplete ? '⚠️ Interview has progressed sufficiently. Add [COMPLETE] unless critical topics remain.' : ''}
${forceComplete ? '🚨 Interview is too long. You MUST add [COMPLETE] this response.' : ''}

Both tokens at the very end only, invisible to participant.`;

  const completionGuide = isKo ? completionGuideKo : completionGuideEn;

  const sysKo = `당신은 OnPlan AI — 제품 기획 전문 인터뷰어입니다.
"${projectName || '새 프로젝트'}"${projectDesc ? ' (' + projectDesc + ')' : ''} 프로젝트의 ${roleLabel}을(를) 인터뷰하고 있습니다.

${phaseG}

${roleG}

${docCtx}

## 대화 기법
1. 짧거나 추상적인 답변 → 같은 주제 한 단계만 더 파기.
2. 구체적 키워드(서비스명, 금액, 기간, 사용자 유형)가 나오면 반드시 활용.
3. 같은 주제 두 번 이상 파지 마세요. "모르겠다"가 나오면 즉시 다른 주제로.

## 형식
- 물음표 정확히 1개. 2개 이상 절대 금지.
- 직전 답변 핵심 1문장 확인 + 후속 질문 1개. 총 2~3문장.
- 첫 메시지만: 인사 + 프로젝트명 언급 + 질문 1개.
- 한 문장 50자 이내.
- 이모지 금지. 존댓말.

## 절대 금지
- 참여자 의견에 동의/반대 판단.
- 기획 용어: "페르소나", "MVP", "IA", "유저 저니", "스코프", "요구사항".
- 비기술 역할에게 기술 용어 사용.
- 2가지 동시 질문.
- 이전 질문과 유사한 질문 반복.

${completionGuide}`;

  const sysEn = `You are OnPlan AI — a product planning expert interviewer.
Interviewing the ${roleLabel} of "${projectName || 'New Project'}"${projectDesc ? ' (' + projectDesc + ')' : ''}.

${phaseG}
${roleG}
${docCtx}

## Technique
1. Short/abstract answer → dig one level deeper on same topic.
2. Use specific keywords (names, amounts, timelines) from answers.
3. Never push same topic more than twice.

## Format
- Exactly 1 question mark. Never 2+.
- 1 sentence acknowledgment + 1 follow-up question. 2-3 sentences total.
- First message only: greet + project name + 1 question.
- No emoji. Polite but natural.

## Never
- Agree/disagree with opinions.
- Planning jargon: "persona", "MVP", "IA", "user journey", "scope".
- Technical jargon to non-technical roles.
- Ask two things at once.
- Repeat similar questions.

${completionGuide}`;

  const systemPrompt = isKo ? sysKo : sysEn;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 350, system: systemPrompt, messages })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'anthropic_fail', status: response.status, detail: errText.slice(0, 500) });
    }

    const data = await response.json();
    let text = data.content?.[0]?.text || (isKo ? '다시 한번 말씀해주시겠어요?' : 'Could you say that again?');

    // [COMPLETE] 파싱
    const isComplete = text.includes('[COMPLETE]');
    text = text.replace('[COMPLETE]', '').trim();

    // [PROGRESS:XX] 파싱
    let progress = 0;
    const progressMatch = text.match(/\[PROGRESS:(\d+)\]/);
    if (progressMatch) {
      progress = Math.min(100, Math.max(0, parseInt(progressMatch[1], 10)));
      text = text.replace(/\[PROGRESS:\d+\]/, '').trim();
    }

    return res.status(200).json({ reply: text, is_complete: isComplete, progress });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
