# Pret 작업 가이드

## 목적

이 저장소는 현재 FSD 기반 구조를 유지하는 것이 최우선이다.
AI는 기능을 추가하거나 이식할 때 결과보다 먼저 책임 경계를 지켜야 한다.

핵심 원칙:

- 현재 `src` 구조를 기준으로 작업한다.
- 삭제된 예전 평면 `src` 구조를 복원하지 않는다.
- 기능 이식은 복사가 아니라 책임 단위 재배치로 처리한다.
- 플레이어 노출 텍스트와 도메인 로직을 다시 섞지 않는다.

## 먼저 읽을 것

작업 시작 시 아래 순서를 기본으로 따른다.

1. `AGENTS.md`
2. 관련 기능 문서가 있으면 `docs/ai/*`
3. 구조가 모호하면 `docs/ai/feature-porting-guide.md`

원칙:

- 과거 리팩토링 이전 문서는 기본 참고 대상이 아니다.
- 기능 문서가 있으면 그 문서를 우선한다.
- 문서가 없으면 현재 코드 구조를 기준으로 책임을 판단한다.

## 저장소 읽는 순서

AI는 아래 순서로 저장소를 읽는다.

1. `src/app`
2. `src/pages`
3. `src/widgets`
4. `src/features`
5. `src/entities`
6. `src/shared`
7. `src/content`

의도:

- `app`: 진입점과 전역 셸만 확인
- `pages`: 어떤 화면이 어떤 블록을 조합하는지 파악
- `widgets`: 큰 장면 UI 블록 파악
- `features`: 사용자 입력과 행동 단위 확인
- `entities`: 타입, 규칙, 계산, 판정 확인
- `shared`: 완전 공용 유틸과 공용 UI만 확인
- `content`: 플레이어 노출 텍스트와 카탈로그 데이터 확인

## 전투 기능 읽는 순서

전투 관련 작업이면 아래 순서로 더 좁혀 읽는다.

1. `src/pages/battle/ui/BattlePage.tsx`
2. `src/widgets/battle-stage/ui/BattleStage.tsx`
3. `src/widgets/battle-stage/model/*`
4. `src/widgets/battle-stage/lib/*`
5. `src/features/battle-command-input/*`
6. `src/entities/*`
7. `src/content/text/battle/*`
8. `src/content/glossary/*`

## 계층 배치 기준

- 화면 조합: `pages`
- 큰 장면 UI 블록: `widgets`
- 사용자 행동, 입력, 선택, 사용: `features`
- 타입, 규칙, 계산, 판정: `entities`
- 완전 공용 유틸 또는 공용 UI: `shared`
- 플레이어 노출 텍스트, 설명, 로그, 카탈로그 데이터: `content`

판단 규칙:

- 전투 문구나 안내문은 먼저 `content` 배치를 검토한다.
- 입력 해석이나 사용자 조작은 먼저 `features` 배치를 검토한다.
- 수치 계산과 판정은 먼저 `entities` 배치를 검토한다.
- 조합 컴포넌트에는 새 순수 로직을 몰아넣지 않는다.

## 구현 규칙

- 다른 slice 내부 파일로 deep import 하지 않는다.
- 가능하면 각 slice의 public API인 `index.ts`를 통해 가져온다.
- 플레이어가 읽는 텍스트를 컴포넌트 내부 상수에 누적하지 않는다.
- 새 기능을 만들더라도 무관한 리디자인이나 밸런스 변경을 섞지 않는다.
- 기존 경로가 사라졌다면 같은 파일을 다시 만들지 말고 현재 구조에 맞춰 옮긴다.
- `shared`에는 진짜 공용 코드만 둔다.

## 기능 이식 규칙

리팩토링 이전 브랜치 기능을 옮길 때는 아래 원칙을 따른다.

1. 기준 ref와 원본 브랜치를 먼저 확정한다.
2. diff를 파일명이 아니라 변경 의도로 읽는다.
3. 변경 의도를 `entities`, `content`, `shared`, `features`, `widgets`, `pages`, `app` 중 어디에 둘지 먼저 확정한다.
4. 구현은 `entities / content / shared`부터 반영한다.
5. 그 다음 `features / widgets`를 반영한다.
6. 마지막으로 `pages / app`을 연결한다.
7. 관련 문서를 갱신한다.
8. 검증한다.

중요:

- cherry-pick이나 통파일 복사를 기본 전략으로 쓰지 않는다.
- 삭제된 예전 파일 구조를 되살리지 않는다.
- 기능 의도만 현재 구조에 맞게 이식한다.

## 금지 사항

- 예전 브랜치 파일을 통째로 복사해 현재 구조 위에 덮어쓰기
- 삭제된 루트 `src` 평면 파일 다시 만들기
- 다른 slice 내부 파일 deep import
- 플레이어 노출 텍스트를 로직 파일이나 컴포넌트에 직접 누적
- 기능 이식과 무관한 UI 리디자인, 리팩토링, 밸런스 변경 섞기

## 문서 갱신 규칙

아래 경우 문서를 같이 갱신한다.

- 새 기능을 현재 구조에 이식했을 때
- 책임 배치 기준이 추가되거나 달라졌을 때
- 후속 작업자가 읽어야 하는 feature-specific 문서가 생겼을 때

기본 위치:

- 기능별 이식/설계 문서: `docs/ai/*`

## 검증

작업 완료 전 아래를 기본 검증으로 본다.

- `npm run lint`
- `npm run build`

Windows PowerShell 실행 정책 때문에 `npm.ps1`가 막히면 아래처럼 대체한다.

- `npm.cmd run lint`
- `npm.cmd run build`

## 머지 원칙

브랜치 머지 작업을 맡았을 때 사용자의 별도 지시가 없다면 임의로 충돌 해결 정책을 바꾸지 않는다.
사용자가 충돌 시 한쪽 브랜치 우선 전략을 명시한 경우에만 그 전략을 따른다.
