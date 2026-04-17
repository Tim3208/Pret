# Pret 리팩토링 작업 가이드

## 현재 작업 맥락

- 현재 브랜치: `feat/#6`
- 현재 작업 목적: 프로젝트를 `FSD + content 계층` 구조로 전면 리팩토링한다.
- 이번 브랜치에서는 기능 추가보다 구조 정리, 의존 방향 정리, 텍스트 자산 정리를 우선한다.

## 먼저 읽을 문서

작업을 시작하기 전에 아래 문서를 순서대로 확인한다.

1. [docs/architecture/fsd-refactor-plan.ko.md](docs/architecture/fsd-refactor-plan.ko.md)
2. [docs/ai/fsd-migration-guide.md](docs/ai/fsd-migration-guide.md)
3. [docs/ai/current-to-target-map.md](docs/ai/current-to-target-map.md)

## 절대 규칙

- 루트 `src` 아래에 새 기능 파일을 평면적으로 추가하지 않는다.
- 큰 파일을 한 번에 통째로 옮기지 않고, 책임 단위로 나눠 이동한다.
- 플레이어 노출 텍스트는 가능한 한 `src/content` 계층으로 이동한다.
- locale 로직과 번역 데이터는 분리한다.
- `index.ts` 기반 public API를 우선하고, 다른 slice 내부 구현 파일에 대한 deep import를 늘리지 않는다.
- 도메인 규칙, 텍스트, UI, 연출 코드를 한 파일에 다시 섞지 않는다.
- 미사용 파일은 새 구조로 무작정 옮기지 말고, 실제 사용 여부를 확인한 뒤 유지 또는 제거를 결정한다.
- 각 단계가 끝날 때 `npm run lint`, `npm run build` 기준으로 검증 가능한 상태를 유지한다.

## 현재 우선 분해 대상

- `src/App.tsx`
- `src/BattleScene.tsx`
- `src/BattleCombat.tsx`
- `src/battleTypes.ts`
- `src/language.ts`
- `src/i18n.ts`

## 작업 원칙

- 폴더 이동보다 책임 분리를 먼저 본다.
- 한 PR 또는 한 커밋에 너무 많은 역할 변경을 섞지 않는다.
- 텍스트 수정만 필요한 경우 로직 파일을 건드리지 않는 구조를 목표로 한다.
- 새 구조가 완성되기 전까지는 “임시 파일”을 늘리기보다, 목표 구조를 향한 명확한 중간 상태를 만든다.

## 문서 갱신 규칙

- 구조 규칙이 바뀌면 `docs/architecture/fsd-refactor-plan.ko.md`를 먼저 갱신한다.
- 실제 이동 계획이나 경로 결정이 바뀌면 `docs/ai/current-to-target-map.md`를 갱신한다.
- 작업 규칙, 금지 패턴, 단계 순서가 바뀌면 `docs/ai/fsd-migration-guide.md`를 갱신한다.
