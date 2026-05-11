# claude-crew Workflow Extraction

이 문서는 Midnight Forge 하네스 재정비를 위해 `claude-crew`에서 가져올 워크플로우 정보만 추출한다. 시스템 아키텍처, 멀티 런타임 실행, 상태 저장, MCP, evaluation/evolution loop는 `ouroboros`를 우선 참조한다.

## Scope

가져올 것:

- `crew-interview -> crew-plan -> crew-dev` 단계 구조
- 각 단계에서 사용하는 agent와 호출 순서
- agent별 역할, 주요 입력, 출력, 차단해야 할 입력
- agent별 Claude subagent 기본 모델과 Codex provider 기본 모델

가져오지 않을 것:

- `crew-agent-runner.mjs` 중심 provider dispatch 구현
- Claude Code 전용 `EnterWorktree`, hook, HUD/statusline, session restore
- Codex companion app-server runtime
- `.crew/` git-tracked state 구조 자체
- checkpoint/commit/PR 생성 방식

## Source Files

- `/Users/jaejinsong/code/projects/plugins/claude-crew/README.ko.md`
- `/Users/jaejinsong/code/projects/plugins/claude-crew/skills/crew-interview/SKILL.md`
- `/Users/jaejinsong/code/projects/plugins/claude-crew/skills/crew-plan/SKILL.md`
- `/Users/jaejinsong/code/projects/plugins/claude-crew/skills/crew-dev/SKILL.md`
- `/Users/jaejinsong/code/projects/plugins/claude-crew/codex/skills/crew-interview/SKILL.md`
- `/Users/jaejinsong/code/projects/plugins/claude-crew/codex/skills/crew-plan/SKILL.md`
- `/Users/jaejinsong/code/projects/plugins/claude-crew/codex/skills/crew-dev/SKILL.md`
- `/Users/jaejinsong/code/projects/plugins/claude-crew/data/agent-contracts.json`
- `/Users/jaejinsong/code/projects/plugins/claude-crew/data/provider-catalog.json`
- `/Users/jaejinsong/code/projects/plugins/claude-crew/data/agent-instructions/*.md`

## Top-Level Pipeline

| Stage | Meaning | Primary artifact | Next gate |
|---|---|---|---|
| `crew-interview` | WHAT: 요구사항, 스코프, 수용 기준 결정 | `spec.md` | 사용자가 spec을 승인하거나 planning 가능한 수준으로 낮은 모호성 |
| `crew-plan` | HOW: 기술 분석, 구현 계획, 계획 검증 | `contract.md` | PlanEvaluator PASS |
| `crew-dev` | DO: 구현, 코드 리뷰, QA | working code + reports | CodeReviewer PASS + QA PASS |

MDF에서는 이름을 그대로 복사할 필요는 없다. 다만 흐름은 `interview/spec -> plan/contract -> execute/review/qa`로 유지할 가치가 있다.

## Workflow 1: Interview

목적: 원시 사용자 요청을 구현 가능한 `spec.md`로 만든다. 코드를 작성하지 않고 기술 아키텍처 판단도 하지 않는다.

### Agent Order

| Order | Agent | Required? | Role in stage |
|---:|---|---|---|
| 1 | Orchestrator | yes | task-id 생성, 작업공간 진입, `brief.md` 작성 |
| 2 | Explorer | yes at initialization | 기술 스택, 주요 모듈, 기존 패턴, 관련 기능 유무를 read-only로 탐색 |
| 3 | PM | yes | 요구사항 체크리스트 평가, 사용자 질문, scope simplification, `spec.md` 작성 |
| 4 | Researcher | conditional | 외부 문서/API/정책 근거가 요구사항 결정에 필요할 때만 사용 |
| 5 | PM | yes finalizer | 최종 scope를 spec으로 결정화하고 사용자 승인 요청 |

### Interview Loop

