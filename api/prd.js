import { checkUsage, logUsage } from './_usage.js';

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

  const { projectName, projectDesc, projectDoc, interviewLog, lang, userId } = body || {};
  if (!projectName || !interviewLog)
    return new Response(JSON.stringify({ error: 'missing_fields' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (!process.env.ANTHROPIC_API_KEY)
    return new Response(JSON.stringify({ error: 'no_api_key' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });

  // ─── 사용량 체크 ───
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (userId && supabaseKey) {
    const usage = await checkUsage(userId, 'prd_generate', supabaseKey);
    if (!usage.ok) {
      return new Response(JSON.stringify({
        error: 'usage_limit_exceeded',
        plan: usage.plan,
        used: usage.used,
        limit: usage.limit,
        message: usage.plan === 'free'
          ? `Free 플랜은 월 ${usage.limit}회까지 PRD를 생성할 수 있습니다. (${usage.used}/${usage.limit})`
          : `이번 달 PRD 생성 한도(${usage.limit}회)를 초과했습니다.`
      }), { status: 402, headers: { ...headers, 'Content-Type': 'application/json' } });
    }
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
1. 증상과 원인을 구분한다
2. 같은 단어, 다른 의미를 잡아낸다
3. 자기 영역 과장, 타 영역 과소평가를 보정한다
4. 아무도 말하지 않은 것을 본다
5. 전제를 검증한다
6. 반대 논리를 인정하고 넘어선다

## 출력 형식 (JSON만, 마크다운 백틱 없이)
{
  "sections": [{"num":"01","title":"요약과 배경","category":"맥락","conflict":false,"body":"HTML"}],
  "opinions": {"01":"...","02":"...","03":"...","04":"...","05":"...","06":"...","07":"...","08":"..."},
  "conflicts": {"섹션번호": {"issue":"한 문장","context":"양측 입장","current":"AI 권장안","demoReply":"후속 답변"}},
  "revisions": {"섹션번호": "HTML 안A/B/C"}
}

## 8개 섹션 (순서 고정)
01. 요약과 배경 — 문제 정의, 왜 지금인가, 시장 맥락
02. 주요 사용자 — 페르소나 2개
03. 핵심 사용자 여정 — As-Is / To-Be
04. 기능적 요구사항 — P0/P1/P2 테이블
05. IA 설계 — 페이지 맵 테이블
06. 사용자 플로우 — 핵심 시나리오 2~3개
07. 배포 계획 — Phase 1/2/3
08. 리스크 및 관련 문서

## 규칙
- body는 HTML (h3, p, table, tr, th, td, strong)
- conflicts: 실제 의견 충돌 섹션만, 2~4개
- 한국어. JSON만 출력.${docSection}`
    : `You are OnPlan AI. Generate a complete PRD as JSON only (no markdown fences).

Format:
{
  "sections": [{"num":"01","title":"Summary & Background","category":"Context","conflict":false,"body":"HTML"}],
  "opinions": {"01":"...","02":"...","03":"...","04":"...","05":"...","06":"...","07":"...","08":"..."},
  "conflicts": {"sectionNum": {"issue":"one sentence","context":"both sides","current":"recommendation","demoReply":"follow-up"}},
  "revisions": {"sectionNum": "HTML Option A/B/C"}
}

8 Sections: 01.Summary & Background 02.Target Users(2 personas) 03.User Journey(As-Is/To-Be) 04.Functional Requirements(P0/P1/P2 table) 05.IA Design(page map) 06.User Flows(2-3 scenarios) 07.Release Plan(Phase 1/2/3) 08.Risks & References

Rules: HTML body, 2-4 real conflicts only, English, JSON only.${docSection}`;

  const userMessage = isKo
    ? `프로젝트: ${projectName}${projectDesc ? '\n설명: ' + projectDesc : ''}\n\n인터뷰 내용:\n${interviewLog}`
    : `Project: ${projectName}${projectDesc ? '\nDescription: ' + projectDesc : ''}\n\nInterview log:\n${interviewLog}`;

  const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
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

  // 사용량 로그
  if (userId && supabaseKey) {
    logUsage(userId, 'prd_generate', supabaseKey);
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
