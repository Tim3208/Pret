# 현재 구조 -> 목표 구조 매핑

## 1. 문서 목적

이 문서는 현재 파일이 목표 FSD 구조에서 어디로 이동해야 하는지 기록한다.  
단순 이동이 아니라 `분해 후 재배치`가 필요한 경우도 함께 명시한다.

주의:

- 아래 경로는 현재 기준의 목표안이다.
- 실제 구현 과정에서 세부 경로명은 조정될 수 있다.
- 다만 계층 방향과 책임 분리는 이 문서를 기준으로 유지한다.

## 2. 우선 이동 대상

| 현재 경로 | 목표 경로 | 조치 | 비고 |
|---|---|---|---|
| `src/app/main.tsx` | `src/app/main.tsx` | 완료 | 앱 진입점 이동 완료 |
| `src/app/App.tsx` | `src/app/App.tsx` | 1차 이동 완료 | 루트 앱 셸은 이동했고, 장면 조합은 이후 `pages`로 분리 |
| `src/app/styles/index.css` | `src/app/styles/index.css` | 완료 | 전역 스타일 이동 완료 |
| `src/BattleScene.tsx` | `src/pages/battle/ui/BattlePage.tsx` + `src/widgets/battle-stage/model/*` + `src/content/text/battle/*` | 분해 | 장면 전환, 규칙, 텍스트 분리 필요 |
| `src/BattleCombat.tsx` | `src/widgets/battle-stage/ui/BattleStage.tsx` + `src/widgets/battle-stage/lib/*` + `src/features/battle-command-input/*` | 대형 분해 | 입력, 연출, 자원 UI를 단계적으로 분리 |
| `src/battleCombatCore.ts` | `src/widgets/battle-stage/lib/core.ts` | 이동 | 위젯 내부 코어 유틸 |
| `src/battleCombatVisuals.ts` | `src/widgets/battle-stage/lib/visuals.ts` | 이동 | 위젯 내부 렌더링 유틸 |
| `src/pages/post-battle-event/ui/PostBattleEventPage.tsx` | `src/pages/post-battle-event/ui/PostBattleEventPage.tsx` + `src/content/text/event/postBattle.ts` | 1차 이동 완료 | 페이지 이동은 완료, 텍스트 분리는 이후 진행 |
| `src/widgets/encounter-scene/ui/SkullEncounter.tsx` | `src/widgets/encounter-scene/ui/SkullEncounter.tsx` | 완료 | 전투 조우 연출 위젯 이동 완료 |
| `src/SwordEncounter.tsx` | `src/widgets/encounter-scene/ui/SwordEncounter.tsx` 또는 제거 | 검토 | 현재 사용 여부 재확인 필요 |

## 3. 도메인 파일 매핑

| 현재 경로 | 목표 경로 | 조치 | 비고 |
|---|---|---|---|
| `src/battleTypes.ts` | `src/entities/player/model/*` + `src/entities/spell/model/*` + `src/entities/monster/model/*` + `src/entities/equipment/model/*` + `src/content/catalog/equipment/*` | 대형 분해 | 규칙, 타입, 장비 텍스트가 함께 섞여 있음 |
| `src/language.ts` | `src/entities/locale/model/*` + `src/content/glossary/monsters/*` + `src/content/glossary/spells/*` | 분해 | locale 헬퍼와 실제 표시 데이터 분리 |
| `src/i18n.ts` | `src/entities/locale/model/*` 또는 제거 | 통합 | `language.ts`와 역할 중복 구조 정리 필요 |

## 4. UI / 기능 파일 매핑

