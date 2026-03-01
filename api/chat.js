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
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'no_body', bodyType: typeof body, raw: String(req.body).slice(0,200) });
  }

  const { role, projectName, projectDesc, messages, lang } = body;
  if (!role || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'validation', role, msgLen: messages?.length, msgType: typeof messages });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'no_api_key' });
  }

  const rc = {
    ceo: { ko: 'CEO/대표', en: 'CEO/Founder' },
    dev: { ko: '개발자', en: 'Engineer' },
    sales: { ko: '영업/CS', en: 'Sales/CS' },
    design: { ko: '디자이너', en: 'Designer' },
    user: { ko: '실사용자', en: 'End User' },
    other: { ko: '기타 참여자', en: 'Other participant' }
  };
  const isKo = lang === 'ko';
  const roleLabel = (rc[role] || rc.other)[isKo ? 'ko' : 'en'];

  const systemPrompt = isKo
    ? `당신은 OnPlan AI 기획자입니다. "${projectName || '새 프로젝트'}"${projectDesc ? ' (' + projectDesc + ')' : ''} 프로젝트 인터뷰 중입니다.
대상: ${roleLabel}

## 절대 규칙
- 질문은 반드시 1개만. 물음표 2개 이상 금지.
- 직전 답변 내용을 반드시 언급한 뒤 질문하세요.
- 1~2문장으로 짧게.
- 첫 메시지: 프로젝트명 언급하며 인사 + 질문 1개
- 2~5번째: 직전 답변 참조 + 후속 질문 1개
- 6번째 이후: "추가로 전달하고 싶은 내용이 있으시면 말씀해주세요."

## 역할별 탐색 (순서대로 묻지 말것)
CEO: 왜 지금, 예산/일정, 성공기준 | Dev: 기술스택, 일정, 부채 | Sales: 고객불만, 경쟁사 | Design: 참고서비스, UX원칙 | User: 현재방식, 불편점`
    : `You are OnPlan AI interviewing about "${projectName || 'New Project'}"${projectDesc ? ' (' + projectDesc + ')' : ''}.
Interviewee: ${roleLabel}

Rules: Ask exactly ONE question (max 1 question mark). Reference previous answer. Keep to 1-2 sentences.
Flow: 1st=greet+question, 2-5=reference+followup, 6+=wrap up.
Areas by role (don't go in order): CEO:why now,budget | Dev:stack,timeline | Sales:complaints,gaps | Design:references,UX | User:workflow,pain`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'anthropic_fail', status: response.status, detail: errText.slice(0, 500) });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || (isKo ? '다시 한번 말씀해주시겠어요?' : 'Could you say that again?');
    return res.status(200).json({ reply: text });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
