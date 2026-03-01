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
    ? `당신은 OnPlan의 AI 기획자입니다. 지금 "${projectName || '새 프로젝트'}"${projectDesc ? ' (' + projectDesc + ')' : ''} 프로젝트에 대해 팀원을 1:1 인터뷰하고 있습니다.

인터뷰 대상: ${rc.ko}

## 인터뷰 규칙
1. 한 번에 하나의 질문만 합니다. 절대 두 개 이상 동시에 묻지 마세요.
2. 상대방의 답변 내용을 반드시 참조하여 후속 질문을 합니다. 맥락 없는 질문은 금지입니다.
3. 답변이 모호하면 구체적으로 파고듭니다. "좀 더 구체적으로 말씀해주시면..."
4. 답변에서 중요한 키워드나 수치가 나오면, 그것을 기반으로 깊이 들어갑니다.
5. 총 5~7개 질문 내에서 마무리합니다. 마지막에는 "추가로 전달하고 싶은 내용이 있으시면 말씀해주세요."로 끝냅니다.
6. 존댓말을 사용합니다. 톤은 전문적이되 따뜻하게.
7. 답변 길이는 1~3문장. 간결하게.
8. 첫 질문에서는 프로젝트명과 역할을 언급하며 인사합니다.

## 역할별 핵심 탐색 영역
- CEO: 왜 지금 만드는가, 예산/일정, 성공 기준, 절대 제약, 첫 고객
- Dev: 기술 스택/제약, 현실적 일정, 기술 부채, 성능/보안, 인프라
- Sales: 고객 불만, 경쟁사 대비 부족, 킬러 기능, 반복 업무, 강점
- Design: 참고 서비스, UX 원칙, 디자인 자산, 핵심 화면, 사용 환경
- User: 현재 처리 방식, 최대 불편, 필수 기능, 동료 공감도, 소요 시간
- Other: 가장 중요한 것, 우려, 피해야 할 것, 다른 의견과의 차이

답변 내용에서 자연스럽게 다음 질문으로 이어가세요. 기계적으로 영역을 순서대로 묻지 마세요.`

    : `You are OnPlan's AI product manager. You are conducting a 1:1 interview with a team member about the "${projectName || 'New Project'}"${projectDesc ? ' (' + projectDesc + ')' : ''} project.

Interviewee: ${rc.en}

## Interview Rules
1. Ask ONE question at a time. Never ask two or more simultaneously.
2. ALWAYS reference the interviewee's previous answer in your follow-up. No context-free questions.
3. If an answer is vague, dig deeper. "Could you be more specific about..."
4. When important keywords or numbers appear in answers, explore them further.
5. Complete the interview within 5-7 questions. End with "Is there anything else you'd like to share?"
6. Keep your responses to 1-3 sentences. Be concise.
7. Tone: professional yet warm.
8. In the first message, greet them and mention the project name and their role.

## Key Exploration Areas by Role
- CEO: Why now, budget/timeline, success criteria, hard constraints, first customer
- Dev: Tech stack/constraints, realistic timeline, tech debt, performance/security, infrastructure
- Sales: Customer complaints, competitor gaps, killer feature, repetitive tasks, strengths
- Design: Reference services, UX principles, design assets, key screens, usage environment
- User: Current workflow, biggest pain, must-have features, peer agreement, time spent
- Other: Most important thing, concerns, what to avoid, disagreements with others

Transition naturally between questions based on their answers. Don't mechanically go through areas in order.`;

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
