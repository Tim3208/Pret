# FSD 마이그레이션 작업 가이드

## 1. 문서 목적

이 문서는 실제 리팩토링 작업을 수행할 때 참고하는 실행 규칙 문서다.  
설계 배경과 장기 방향은 `docs/architecture/fsd-refactor-plan.ko.md`를 따르고, 이 문서는 구체적인 작업 방식과 금지 패턴을 정의한다.

## 2. 최종 목표

이번 리팩토링의 목표는 다음 네 가지다.

- `src`를 FSD 기반 구조로 재편한다.
- 플레이어 노출 텍스트를 `content` 계층 중심으로 정리한다.
- 대형 파일을 책임별로 분리한다.
- 참조 방향과 public API를 명확히 해, AI와 사람이 모두 읽기 쉬운 구조를 만든다.

## 3. 목표 디렉토리 구조

```text
src/
  app/
    providers/
    styles/
    App.tsx
    main.tsx

  pages/
    campfire/
    battle/
    post-battle-event/

  widgets/
    battle-stage/
    battle-log/
    resource-panel/
    encounter-scene/

  features/
    language-switch/
    bonfire-start/
    battle-command-input/
    potion-use/
    equipment-choice/

  entities/
    combat/
    player/
    monster/
    spell/
    equipment/
    locale/

  shared/
    lib/
    ui/
    config/
    assets/

  content/
    text/
      app/
      battle/
      event/
    glossary/
      spells/
      monsters/
    catalog/
      equipment/
      recipes/
```

## 4. 계층별 배치 기준

### `app`

- 앱 진입점
- 전역 provider
- 전역 스타일
- 앱 셸

다음을 두지 않는다.

- 전투 규칙
- 장면 전용 텍스트
- 개별 기능 로직

### `pages`

- 화면 또는 장면 단위 조합
- 페이지 레벨 상태 연결

다음을 두지 않는다.

- 순수 계산 유틸
- 세부 도메인 규칙 데이터

### `widgets`

- 복합 UI 블록
- 한 장면에서 큰 덩어리로 재사용되는 표현 계층

다음을 두지 않는다.

- 전역 공용 유틸
- 다른 장면 전용 텍스트 상수 누적

### `features`

- 사용자 행동 중심 기능
- 입력, 선택, 사용, 전환 같은 상호작용

다음을 두지 않는다.

- 플레이어/몬스터의 핵심 정의
- 장비/주문의 기본 데이터 모델

### `entities`

- 게임 개체 정의
- 타입
- 계산 함수
- 도메인 규칙

다음을 두지 않는다.

- 장면 연출용 UI 코드
- 긴 서사 텍스트

### `shared`

- 공용 유틸
- 공용 UI
- 공용 설정
- 공용 자산 접근 보조

다음을 두지 않는다.

- 특정 장면 문구
- 특정 몬스터/장비/이벤트 데이터

### `content`

- 플레이어가 읽는 텍스트
- 이름, 설명, 로그 문구
- 도감/사전/카탈로그성 데이터

다음을 두지 않는다.

- 렌더링 로직
- 계산 함수
- React 상태 처리

## 5. 텍스트 관리 규칙

텍스트는 전역 한 파일에 몰지 않는다.  
텍스트는 `도메인` 또는 `장면` 기준으로 나눈다.

권장 예시:

- `src/content/text/app/campfire.ts`
- `src/content/text/battle/scene.ts`
- `src/content/text/battle/log.ts`
- `src/content/text/event/postBattle.ts`
- `src/content/glossary/monsters/monsterText.ts`
- `src/content/glossary/spells/spellText.ts`
- `src/content/catalog/equipment/equipmentText.ts`

텍스트 파일 작성 규칙:

- TypeScript 객체로 작성한다.
- 로직을 넣지 않는다.
- 가능한 한 data-only 형태를 유지한다.
- 매우 짧고 국소적인 UI 라벨이 아니라면, 대형 컴포넌트 안에 직접 두지 않는다.

## 6. locale 구조 규칙

locale 관련 구조는 하나의 모델로 통합한다.