1. 사용자 원문을 `brief.md`로 보존한다.
2. Explorer가 프로젝트 구조와 관련 기존 코드를 파악한다.
3. PM이 5개 체크리스트를 평가한다.
4. NO 항목이 있으면 PM이 한 번에 질문 하나만 던진다.
5. 코드 근거가 더 필요하면 Explorer를 다시 호출한다.
6. 외부 근거가 필요하면 Researcher를 호출한다.
7. 모든 항목이 YES 또는 해당없음이면 PM이 v1 scope simplification을 수행한다.
8. PM이 `spec.md`를 작성하고 사용자 승인 또는 수정 요청을 받는다.

### Interview Checklist

- 개발자가 판단해야 할 비즈니스 결정이 없는가?
- 유저 플로우, 정상/예외가 정의되었는가?
- 스코프 경계, In/Out이 명시되었는가?
- UI 구조와 주요 문구/콘텐츠가 정의되었는가?
- 완료 기준이 검증 가능한 형태인가?

### Interview Artifact Shape

`spec.md`는 해당되는 섹션만 포함한다.

- 목표
- 스코프 경계
- 유저 플로우
- UI 구조 및 주요 콘텐츠
- 비즈니스 규칙
- 수용 기준
- 전제 조건
- 미해소 항목 또는 경고

MDF로 가져올 핵심은 PM 중심의 ambiguity reduction과 Explorer/Researcher의 사실 수집 역할 분리다. `.crew/plans/{task-id}` 경로와 Claude worktree 규칙은 가져오지 않는다.

## Workflow 2: Plan

목적: 승인된 `spec.md`를 구현자가 바로 시작 가능한 `contract.md`로 바꾼다. 코드는 작성하지 않는다.

### Agent Order

| Order | Agent | Required? | Role in stage |
|---:|---|---|---|
| 1 | Orchestrator | yes | `spec.md` 존재와 non-empty gate 확인 |
| 2 | TechLead | yes | 코드베이스 맥락, 아키텍처 방향, 리스크, guardrails, 테스트 인프라 분석 |
| 3 | Orchestrator | yes | 테스트 전략 선택 기록: TDD, Tests-after, None |
| 4 | Planner | yes | `spec.md + analysis.md` 기반 유저 스토리 단위 `plan.md` 작성 |
| 5 | PlanEvaluator | yes | E1-E8 hard gate로 PASS/FAIL 판정 |
| 6 | Planner | conditional retry | PlanEvaluator가 plan 결함으로 FAIL한 경우 피드백 반영 |
| 7 | Orchestrator | yes on PASS | `contract.md` 생성 |

### Plan Loop

1. `spec.md` gate를 통과해야 시작한다.
2. TechLead가 `analysis.md`를 만든다.
3. Orchestrator가 테스트 전략을 확정해 `analysis.md`에 기록한다.
4. Planner가 `plan.md`를 만든다.
5. PlanEvaluator가 `review.md`에서 PASS/FAIL을 판정한다.
6. FAIL이 `plan` 결함이면 `plan-{n}.md`, `review-{n}.md`로 보존하고 Planner를 재시도한다.
7. FAIL이 `spec` 결함이면 interview/spec 단계로 에스컬레이션한다.
8. 최대 루프는 초기 1회 + retry 4회다.
9. PASS 시 `contract.md`를 만든다.

### PlanEvaluator Hard Gates

| ID | Gate |
|---|---|
| E1 | 모든 태스크에 검증 방법이 있는가 |
| E2 | spec의 수용 기준, 유저 플로우, UI 구조, 비즈니스 규칙이 전부 태스크로 커버되는가 |
| E3 | plan에서 언급한 파일/모듈이 실제로 존재하는가 |
| E4 | 구현자가 바로 시작할 수 있는 수준인가 |
| E5 | 선택한 테스트 전략과 plan 태스크 구조가 일치하는가 |
| E6 | spec에 없는 비즈니스 가정을 추가하지 않았는가 |
| E7 | 사용자 관점의 실행 검증 절차가 있는가 |
| E8 | 외부 인터페이스 가정의 검증 상태와 spike task가 명시되었는가 |

