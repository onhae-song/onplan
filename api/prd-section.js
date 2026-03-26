module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: 'parse_fail' });
    }
  }

  const { projectName, sectionNum, sectionTitle, originalBody, conflictContext, discussion, lang } = body || {};
  if (!projectName || !sectionNum || !conflictContext) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'no_api_key' });
  }

  const isKo = lang === 'ko';

  // discussion: [{role: 'user'|'assistant', content: '...'}]
  const discussionText = (discussion || [])
    .map(m => (m.role === 'user' ? '팀원 의견: ' : 'AI: ') + m.content)
    .join('\n');

  const systemPrompt = isKo
    ? `당신은 OnPlan AI 기획자입니다. OPEN ISSUE에 대한 팀 논의를 바탕으로 PRD의 특정 섹션을 재작성하세요.

## 역할
- 팀 논의에서 확정된 방향을 섹션 본문에 반영합니다.
- 논의된 내용을 기반으로 판단하되, 논의에서 다루지 않은 부분은 기존 내용을 유지합니다.
- 충돌이 해소된 것으로 처리합니다.

## 출력 형식 (JSON만, 마크다운 백틱 없이)
{
  "num": "섹션번호",
  "title": "섹션 제목",
  "body": "재작성된 HTML 본문 (h3, p, table, strong 사용)",
  "opinion": "업데이트된 AI 기획자 의견 (논의 반영, strong 태그로 핵심 강조)",
  "resolved": true
}

## 규칙
- body는 HTML (h3, p, table, tr, th, td, strong)
- 기존 섹션 구조를 유지하면서 논의 결과를 반영
- 해소된 충돌은 명확히 결론 지어 작성
- JSON만 출력. 설명 없음.`
    : `You are OnPlan AI. Rewrite a specific PRD section based on team discussion that resolved an OPEN ISSUE.

## Role
- Reflect the confirmed direction from team discussion into the section body.
- Base judgment on what was discussed; preserve original content for undiscussed parts.
- Treat the conflict as resolved.

## Output format (JSON only, no markdown fences)
{
  "num": "section number",
  "title": "section title",
  "body": "rewritten HTML body (h3, p, table, strong)",
  "opinion": "Updated AI planner opinion reflecting the discussion",
  "resolved": true
}

## Rules
- body uses HTML (h3, p, table, tr, th, td, strong)
- Maintain section structure, reflect discussion outcome
- Clearly conclude the resolved conflict
- JSON only. No explanation.`;

  const userMessage = isKo
    ? `프로젝트: ${projectName}

섹션 ${sectionNum}: ${sectionTitle || ''}

기존 본문:
${originalBody || ''}

충돌 내용:
${conflictContext}

팀 논의:
${discussionText}

위 논의를 반영하여 섹션을 재작성하세요.`
    : `Project: ${projectName}

Section ${sectionNum}: ${sectionTitle || ''}

Original body:
${originalBody || ''}

Conflict context:
${conflictContext}

Team discussion:
${discussionText}

Rewrite the section reflecting the discussion above.`;

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
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'anthropic_fail', detail: errText.slice(0, 500) });
    }

    const data = await response.json();
    let text = data.content?.[0]?.text || '';
    text = text.replace(/```json\s?/g, '').replace(/```/g, '').trim();

    let result;
    try { result = JSON.parse(text); } catch(e) {
      return res.status(500).json({ error: 'json_parse_fail', raw: text.slice(0, 1000) });
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
