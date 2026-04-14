export const config = { runtime: 'edge' };

export default async function handler(req) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...headers, 'Content-Type': 'application/json' } });

  let body;
  try { body = await req.json(); } catch(e) {
    return new Response(JSON.stringify({ error: 'parse_fail' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
  }

  const { projectName, projectDesc, interviewLog, prdSummary, lang } = body || {};
  if (!projectName || !interviewLog)
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (!process.env.ANTHROPIC_API_KEY)
    return new Response(JSON.stringify({ error: 'no_api_key' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });

  const isKo = lang === 'ko';

  const systemPrompt = isKo
    ? `당신은 OnPlan AI 기획자입니다. 인터뷰 내용과 PRD 요약을 바탕으로 역할별 문서 4개를 JSON으로 생성하세요.

## 역할별 문서 작성 기준

### ceo (사업 타당성 요약)
경영 판단에 필요한 정보만. 기술 용어 없이.
- 왜 만드는가: 현재 문제와 비용(손실액, 비효율 수치)
- 투자 대비 효과: 도입 전/후 비교 테이블 (수치 포함)
- 리스크 TOP 3: 사업적 관점, 대응 방향
- 의사결정 필요 사항: 구체적 선택지 제시

### dev (기술 요구사항)
개발 착수에 필요한 정보를 명세 수준으로.
- P0 기능 명세: 기능명 / 상세 동작 / 수용 기준 테이블
- IA 구조: Depth 1~2 페이지 맵 테이블
- 기술 제약: 연동 시스템, 성능 기준, 보안 고려사항
- 일정 기획자 의견: P0 기준 현실적 소요 기간과 근거

### design (UX 요구사항)
디자인 착수에 필요한 정보를 구체적으로.
- 핵심 사용자: 1차/2차 페르소나 (역할, 사용 빈도, 페인포인트)
- UX 원칙: 절대 타협하면 안 되는 UX 기준 3가지
- 핵심 플로우: 가장 빈번한 액션 TOP 3, 각 플로우 단계
- 사용자 여정: As-Is / To-Be 비교

### sales (제품 소개 요약)
고객에게 바로 설명할 수 있는 언어로. 기술/기획 용어 없이.
- 한 줄 소개: 누구를 위한, 무엇을 해결하는 제품인가
- 해결하는 문제: 고객이 지금 어떻게 버티는지, 왜 부족한지
- 핵심 기능 3가지: 고객이 이해할 수 있는 언어로
- 경쟁 대비 차별점: 기존 대안과 비교
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
    : `You are OnPlan AI. Generate 4 role-based documents as JSON only (no markdown fences).

### ceo — Business Case Summary (no jargon)
- Why build: problem + cost figures
- ROI: before/after table with numbers
- Top 3 risks + mitigation
- Decisions needed: specific choices

### dev — Technical Spec
- P0 feature / behavior / acceptance criteria table
- IA page map table
- Technical constraints
- Timeline estimate with reasoning

### design — UX Requirements
- Primary/secondary personas
- 3 non-negotiable UX principles
- Top 3 flows step by step
- As-Is / To-Be journey

### sales — Product Brief (customer language)
- One-liner
- Problem: how they cope now
- 3 key features in customer language
- Competitive edge
- Target customer specifics

Output: {"ceo":"HTML","dev":"HTML","design":"HTML","sales":"HTML"}
Rules: HTML only (h3,p,table,tr,th,td,strong), English, JSON only.`;

  const userMessage = isKo
    ? `프로젝트: ${projectName}${projectDesc ? '\n설명: ' + projectDesc : ''}\n\n인터뷰 내용:\n${interviewLog}${prdSummary ? '\n\nPRD 요약:\n' + prdSummary : ''}`
    : `Project: ${projectName}${projectDesc ? '\nDescription: ' + projectDesc : ''}\n\nInterview log:\n${interviewLog}${prdSummary ? '\n\nPRD summary:\n' + prdSummary : ''}`;

  const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!anthropicResp.ok) {
    const errText = await anthropicResp.text();
    return new Response(JSON.stringify({ error: 'anthropic_fail', detail: errText.slice(0, 500) }), {
      status: 502,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicResp.body.getReader();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                controller.enqueue(encoder.encode(parsed.delta.text));
              }
            } catch {}
          }
        }
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    status: 200,
    headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
