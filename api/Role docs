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

  const { projectName, projectDesc, interviewLog, prdSummary, lang } = body || {};
  if (!projectName || !interviewLog) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'no_api_key' });
  }

  const isKo = lang === 'ko';

  const systemPrompt = isKo
    ? `당신은 OnPlan AI 기획자입니다. 인터뷰 내용과 PRD 요약을 바탕으로 역할별 문서 4개를 JSON으로 생성하세요.

## 역할별 문서 작성 기준

각 역할 문서는 해당 역할이 실제 업무에 바로 활용할 수 있는 수준으로 작성합니다.
요약 나열이 아니라 판단 근거와 구체적 수치/기준을 포함하세요.

### ceo (사업 타당성 요약)
경영 판단에 필요한 정보만 담습니다. 기술 용어 없이.
- 왜 만드는가: 현재 문제와 비용(손실액, 비효율 수치)
- 투자 대비 효과: 도입 전/후 비교 테이블 (수치 포함)
- 리스크 TOP 3: 사업적 관점에서 가장 큰 리스크와 대응 방향
- 의사결정 필요 사항: 지금 결정하지 않으면 진행이 막히는 것들 (구체적 선택지 제시)

### dev (기술 요구사항)
개발 착수에 필요한 정보를 명세 수준으로 작성합니다.
- P0 기능 명세: 기능명 / 상세 동작 / 수용 기준 테이블
- IA 구조: Depth 1~2 페이지 맵 테이블
- 기술 제약: 연동 필요 외부 시스템, 성능 기준, 보안 고려사항
- 일정 기획자 의견: P0 기준 현실적 소요 기간과 근거

### design (UX 요구사항)
디자인 착수에 필요한 정보를 구체적으로 작성합니다.
- 핵심 사용자: 1차/2차 페르소나 (역할, 사용 빈도, 페인포인트)
- UX 원칙: 이 제품에서 절대 타협하면 안 되는 UX 기준 3가지
- 핵심 플로우 (우선 설계 대상): 가장 빈번한 액션 TOP 3, 각 플로우 단계
- 사용자 여정: As-Is / To-Be 비교
- 사용 환경: 모바일/데스크탑 비중, 주 사용 맥락

### sales (제품 소개 요약)
고객에게 바로 설명할 수 있는 언어로 작성합니다. 기술/기획 용어 없이.
- 한 줄 소개: 누구를 위한, 무엇을 해결하는 제품인가
- 해결하는 문제: 고객이 지금 어떻게 버티고 있는지, 왜 그게 부족한지
- 핵심 기능 3가지: 고객이 이해할 수 있는 언어로
- 경쟁 대비 차별점: 기존 대안(엑셀, ERP, 경쟁사)과 비교
- 타겟 고객: 규모, 직군, 현재 상황 기준으로 구체적으로

## 출력 형식 (JSON만, 마크다운 백틱 없이)
{
  "ceo": "HTML 본문 (h3, p, table, strong 사용)",
  "dev": "HTML 본문",
  "design": "HTML 본문",
  "sales": "HTML 본문"
}

## 규칙
- HTML 태그만 사용 (h3, p, table, tr, th, td, strong)
- 한국어로 작성
- JSON만 출력. 설명 없음.`
    : `You are OnPlan AI. Generate 4 role-based documents from the interview data and PRD summary as JSON.

## Role Document Standards

### ceo — Business Case Summary
No technical jargon. Executive judgment only.
- Why build this: current problem with cost figures
- ROI: before/after comparison table with numbers
- Top 3 risks: business perspective with mitigation
- Decisions needed: specific choices blocking progress

### dev — Technical Spec
Specification-level detail for development kickoff.
- P0 feature spec: feature / behavior / acceptance criteria table
- IA structure: depth 1-2 page map table
- Technical constraints: integrations, performance, security
- Timeline opinion: realistic estimate for P0 with reasoning

### design — UX Requirements
Specific enough for design kickoff.
- Key users: primary/secondary personas with role, frequency, pain points
- UX principles: 3 non-negotiable standards for this product
- Key flows: top 3 most frequent actions, step by step
- User journey: As-Is / To-Be comparison

### sales — Product Brief
Language a customer understands immediately.
- One-liner: who it's for, what problem it solves
- Problem: how customers cope now, why that's insufficient
- 3 key features: in customer language
- Competitive edge: vs. spreadsheets, ERP, competitors
- Target customer: specific by size, role, current situation

## Output format (JSON only, no markdown fences)
{
  "ceo": "HTML body",
  "dev": "HTML body",
  "design": "HTML body",
  "sales": "HTML body"
}

## Rules
- HTML only (h3, p, table, tr, th, td, strong)
- English only
- JSON only. No explanation.`;

  const userMessage = isKo
    ? `프로젝트: ${projectName}${projectDesc ? '\n설명: ' + projectDesc : ''}\n\n인터뷰 내용:\n${interviewLog}${prdSummary ? '\n\nPRD 요약:\n' + prdSummary : ''}`
    : `Project: ${projectName}${projectDesc ? '\nDescription: ' + projectDesc : ''}\n\nInterview log:\n${interviewLog}${prdSummary ? '\n\nPRD summary:\n' + prdSummary : ''}`;

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

    let result;
    try { result = JSON.parse(text); } catch(e) {
      return res.status(500).json({ error: 'json_parse_fail', raw: text.slice(0, 1000) });
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};
