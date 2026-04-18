# voca lexicon and word prompt polish 이식 계획

## 1. 작업 목적

`feat/#5`에서 개발된 `voca lexicon and word prompt polish` 기능을
현재 `feat/#6` 구조에 맞게 다시 구현한다.

이번 작업은 예전 파일을 복사하는 것이 아니라,
기능의 실제 변경 의도를 현재 구조에 맞게 재배치하는 것이다.

## 2. 현재 브랜치 맥락

- 현재 작업 브랜치: `feat/#7`
- 현재 구조 기준 브랜치: `feat/#6`
- 원본 기능 브랜치: `origin/feat/#5`
- 변경 의도 추출 기준: `c8138f4`
  - `feat/#4`의 마지막 커밋
  - 커밋 메시지: `chore: github page 배포작업`
- 관련 이슈: `#7`

## 3. 먼저 확인할 것

1. `feat/#5`에서 실제로 바뀐 파일 목록
2. `feat/#5`에서 추가/수정된 문구, 데이터, 상호작용, 판정 로직
3. 현재 구조에서 대응되는 위치

권장 명령 예시:

```powershell
git diff --name-only c8138f4..origin/feat/#5
git log --oneline c8138f4..origin/feat/#5
git diff c8138f4..origin/feat/#5 -- <path>
```

중요:

- `c8138f4`는 `feat/#4`의 마지막 상태이므로 기준선이다.
- 따라서 `c8138f4..origin/feat/#5` 범위의 diff만 이번 기능 이식 대상이다.
- 새 세션에서는 이 범위를 먼저 읽고, 그 안에서 문구/데이터/입력 UX/판정 규칙 차이를 추출한다.

## 4. 예상 책임 매핑

현재 정보만 기준으로 보면 우선 아래 위치를 의심한다.

- 어휘/사전 관련 데이터: `src/content/glossary/*`
- 전투 프롬프트/문구 polish: `src/content/text/battle/*`
- 입력 경험 또는 prompt UI: `src/features/battle-command-input/*`
- 전투 화면 연결: `src/widgets/battle-stage/*`, `src/pages/battle/*`
- 타입/판정/도메인 규칙: `src/entities/*`

주의:

- 실제 매핑은 반드시 `feat/#5` diff를 본 뒤 확정한다.
- 이름만 보고 위치를 확정하지 않는다.

## 5. 조사 체크리스트

- 새 텍스트가 추가되었는가
- 기존 텍스트 표현만 다듬었는가
- 입력 UX가 바뀌었는가
- 어휘/사전 데이터 구조가 바뀌었는가
- 전투 판정이나 단어 처리 규칙이 바뀌었는가
- 단순 문구 수정인지, 실제 기능 추가인지

## 6. 구현 원칙

- 이미 분리된 `pages / widgets / features / entities / content` 경계를 유지한다.
- `BattleStage.tsx` 같은 조합 컴포넌트에 새 순수 로직을 다시 몰아넣지 않는다.
- 텍스트는 가능한 한 `content`에 두고, 로직 파일에는 직접 누적하지 않는다.
- 공식 진입점이 있는 slice는 public API를 우선 사용한다.

## 7. 완료 체크리스트

- 원본 기능의 핵심 동작을 현재 구조에서 재현했다.
- 현재 구조의 책임 경계를 깨지 않았다.
- 새 텍스트/어휘 데이터의 위치가 명확하다.
- `npm run lint`
- `npm run build`

## 8. 현재 이식 위치

- word prompt 판정과 타입: `src/entities/combat`
- decipher / combination / stability 스탯과 최대치 계산: `src/entities/player`
- 장비 스탯 보정 반영: `src/entities/equipment`
- 몬스터 intent telegraph 단계화: `src/entities/monster`
- 전투 문구와 prompt judgement copy: `src/content/text/battle/*`
- VOCA 카탈로그 데이터: `src/content/glossary/voca/lexicon.ts`
- VOCA 오버레이 UI: `src/widgets/voca-lexicon/*`
- prompt 입력 처리: `src/features/battle-command-input/*`
- prompt 이펙트/lexicon stat HUD와 전투 연결: `src/widgets/battle-stage/*`
- 앱 루트 연결: `src/app/App.tsx`

## 9. 검증 결과

- `npm run lint` 통과
- `npm.cmd run build` 통과

참고:

- PowerShell execution policy 때문에 `npm run build`는 `npm.ps1`에서 차단되었고, 같은 빌드를 `npm.cmd run build`로 검증했다.
