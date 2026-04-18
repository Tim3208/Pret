# feat/#7 작업 가이드

## 브랜치 메타 정보

- 현재 브랜치: `feat/#7`
- 관련 이슈: `#7`
- 이슈 제목: `[FSD] feat/#5의 voca lexicon and word prompt polish를 feat/#6 구조로 이식`
- 현재 구조 기준 브랜치: `feat/#6`
- 원본 기능 브랜치: `origin/feat/#5`
- 변경 의도 추출 기준: `c8138f4`
  - 참고: `c8138f4`는 현재 `origin/feat/#4`, `feat/#4`, `main`이 함께 가리키는 공통 기준 커밋이다.
  - `feat/#4`의 마지막 커밋 메시지: `chore: github page 배포작업`
  - 조사 원칙: `c8138f4` 이후 `origin/feat/#5`에서 추가된 변경분을 이번 이식 대상 기능으로 본다.
- 대상 기능명: `voca lexicon and word prompt polish`

## 이 브랜치의 목표

이번 브랜치의 목표는 `feat/#5`에서 개발된 `voca lexicon and word prompt polish` 기능을
현재 `feat/#6` 구조에 맞게 다시 배치하고 구현하는 것이다.

중요:

- 이번 작업은 단순 cherry-pick 이 아니다.
- 삭제된 예전 파일 구조를 복원하지 않는다.
- 현재 구조의 책임 경계를 유지한 채 기능을 이식한다.

## 먼저 읽을 문서

작업을 시작하기 전에 아래 문서를 순서대로 확인한다.

1. `AGENTS.md`
2. [docs/ai/voca-lexicon-word-prompt-polish-plan.md](docs/ai/voca-lexicon-word-prompt-polish-plan.md)
3. [docs/ai/feature-porting-guide.md](docs/ai/feature-porting-guide.md)

원칙:

- 예전 리팩토링 문서는 기본 참고 대상이 아니다.
- 구조 규칙이 정말로 모호할 때만 과거 문서를 보조적으로 확인한다.

## 저장소 읽는 순서

AI는 아래 순서로 저장소를 읽는다.

1. `src/app`
2. `src/pages`
3. `src/widgets`
4. `src/features`
5. `src/entities`
6. `src/shared`
7. `src/content`

전투 관련 기능이면 아래 순서로 더 좁혀 읽는다.

1. `src/pages/battle/ui/BattlePage.tsx`
2. `src/widgets/battle-stage/ui/BattleStage.tsx`
3. `src/widgets/battle-stage/model/*`
4. `src/widgets/battle-stage/lib/*`
5. `src/features/battle-command-input/*`
6. `src/entities/*`
7. `src/content/text/battle/*`
8. `src/content/glossary/*`

## 배치 기준

- 화면 조합: `pages`
- 큰 장면 UI 블록: `widgets`
- 사용자 행동/입력/선택/사용: `features`
- 타입/규칙/계산/판정: `entities`
- 완전 공용 유틸 또는 공용 UI: `shared`
- 플레이어 노출 텍스트/설명/로그/카탈로그 데이터: `content`

## 금지 사항

- 예전 브랜치 파일을 통째로 복사해서 덮어쓰기
- 삭제된 루트 `src` 평면 파일을 다시 만드는 것
- 다른 slice 내부 파일을 deep import 하는 것
- 플레이어 노출 텍스트를 컴포넌트 안에 직접 누적하는 것
- 기능 이식과 무관한 리디자인/밸런스 변경을 섞는 것

## 구현 순서

1. `feat/#5` 변경사항 조사
2. 변경 의도를 책임 단위로 분해
3. 현재 구조의 목표 위치 확정
4. `entities` / `content` / `shared` 반영
5. `features` / `widgets` 반영
6. `pages` / `app` 연결
7. 문서 갱신
8. 검증

## diff 조사 기준

이번 브랜치에서 기능 차이를 찾을 때는 아래 원칙을 고정한다.

- `feat/#4`의 마지막 상태는 `c8138f4`로 본다.
- 따라서 `origin/feat/#5`에서 이식할 기능은 `c8138f4` 이후에 추가된 변경분이다.
- 즉, 아래 범위가 "이번에 읽어야 할 실제 기능 diff"다.

```powershell
git log --oneline c8138f4..origin/feat/#5
git diff --name-only c8138f4..origin/feat/#5
git diff c8138f4..origin/feat/#5 -- <path>
```

읽는 방법:

- `c8138f4` 이전 내용은 기존 베이스로 취급한다.
- `c8138f4..origin/feat/#5` 사이에만 `voca lexicon and word prompt polish` 기능 의도가 들어 있다고 가정하고 조사한다.

## 완료 기준

- `feat/#5`의 핵심 동작이 현재 구조에서 재현된다.
- 삭제된 예전 경로를 다시 만들지 않는다.
- 플레이어 노출 텍스트가 로직 파일에 다시 뭉치지 않는다.
- `npm run lint`
- `npm run build`
