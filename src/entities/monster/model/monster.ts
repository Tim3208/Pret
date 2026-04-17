import type { Element } from "@/entities/spell";

export type MonsterIntentKind = "attack" | "defend" | "spell";

/**
 * 몬스터가 다음 턴에 수행할 의도를 설명한다.
 */
export interface MonsterIntent {
  kind: MonsterIntentKind;
  label: string;
  damage: number;
  element?: Element;
}

/**
 * 전투에 참가하는 몬스터 정의다.
 */
export interface MonsterDef {
  name: string;
  maxHp: number;
  element?: Element;
  intents: MonsterIntent[];
  revealTurnsAhead: number;
}

/**
 * 기본 전투에 등장하는 테스트 몬스터 정의다.
 */
export const HOLLOW_WRAITH: MonsterDef = {
  name: "Hollow Wraith",
  maxHp: 60,
  element: undefined,
  intents: [
    { kind: "attack", label: "drawing a sword...", damage: 8 },
    { kind: "attack", label: "preparing an attack...", damage: 6 },
    { kind: "defend", label: "bracing for defense...", damage: 0 },
    {
      kind: "spell",
      label: "gathering the power of fire...",
      damage: 12,
      element: "fire",
    },
    { kind: "attack", label: "charging fiercely...", damage: 10 },
    { kind: "defend", label: "summoning something...", damage: 0 },
  ],
  revealTurnsAhead: 1,
};

/**
 * 몬스터 의도 목록에서 다음 행동을 무작위 선택한다.
 */
export function pickMonsterIntent(monster: MonsterDef): MonsterIntent {
  return monster.intents[Math.floor(Math.random() * monster.intents.length)];
}
