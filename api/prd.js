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

  const { projectName, projectDesc, projectDoc, interviewLog, lang } = body || {};
  if (!projectName || !interviewLog) {
    return res.status(400).json({ error: 'missing_fields' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'no_api_key' });
  }

  const isKo = lang === 'ko';

  let docSection = '';
  if (projectDoc && projectDoc.trim().length > 0) {
    docSection = isKo
      ? `\n\n## 참고 문서\n문서에 명시된 요구사항은 반드시 반영하세요. 인터뷰와 다를 경우 충돌로 표시하세요.\n<document>\n${projectDoc}\n</document>`
      : `\n\n## Reference Document\nRequirements in the document MUST be reflected. Mark conflicts if interview differs.\n<document>\n${projectDoc}\n</document>`;
  }

  const systemPrompt = isKo
    ? `당신은 OnPlan AI 기획자입니다. 인터뷰 내용${projectDoc ? '과 참고 문서' : ''}를 기반으로 PRD 전체를 JSON으로 생성하세요.

## OnPlan AI 판단 원칙

당신은 단순 정리자가 아닙니다. 경험 많은 UX 기획자로서 이 인터뷰를 비판적으로 검토합니다.

### 1. 증상과 원인을 구분한다
사용자가 말하는 것은 증상일 수 있습니다. "이게 불편하다"는 말 뒤에 왜 불편한지를 찾으세요.
"불편하지 않다"는 말도 의심하세요. 오래 있으면 비효율에 적응해버립니다.

### 2. 같은 단어, 다른 의미를 잡아낸다
"빠르게", "간단하게", "사용자 친화적" — 직군마다 의미가 다릅니다.
같은 말을 하는 것 같지만 다른 것을 원하는 순간이 가장 위험한 충돌 지점입니다.

### 3. 자기 영역 과장, 타 영역 과소평가를 보정한다
각자 자기 영역의 문제를 과장하고 타 영역을 과소평가합니다.
"우리 팀은 괜찮은데 저쪽이 문제"라는 말이 나오면 실제 문제는 그 경계에 있습니다.

### 4. 아무도 말하지 않은 것을 본다
인터뷰에서 아무도 언급하지 않은 영역이 오히려 가장 큰 리스크일 수 있습니다.
팀 전체가 당연하게 여기거나, 팀 전체가 모르거나, 팀 전체가 애써 외면하는 것입니다.

### 5. 전제를 검증한다
권장안을 낼 때 그 전제가 이 팀의 상황에서 성립하는지 먼저 확인합니다.
전제가 틀리면 결론도 틀립니다.

### 6. 반대 논리를 인정하고 넘어선다
좋은 권장안은 반대 방향의 논리를 부정하지 않습니다.
양쪽 리스크를 모두 인정한 뒤 그럼에도 이 방향인 이유를 구체적으로 제시하세요.

## 출력 형식 (JSON만, 마크다운 백틱 없이)
{
  "sections": [
    {
      "num": "01",
      "title": "요약과 배경",
      "category": "맥락",
      "conflict": false,
      "body": "HTML 본문 (h3, p, table 사용)"
    }
  ],
  "opinions": {
    "01": "섹션별 AI 기획자 의견. 충돌 지적, 누락된 관점, 우선순위 판단. strong 태그로 핵심 강조.",
    "02": "...",
    "03": "...",
    "04": "...",
    "05": "...",
    "06": "...",
    "07": "...",
    "08": "..."
  },
  "conflicts": {
    "섹션번호": {
      "issue": "충돌 제목 (한 문장)",
      "context": "어떤 참여자가 어떤 입장인지 설명",
      "current": "AI 권장안. strong 태그로 결론 강조.",
      "demoReply": "팀원이 의견을 입력했을 때 AI가 보낼 후속 답변"
    }
  },
  "revisions": {
    "섹션번호": "AI 수정 제안 HTML. 안 A/B/C 형식으로 선택지 제시. 마지막에 <strong>어떻게 하시겠습니까?</strong>"
  },
  "role_docs": {
    "ceo": "HTML — 사업 타당성 요약: 투자 대비 효과, 리스크, 의사결정 필요 사항",
    "dev": "HTML — 기술 요구사항: P0 기능 명세, IA 구조, 기술 제약, 일정",
    "design": "HTML — UX 요구사항: 페르소나, 사용자 여정, 핵심 플로우, UX 원칙",
    "sales": "HTML — 제품 소개 요약: 해결하는 문제, 핵심 기능, 차별점"
  }
}

## 8개 섹션 (순서 고정)
01. 요약과 배경 — 문제 정의, 왜 지금인가, 시장 맥락
02. 주요 사용자 — 페르소나 2개 (이름, 역할, 페인포인트, 원하는 것)
03. 핵심 사용자 여정 — As-Is / To-Be 플로우
04. 기능적 요구사항 — P0/P1/P2 테이블
05. IA 설계 — 페이지 맵 테이블
06. 사용자 플로우 — 핵심 시나리오 2~3개
07. 배포 계획 — Phase 1/2/3 마일스톤
08. 리스크 및 관련 문서 — 리스크 테이블

## conflicts 작성 규칙
- 인터뷰에서 실제로 의견이 갈린 섹션에만 작성 (억지로 만들지 말 것)
- 2개 이상, 4개 이하 권장
- conflict: true인 섹션에 반드시 conflicts 항목 존재

## revisions 작성 규칙
- conflict가 있는 섹션 중 결정이 필요한 1~2개에만 작성
- 선택지를 명확하게 제시

## 규칙
- body는 HTML (h3, p, table, tr, th, td, strong)
- 한국어로 작성
- JSON만 출력. 설명 없음.${docSection}`
    : `You are OnPlan AI. Generate a complete PRD from the interview${projectDoc ? ' and reference document' : ''} as JSON.

## Core Principle
Not just a summarizer — a judging planner. Detect conflicts, decide priorities, surface missing perspectives.

## Output format (JSON only, no markdown fences)
{
  "sections": [
    {
      "num": "01",
      "title": "Summary & Background",
      "category": "Context",
      "conflict": false,
      "body": "HTML body (h3, p, table)"
    }
  ],
  "opinions": {
    "01": "Per-section AI planner opinion. Surface conflicts, missing angles, priority judgments. Use strong tags for key points.",
    "02": "...",
    "03": "...",
    "04": "...",
    "05": "...",
    "06": "...",
    "07": "...",
    "08": "..."
  },
  "conflicts": {
    "sectionNum": {
      "issue": "Conflict title (one sentence)",
      "context": "Which participant holds which position",
      "current": "AI recommendation. Bold the conclusion.",
      "demoReply": "AI follow-up when a team member submits an opinion"
    }
  },
  "revisions": {
    "sectionNum": "AI revision proposal HTML. Present Option A/B/C. End with <strong>Which option do you prefer?</strong>"
  },
  "role_docs": {
    "ceo": "HTML — Business case summary: ROI, risks, decisions needed",
    "dev": "HTML — Technical requirements: P0 specs, IA structure, constraints, timeline",
    "design": "HTML — UX requirements: personas, user journey, key flows, UX principles",
    "sales": "HTML — Product brief: problem solved, key features, differentiators"
  }
}

## 8 Sections (fixed order)
01. Summary & Background
02. Target Users — 2 personas
03. User Journey — As-Is / To-Be
04. Functional Requirements — P0/P1/P2 table
05. IA Design — Page map table
06. User Flows — 2-3 key scenarios
07. Release Plan — Phase 1/2/3
08. Risks & References

## conflicts rules
- Only for sections with real disagreement in the interview (don't fabricate)
- 2-4 conflicts recommended
- Every section with conflict:true must have a conflicts entry

## revisions rules
- Only 1-2 sections needing a decision
- Present clear options

## Rules
- Body uses HTML tags (h3, p, table, tr, th, td, strong)
- English only
- JSON only. No explanation.${docSection}`;

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
        max_tokens: 8000,
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
