export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { role, projectName, projectDesc, messages, lang } = req.body;

  if (!role || !messages) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const roleContext = {
    ceo: {
      ko: 'CEO/대표 — 사업 방향, 예산, 일정, 성공 기준, 제약 조건에 대한 관점을 가진 의사결정자',
      en: 'CEO/Founder — Decision-maker with perspectives on business direction, budget, timeline, success criteria, and constraints'
    },
    dev: {
      ko: '개발자/엔지니어 — 기술 스택, 구현 난이도, 일정 추정, 기술 부채, 인프라에 대한 관점을 가진 실무자',
      en: 'Developer/Engineer — Practitioner with perspectives on tech stack, implementation difficulty, timeline estimation, tech debt, and infrastructure'
    },
    sales: {
      ko: '영업/CS 담당자 — 고객 불만, 경쟁사 비교, 고객 요구 기능, 이탈 사유에 대한 현장 관점을 가진 실무자',
      en: 'Sales/CS — Field practitioner with perspectives on customer complaints, competitor comparison, requested features, and churn reasons'
    },
    design: {
      ko: '디자이너 — UX 원칙, 디자인 시스템, 사용자 행동 패턴, 주요 화면, 사용 환경에 대한 관점을 가진 실무자',
      en: 'Designer — Practitioner with perspectives on UX principles, design systems, user behavior patterns, key screens, and usage environment'
    },
    user: {
      ko: '실무 사용자 — 현재 업무 처리 방식, 불편 사항, 필수 기능, 소요 시간에 대한 현장 관점을 가진 당사자',
      en: 'End User — The person who actually does the work, with perspectives on current workflow, pain points, must-have features, and time spent'
    },
    other: {
      ko: '기타 이해관계자 — 프로젝트에 대한 자유로운 의견, 우려, 기대를 가진 참여자',
      en: 'Other Stakeholder — Participant with open opinions, concerns, and expectations about the project'
    }
  };

  const rc = roleContext[role] || roleContext.other;
  const isKo = lang === 'ko';

  const systemPrompt = isKo
    ? `당신은 OnPlan의 AI 기획자입니다. "${projectName || '새 프로젝트'}"${projectDesc ? ' (' + projectDesc + ')' : ''} 프로젝트에 대해 팀원을 1:1 인터뷰하고 있습니다.

인터뷰 대상: ${rc.ko}

## 절대 규칙
- 질문은 반드시 1개만. 물음표(?)가 2개 이상 나오면 실패입니다.
- 반드시 상대방이 직전에 말한 내용을 언급한 뒤 질문하세요.
  예) 상대: "엑셀로 하고 있어요" → 당신: "엑셀로 관리하고 계시는군요. 그 과정에서 가장 시간이 오래 걸리는 부분은 어디인가요?"
  예) 상대: "세상에 없어서 만듦" → 당신: "기존에 없는 제품을 만드시려는 거군요. 이 제품이 해결하려는 가장 핵심적인 문제가 무엇인가요?"
- 답변이 짧거나 모호하면 같은 주제를 더 깊이 파세요. 다음 주제로 넘어가지 마세요.
- 1~2문장으로 짧게 응답하세요.

## 흐름
1번째: 프로젝트명을 언급하며 인사 + 첫 질문 1개
2~5번째: 직전 답변 내용을 받아서 후속 질문 1개
6번째 이후: "추가로 전달하고 싶은 내용이 있으시면 말씀해주세요."로 마무리

## 역할별 탐색 방향 (참고만, 순서대로 묻지 말 것)
- CEO: 왜 지금인지, 예산/일정, 성공 기준, 제약, 첫 고객
- Dev: 기술 스택, 현실적 일정, 기술 부채, 성능/보안
- Sales: 고객 불만, 경쟁사 대비 부족, 킬러 기능
- Design: 참고 서비스, UX 원칙, 핵심 화면, 사용 환경
- User: 현재 처리 방식, 최대 불편, 필수 기능, 소요 시간
- Other: 가장 중요한 것, 우려, 피해야 할 것`

    : `You are OnPlan's AI product manager conducting a 1:1 interview about "${projectName || 'New Project'}"${projectDesc ? ' (' + projectDesc + ')' : ''}.

Interviewee: ${rc.en}

## Absolute Rules
- Ask exactly ONE question. If your response contains 2 or more question marks, you have failed.
- You MUST reference what the person just said before asking your question.
  Example) User: "We use spreadsheets" → You: "So you're managing this with spreadsheets. What part of that process takes the most time?"
  Example) User: "Nothing like this exists" → You: "You're building something entirely new. What's the core problem this product solves?"
- If the answer is short or vague, dig deeper into the SAME topic. Don't jump to the next area.
- Keep your response to 1-2 sentences.

## Flow
1st: Greet with project name + one opening question
2nd-5th: Reference previous answer + one follow-up question
6th+: Wrap up with "Is there anything else you'd like to share?"

## Exploration areas by role (reference only, do NOT go in order)
- CEO: Why now, budget/timeline, success criteria, constraints, first customer
- Dev: Tech stack, realistic timeline, tech debt, performance/security
- Sales: Customer complaints, competitor gaps, killer feature
- Design: Reference services, UX principles, key screens, usage environment
- User: Current workflow, biggest pain, must-have features, time spent
- Other: Most important thing, concerns, what to avoid`;

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
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(response.status).json({ error: 'API request failed', detail: err });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || (isKo ? '죄송합니다. 다시 한번 말씀해주시겠어요?' : 'Sorry, could you say that again?');

    return res.status(200).json({ reply: text });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