권장 분리:

- `entities/locale`
  - locale 타입
  - locale 판별
  - 초기 locale 결정
  - `pickText` 류 헬퍼

- `content`
  - 실제 번역 텍스트
  - 이름/설명/라벨 데이터

금지:

- `language.ts`와 `i18n.ts`처럼 역할이 겹치는 레이어를 장기간 공존시키는 것
- 컴포넌트 내부에 locale 데이터와 locale 로직을 동시에 누적하는 것

## 7. import 규칙

### 허용 방향

- `app` -> `pages`, `widgets`, `features`, `entities`, `shared`, `content`
- `pages` -> `widgets`, `features`, `entities`, `shared`, `content`
- `widgets` -> `features`, `entities`, `shared`, `content`
- `features` -> `entities`, `shared`, `content`
- `entities` -> `shared`, `content`
- `shared` -> `shared`
- `content` -> 없음

### 금지 방향

- 하위 계층이 상위 계층을 참조하는 것
- slice 외부에서 내부 파일을 직접 deep import하는 것
- 새 구조로 이동하면서 기존 상대 경로 의존을 무분별하게 유지하는 것
- 다만 `content`는 `typed data layer`이므로 파일 단위 import를 허용한다.

## 8. public API 규칙

각 slice는 외부 진입점을 `index.ts`로 제공한다.

예시:

- `src/entities/spell/index.ts`
- `src/features/language-switch/index.ts`
- `src/widgets/battle-stage/index.ts`

외부 사용자는 가능한 한 이 진입점을 통해 import한다.

예외:

- `content`는 `index.ts` public API를 강제하지 않는다.
- `content`는 `@/content/text/battle/log`처럼 파일 단위 import를 기본 규칙으로 둔다.
- `content`에 전역 집계 파일을 다시 만들어 텍스트를 한곳에 몰아넣지 않는다.

## 9. 리팩토링 순서

### 1단계. 골격 생성

- 디렉토리 골격 생성
- alias 전략 합의
- public API 규칙 적용 준비

### 2단계. locale 및 content 정리

- locale 중복 구조 통합
- 텍스트를 `content` 계층으로 이동
- 컴포넌트 내부 장문 텍스트 제거

### 3단계. 도메인 분리

- 기존 `battleTypes.ts` 분해
- combat, player, monster, spell, equipment 분리

### 4단계. 화면 분해

- `App.tsx`, `pages/battle/ui/BattlePage.tsx`, `widgets/battle-stage/ui/BattleStage.tsx` 분해
- pages / widgets / features 구조로 재배치

### 5단계. 레거시 정리

- 미사용 파일 점검
- 제거 또는 재배치 결정
- 문서 업데이트

## 10. 금지 패턴

다음 패턴은 이번 리팩토링에서 금지한다.

- 새 구조를 만들고도 다시 `src` 루트에 파일을 계속 추가하는 것
- `content` 계층을 만들고도 긴 텍스트를 컴포넌트 내부에 계속 두는 것
- `index.ts` 없이 다른 slice 내부 구현을 직접 참조하는 것
- 미사용 파일을 사용 여부 확인 없이 그대로 옮기는 것
- 전투 로직, 텍스트, UI, 연출을 하나의 새 파일에 다시 합치는 것
- 한 번에 너무 많은 파일을 옮겨 검증이 어려운 상태를 만드는 것

## 11. 각 단계 완료 기준

각 단계는 아래 조건을 만족해야 완료로 본다.

- 이동 대상 파일의 역할이 더 명확해졌다.
- import 경로가 이전보다 단순해졌다.
- 새 위치가 이후 확장에 더 적합하다.
- lint와 build 기준으로 검증 가능하다.

## 12. 문서 유지 규칙

- 실제 이동 계획이 바뀌면 `docs/ai/current-to-target-map.md`를 갱신한다.
- 구조 규칙이 바뀌면 본 문서를 먼저 갱신한다.
- 설계 수준 변경은 `docs/architecture/fsd-refactor-plan.ko.md`와 함께 반영한다.
