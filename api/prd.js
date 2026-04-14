export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  let body;
  try { body = await req.json(); } catch(e) {
    return new Response(JSON.stringify({ error: 'parse_fail' }), { status: 400, headers });
  }

  const { projectName, projectDesc, projectDoc, interviewLog, lang } = body || {};
  if (!projectName || !interviewLog)
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400, headers });
  if (!process.env.ANTHROPIC_API_KEY)
    return new Response(JSON.stringify({ error: 'no_api_key' }), { status: 500, headers });

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

당신은 단순 정리자가 아닙니다. 경험 많은 UX 기획자로서 이 인터뷰를 비판적으로 검토하고 판단합니다.

1. **증상과 원인을 구분한다**
   사용자가 말하는 것은 증상일 수 있습니다. "이게 불편하다"는 말 뒤에 왜 불편한지를 찾으세요.

2. **같은 단어, 다른 의미를 잡아낸다**
   "빠르게", "간단하게", "사용자 친화적" — 직군마다 의미가 다릅니다.

3. **자기 영역 과장, 타 영역 과소평가를 보정한다**
   각자 자기 영역의 문제를 과장하고 타 영역을 과소평가합니다.

4. **아무도 말하지 않은 것을 본다**
   인터뷰에서 아무도 언급하지 않은 영역이 오히려 가장 큰 리스크일 수 있습니다.

5. **전제를 검증한다**
   권장안을 낼 때 그 전제가 이 팀의 상황에서 성립하는지 먼저 확인합니다.

6. **반대 논리를 인정하고 넘어선다**
   좋은 권장안은 반대 방향의 논리를 부정하지 않습니다.

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
    "01": "섹션별 AI 기획자 의견.",
    "02": "...", "03": "...", "04": "...",
    "05": "...", "06": "...", "07": "...", "08": "..."
  },
  "conflicts": {
    "섹션번호": {
      "issue": "충돌 제목 (한 문장)",
      "context": "어떤 참여자가 어떤 입장인지",
      "current": "AI 권장안. 반대 논리 인정 후 권장 방향 제시.",
      "demoReply": "팀원 의견 입력 시 AI 후속 답변"
    }
  },
  "revisions": {
    "섹션번호": "AI 수정 제안 HTML. 안 A/B/C 형식."
  }
}

## 8개 섹션 (순서 고정)
01. 요약과 배경 — 문제 정의, 왜 지금인가, 시장 맥락
02. 주요 사용자 — 페르소나 2개
03. 핵심 사용자 여정 — As-Is / To-Be
04. 기능적 요구사항 — P0/P1/P2 테이블
05. IA 설계 — 페이지 맵 테이블
06. 사용자 플로우 — 핵심 시나리오 2~3개
07. 배포 계획 — Phase 1/2/3
08. 리스크 및 관련 문서 — 리스크 테이블

## conflicts 작성 규칙
- 실제로 의견이 갈린 섹션에만 작성 (억지로 만들지 말 것)
- 2개 이상 4개 이하
- conflict: true인 섹션에 반드시 conflicts 항목 존재

## 규칙
- body는 HTML (h3, p, table, tr, th, td, strong)
- 한국어로 작성
- JSON만 출력. 설명 없음.${docSection}`
    : `You are OnPlan AI. Generate a complete PRD from the interview${projectDoc ? ' and reference document' : ''} as JSON.

## Output format (JSON only, no markdown fences)
{
  "sections": [{"num":"01","title":"Summary & Background","category":"Context","conflict":false,"body":"HTML"}],
  "opinions": {"01":"...","02":"...","03":"...","04":"...","05":"...","06":"...","07":"...","08":"..."},
  "conflicts": {"sectionNum": {"issue":"one sentence","context":"both sides","current":"recommend with reasoning","demoReply":"AI follow-up"}},
  "revisions": {"sectionNum": "HTML with Option A/B/C"}
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

## Rules
- Body uses HTML (h3, p, table, tr, th, td, strong)
- English only. JSON only.${docSection}`;

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
      return new Response(JSON.stringify({ error: 'anthropic_fail', detail: errText.slice(0, 500) }), { status: 502, headers });
    }

    const data = await response.json();
    let text = data.content?.[0]?.text || '';
    text = text.replace(/```json\s?/g, '').replace(/```/g, '').trim();

    let prd;
    try { prd = JSON.parse(text); } catch(e) {
      return new Response(JSON.stringify({ error: 'json_parse_fail', raw: text.slice(0, 1000) }), { status: 500, headers });
    }

    return new Response(JSON.stringify(prd), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'server_error', message: err.message }), { status: 500, headers });
  }
}
