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

  const { projectName, projectDesc, interviewLog, lang } = body || {};
  if (!projectName || !interviewLog) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'no_api_key' });
  }

  const isKo = lang === 'ko';

  const systemPrompt = isKo
    ? `당신은 OnPlan AI 기획자입니다. 아래 인터뷰 내용을 기반으로 PRD(Product Requirements Document)를 JSON으로 생성하세요.

## 출력 형식 (반드시 JSON만, 마크다운 백틱 없이)
{
  "sections": [
    {
      "num": "01",
      "title": "요약과 배경",
      "category": "맥락",
      "body": "HTML 형식 본문 (h3, p, table 태그 사용)"
    },
    ...8개 섹션
  ]
}

## 8개 섹션 (순서 고정)
01. 요약과 배경 — 문제 정의, 왜 지금인가, 시장 맥락
02. 주요 사용자 — 페르소나 2개 (이름, 역할, 페인포인트, 원하는 것)
03. 핵심 사용자 여정 — As-Is / To-Be 플로우
04. 기능적 요구사항 — P0(Must) / P1(Should) / P2(Nice) 테이블
05. IA 설계 — 페이지 맵 테이블 (Depth1, Depth2, 유형)
06. 사용자 플로우 — 핵심 시나리오 2~3개
07. 배포 계획 — Phase 1/2/3 마일스톤
08. 리스크 및 관련 문서 — 리스크 테이블 (리스크, 영향도, 대응)

## 규칙
- 인터뷰에서 언급된 내용을 최대한 반영
- 언급되지 않은 부분은 합리적으로 추론하되 "[추론]" 표시
- body는 HTML 태그 사용 (h3, p, table, tr, th, td, strong)
- 한국어로 작성
- JSON만 출력. 설명 텍스트 없음.`
    : `You are OnPlan AI. Generate a PRD from the interview below as JSON.

## Output format (JSON only, no markdown fences)
{
  "sections": [
    {
      "num": "01",
      "title": "Summary & Background",
      "category": "Context",
      "body": "HTML body content (use h3, p, table tags)"
    },
    ...8 sections
  ]
}

## 8 Sections (fixed order)
01. Summary & Background — Problem, why now, market context
02. Target Users — 2 personas (name, role, pain points, needs)
03. User Journey — As-Is / To-Be flows
04. Functional Requirements — P0(Must) / P1(Should) / P2(Nice) table
05. IA Design — Page map table (Depth1, Depth2, Type)
06. User Flows — 2-3 key scenarios
07. Release Plan — Phase 1/2/3 milestones
08. Risks & References — Risk table (risk, impact, mitigation)

## Rules
- Reflect interview content as much as possible
- Infer unmentioned parts reasonably, mark with "[Inferred]"
- Body uses HTML tags (h3, p, table, tr, th, td, strong)
- English only
- Output JSON only. No explanation text.`;

  const userMessage = isKo
    ? `프로젝트: ${projectName}${projectDesc ? '\n설명: ' + projectDesc : ''}\n\n인터뷰 내용:\n${interviewLog}`
    : `Project: ${projectName}${projectDesc ? '\nDescription: ' + projectDesc : ''}\n\nInterview log:\n${interviewLog}`;

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
        max_tokens: 4000,
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

    let prd;
    try { prd = JSON.parse(text); } catch(e) {
      return res.status(500).json({ error: 'json_parse_fail', raw: text.slice(0, 1000) });
    }

    return res.status(200).json(prd);
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