모든 항목이 YES여야 PASS다. 모호하면 NO로 판정한다.

### Plan Artifact Shape

TechLead `analysis.md`:

- 요구사항 보완
- 코드베이스 맥락
- 아키텍처 방향
- 엣지 케이스/리스크
- Must/Must NOT guardrails
- 테스트 인프라
- 외부 인터페이스 검증
- 외부 리서치
- 테스트 전략

Planner `plan.md`:

- 테스트 전략
- 유저 스토리 `US-N`
- 구현 태스크
- 테스트 시나리오, 정상/에러 최소 1개씩
- 위험 요소
- 외부 인터페이스 가정
- 검증 시나리오
- 실행 검증

Final `contract.md`:

- 목표
- 수용 기준
- 유저 플로우
- UI 구조 및 주요 콘텐츠
- 비즈니스 규칙
- guardrails
- 테스트 전략
- 검증 시나리오
- 실행 검증
- 참조 문서
- 검증 이력
- 상태

MDF로 가져올 핵심은 TechLead -> Planner -> PlanEvaluator의 판정 분리와 hard gate retry loop다. `brief.md`를 Planner/PlanEvaluator에게 넘기지 않는 정보 차단 정책도 유지할 가치가 있다.

## Workflow 3: Dev

목적: `contract.md`와 `plan.md`를 기반으로 구현하고 CodeReviewer와 QA를 통과한다.

### Agent Order

| Order | Agent | Required? | Role in stage |
|---:|---|---|---|
| 1 | Orchestrator | yes | provider/model 정책 해석, `contract.md` ACTIVE gate 확인 |
| 2 | Dev | yes | 한 번에 하나의 user story 구현, 자체 검증 수행 |
| 3 | CodeReviewer | yes, parallel with QA | 코드 diff와 inline guardrails만 보고 품질 판정 |
| 4 | QA | yes, parallel with CodeReviewer | `plan.md` 기반 build/lint/type/test/E2E/실행 검증 직접 수행 |
| 5 | Dev | conditional retry | reviewer 또는 QA FAIL 피드백만 수정 |
| 6 | CodeReviewer + QA | yes final | 모든 US 이후 전체 변경분 최종 검증 |
| 7 | Orchestrator | yes on PASS | 완료 상태 갱신, 필요 시 PR 생성 |

### Dev Loop

1. `contract.md`가 ACTIVE이고 필수 섹션을 가져야 시작한다.
2. Orchestrator가 `plan.md`의 `US-N` 목록을 순서대로 파싱한다.
3. Dev는 현재 US 하나만 구현한다.
4. Dev는 자체 검증을 수행한다: build, lint, typecheck, tests, 실행 검증.
5. CodeReviewer와 QA를 병렬 실행한다.
6. 둘 다 PASS해야 해당 US가 PASS다.
7. 하나라도 FAIL이면 보고서를 보존하고 Dev가 해당 피드백만 수정한다.
8. 같은 기준 3회 연속 FAIL 또는 루프 상한 초과 시 BLOCKED로 에스컬레이션한다.
9. 모든 US PASS 후 최종 CodeReviewer와 최종 QA를 다시 실행한다.
10. 최종 둘 다 PASS해야 완료다.

### Dev Information Blocking

| Agent | Allowed | Denied | Reason |
|---|---|---|---|
| Dev | `plan.md`, `contract.md`, retry review/qa reports | `brief.md`, `spec.md`, `analysis.md` | 구현자가 의도를 재해석하지 않고 plan/contract만 따르게 함 |
| CodeReviewer | `git diff`, inline guardrails | `.crew/**`, `contract.md`, `plan.md`, `brief.md`, `spec.md`, `dev-log.md` | 수용 기준 체리피킹 대신 코드 품질과 guardrail 위반만 판정 |
| QA | `plan.md`, 코드베이스, 실행 결과 | `contract.md`, `brief.md`, `spec.md` | 검증 편향을 줄이고 plan의 실행 가능성을 확인 |

