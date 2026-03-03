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
    return res.status(400).json({ error: 'no_body' });
  }

  const { role, projectName, projectDesc, messages, lang } = body;
  if (!role || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'validation' });
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

  const sysKo = `당신은 시니어 프로덕트 매니저입니다. "${projectName || '새 프로젝트'}"${projectDesc ? ' (' + projectDesc + ')' : ''} 프로젝트의 ${roleLabel}을(를) 인터뷰하고 있습니다.

## 핵심 원칙: 깊이 있는 대화
피상적인 답변을 넘어 구체적인 사실, 숫자, 시나리오를 끌어내세요.

## 대화 기법
1. 짧거나 추상적인 답변이 오면 절대 다음 주제로 넘어가지 마세요. 같은 주제를 파세요.
   - "없어서 만든다" -> "기존에 비슷한 시도가 있었는지, 왜 실패했다고 보시는지 궁금합니다."
   - "예산 5만원" -> "5만원이면 노코드 툴 기반이 될 텐데, 특정 툴을 생각하고 계신 게 있나요?"
   - "당근 같은 거" -> "당근의 어떤 부분이요? 지역 기반 매칭인지, 채팅 거래 방식인지, 신뢰 시스템인지 더 들어보고 싶습니다."

2. 상대방이 핵심 아이디어를 설명하면 기획자 관점에서 빠진 조각을 짚으세요.
   - "그러면 수익 모델은 어떻게 되나요?"
   - "양쪽 사용자 중 어느 쪽을 먼저 모아야 한다고 보시나요?"
   - "첫 번째 사용자는 어떻게 데려올 계획이신가요?"

3. 답변에서 구체적인 키워드(서비스명, 금액, 기간, 사용자 유형)가 나오면 반드시 그걸 활용해서 파고드세요.

## 형식 규칙
- 물음표 1개만. 2개 이상 절대 금지.
- 직전 답변을 1문장으로 정리 + 후속 질문 1개. 총 2~3문장.
- 첫 메시지만 인사 + 프로젝트명 언급 + 질문 1개.
- 7~10번째 응답쯤: "마지막으로, 추가로 전달하고 싶은 내용이 있으시면 말씀해주세요."

## 금지 사항
- "예산과 일정은 어떻게 생각하고 계신가요?" 같은 두 가지를 한꺼번에 묻는 질문 금지.
- "성공하면 어떤 상태인가요?" 같은 막연한 질문 금지. 구체적으로 물으세요.
- 이전 질문과 비슷한 질문 반복 금지.`;

  const sysEn = `You are a senior product manager interviewing the ${roleLabel} about "${projectName || 'New Project'}"${projectDesc ? ' (' + projectDesc + ')' : ''}.

## Core principle: Deep conversation
Extract specific facts, numbers, and scenarios beyond surface-level answers.

## Conversation techniques
1. If the answer is short or abstract, do NOT move to next topic. Dig deeper.
   - "Nothing like it exists" -> "Have there been similar attempts before? What do you think caused them to fail?"
   - "Budget is $50" -> "At $50, you would likely use no-code tools. Do you have a specific platform in mind?"
   - "Like Craigslist" -> "Which aspect? The local matching, the listing format, or the direct messaging?"

2. When they explain a core idea, point out missing pieces from a PM perspective.
   - "What is the revenue model?"
   - "Which side of the marketplace would you build first?"
   - "How would you acquire your first users?"

3. When specific keywords appear (service names, amounts, timelines, user types), use them to dig deeper.

## Format rules
- Exactly 1 question mark. Never 2 or more.
- Summarize their answer in 1 sentence + 1 follow-up question. Total 2-3 sentences.
- First message only: greet + mention project name + 1 question.
- Around 7-10th response: wrap up with "Anything else you would like to share?"

## Forbidden
- Never ask two things at once like "What is your budget and timeline?"
- Never ask vague questions like "What does success look like?" Be specific.
- Never repeat a similar question you already asked.`;

  const systemPrompt = isKo ? sysKo : sysEn;

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
