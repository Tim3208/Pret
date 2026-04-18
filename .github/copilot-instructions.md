# Pret Copilot Instructions

- 이 저장소는 현재 FSD 기반 `src` 구조를 기본으로 유지한다.
- 새 기능이나 수정 사항은 기존 계층 경계를 먼저 판단한 뒤 배치한다.
- 계층 기준은 다음을 따른다: `app` 전역 진입점, `pages` 화면 조합, `widgets` 큰 UI 블록, `features` 사용자 행동, `entities` 도메인 규칙과 계산, `shared` 공용 유틸과 공용 UI, `content` 플레이어 노출 텍스트와 데이터.
- 삭제된 예전 평면 `src` 구조를 복원하지 않는다.
- 구조 재설계가 필요하면 먼저 사용자에게 이유와 범위를 제안하고 승인을 받은 뒤 진행한다. 작업 후에는 관련 문서를 갱신한다.
- 다른 slice 내부 파일로 deep import 하지 말고, 가능하면 각 slice의 public API인 `index.ts`를 통해 접근한다.
- 플레이어 노출 텍스트를 로직 파일이나 컴포넌트 안에 직접 누적하지 않는다. 재사용되거나 관리가 필요한 문구는 `content`로 분리한다.
- 새로운 함수를 추가할 때는 이해하기 쉬운 한글 JSDoc을 작성한다. 입력과 반환이 헷갈리면 `@param`, `@returns`를 함께 적고, 복잡한 변수에는 짧은 한글 주석을 추가할 수 있다.
- 저장소 전체 규칙이 바뀌면 `AGENTS.md`와 이 파일을 함께 갱신한다.
- 작업을 마치기 전에는 `npm run lint`, `npm run build`를 기준으로 검증한다. Windows PowerShell 실행 정책 이슈가 있으면 `npm.cmd run lint`, `npm.cmd run build`를 사용한다.

자세한 작업 기준은 [AGENTS.md](../AGENTS.md)를 따른다.