MDF로 가져올 핵심은 Dev 단일 구현자, CodeReviewer/QA 병렬 gate, 자체 검증 후 외부 검증, 정보 차단 정책이다. commit, push, PR 생성, `.crew` report path는 MDF의 별도 state/artifact 모델로 재설계한다.

## Agent Roster

| Agent | Core responsibility | Claude model | Claude tools | Codex default |
|---|---|---|---|---|
| `pm` | 요구사항 인터뷰, scope 결정, `spec.md` 작성 | `opus` | AskUserQuestion, Read, Write | `gpt-5.5`, medium |
| `explorer` | 코드베이스 사실 탐색, 판단 금지 | `haiku` | Read, Glob, Grep | `gpt-5.3-codex-spark`, low |
| `researcher` | 외부 문서/API 사실 조사, 출처 명시 | `sonnet` | WebSearch, WebFetch, Read | `gpt-5.4-mini`, high |
| `techlead` | architecture 판단, guardrails, 테스트 인프라 분석 | `opus` | AskUserQuestion, Read, Agent | `gpt-5.5`, high |
| `planner` | 구현 계획 작성, user story/task/test 분해 | `opus` | Read, Write, Agent | `gpt-5.5`, medium |
| `plan-evaluator` | 계획 hard gate 평가, 모호하면 NO | `sonnet` | Read, Agent | `gpt-5.4-mini`, high |
| `dev` | 구현, 자체 검증, direct/full mode 실행 | `opus` | Read, Write, Edit, Glob, Grep, Bash | `gpt-5.5`, medium |
| `code-reviewer` | code diff 품질 판정, guardrail 위반 탐지 | `opus` | Read, Glob, Grep | `gpt-5.5`, high |
| `qa` | build/lint/type/test/E2E/실행 검증 직접 수행 | `sonnet` | Read, Glob, Grep, Bash | `gpt-5.4-mini`, high |

## Agent Grouping for MDF

### Product Definition

- Primary: `pm`
- Support: `explorer`, `researcher`
- Output: spec/seed artifact

### Technical Planning

- Primary: `techlead`, `planner`, `plan-evaluator`
- Support: `explorer`, `researcher`
- Output: analysis/plan/contract artifact

### Execution

- Primary: `dev`
- Gates: `code-reviewer`, `qa`
- Output: code changes, dev log, review report, QA report

## Recommended MDF Interpretation

### Preserve

- Three-stage mental model: WHAT -> HOW -> DO
- Agent specialization and sequencing
- Planner and PlanEvaluator separation
- CodeReviewer and QA as independent gates
- Information blocking between artifacts
- Model intent:
  - strongest reasoning model for PM, TechLead, Planner, Dev, CodeReviewer
  - cheaper/faster model for Explorer
  - strict evaluator/QA model for PlanEvaluator, QA, Researcher

### Change

- Replace `.crew/plans/{task-id}` with MDF artifact/session storage.
- Replace `crew-agent-runner` with an Ouroboros-style runtime/system layer.
- Replace Claude-specific worktree assumptions with runtime-neutral worktree/session rules.
- Treat `provider/model` as configuration data, not workflow logic.
- Use Ouroboros-style Seed/Evaluate/Evolve concepts for system progression instead of claude-crew checkpoint semantics.

### Open Design Questions for Later Tasks

- MDF artifact names: keep `spec/plan/contract` or shift to `seed/execution/evaluation`.
- Whether `pm` and `techlead` can ask the user directly in every runtime, or whether user questions must always return to the orchestrator.
- Whether PlanEvaluator should remain a single strict agent or be folded into an Ouroboros-style evaluation stage.
- Whether QA should be read-only in policy while still allowed to execute commands that may create temporary files.
- Whether direct small-task execution should exist as an MDF v1 harness feature or remain a separate later workflow.