| 현재 경로 | 목표 경로 | 조치 | 비고 |
|---|---|---|---|
| `src/shared/ui/crt-overlay/CrtOverlay.tsx` | `src/shared/ui/crt-overlay/CrtOverlay.tsx` | 완료 | 공용 시각 오버레이 이동 완료 |
| `src/features/potion-use/ui/HealthPotion.tsx` | `src/features/potion-use/ui/HealthPotion.tsx` | 완료 | 사용자 행동과 직접 연결된 UI 이동 완료 |
| `src/widgets/resource-panel/ui/HeartHP.tsx` | `src/widgets/resource-panel/ui/HeartHP.tsx` | 완료 | 자원 패널 표현 요소 이동 완료 |
| `src/widgets/resource-panel/ui/ManaFlask.tsx` | `src/widgets/resource-panel/ui/ManaFlask.tsx` | 완료 | 자원 패널 표현 요소 이동 완료 |
| `src/shared/ui/resource-charge-burst/ResourceChargeBurst.tsx` | `src/shared/ui/resource-charge-burst/ResourceChargeBurst.tsx` | 완료 | 자원 변화 공용 연출 이동 완료 |
| `src/LanguageSelector.tsx` | `src/features/language-switch/ui/LanguageSelector.tsx` | 이동 또는 재사용 | 현재 사용 여부 재확인 필요 |

## 5. 훅 / 유틸 / 자산 매핑

| 현재 경로 | 목표 경로 | 조치 | 비고 |
|---|---|---|---|
| `src/shared/lib/ascii/useAsciiAsset.ts` | `src/shared/lib/ascii/useAsciiAsset.ts` | 완료 | 공용 ASCII 자산 로더 이동 완료 |
| `src/useImageToAscii.ts` | `src/shared/lib/ascii/useImageToAscii.ts` 또는 제거 | 검토 | 현재 사용 여부 재확인 필요 |
| `src/assets/*` | `src/shared/assets/*` 또는 제거 | 검토 | 실제 사용 중인 자산만 유지 |
| `public/assets/*` | `public/assets/*` 유지 | 유지 | 정적 배포 자산 경로는 현행 유지 가능 |

## 6. 텍스트 자산 매핑

| 현재 위치 | 목표 경로 | 조치 | 비고 |
|---|---|---|---|
| `src/app/App.tsx` 내부 도입 텍스트 | `src/content/text/app/campfire.ts` | 분리 | 캠프파이어 장면 텍스트 |
| `src/BattleScene.tsx` 내부 조우/전투 텍스트 | `src/content/text/battle/scene.ts` | 분리 | 전투 장면 텍스트 |
| `src/BattleScene.tsx` 내부 로그 문구 | `src/content/text/battle/log.ts` | 분리 | 전투 로그 텍스트 |
| `src/BattleCombat.tsx` 내부 UI 라벨 및 프롬프트 | `src/content/text/battle/ui.ts` | 분리 | 입력, 버튼, 안내 문구 |
| `src/pages/post-battle-event/ui/PostBattleEventPage.tsx` 내부 텍스트 | `src/content/text/event/postBattle.ts` | 분리 | 전투 후 이벤트 문구 |
| `src/battleTypes.ts` 내부 장비 이름/설명/효과 텍스트 | `src/content/catalog/equipment/equipmentText.ts` | 분리 검토 | 규칙 데이터와 설명 데이터 분리 여부 확정 필요 |

## 7. 제거 또는 보류 후보

아래 파일은 새 구조로 바로 이동하지 않고, 사용 여부를 먼저 확인한다.

- `src/SwordEncounter.tsx`
- `src/LanguageSelector.tsx`
- `src/useImageToAscii.ts`
- `src/assets/*` 중 현재 참조되지 않는 자산

## 8. 작업 우선순위

권장 순서는 다음과 같다.

1. `app` 골격과 스타일 경로 정리
2. locale 및 text 분리
3. `battleTypes.ts` 분해
4. `BattleScene.tsx` 분해
5. `BattleCombat.tsx` 분해
6. 미사용 파일 정리

## 9. 갱신 규칙

- 실제 파일이 이동되면 이 문서의 해당 행을 즉시 갱신한다.
- 목표 경로가 바뀌면 이유와 함께 수정한다.
- 제거가 확정된 파일은 별도 표기가 아니라 본 표에서 상태를 갱신해 반영한다.
