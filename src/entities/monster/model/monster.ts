import type { PlayerStats } from "@/entities/player";
import type { Element } from "@/entities/spell";

export type MonsterIntentKind = "attack" | "defend" | "spell" | "heal";
type IntentTelegraphStages = Record<"en" | "ko", [string, string, string, string, string]>;

/**
 * 몬스터가 다음 턴에 수행할 의도를 설명한다.
 */
export interface MonsterIntent {
  kind: MonsterIntentKind;
  label: string;
  damage: number;
  healing?: number;
  element?: Element;
  telegraphs: IntentTelegraphStages;
}

/**
 * 전투에 참가하는 몬스터 정의다.
 */
export interface MonsterDef {
  id: string;
  name: string;
  asciiAssetPath: string;
  maxHp: number;
  experienceReward: number;
  element?: Element;
  intents: MonsterIntent[];
  revealTurnsAhead: number;
}

/**
 * 깊이에 따라 몬스터의 수치를 보정해 현재 조우용 정의를 만든다.
 *
 * @param monster 기준 몬스터 정의
 * @param depth 현재 진행 깊이
 * @returns 현재 깊이에 맞게 보정된 몬스터 정의
 */
function scaleMonsterForDepth(monster: MonsterDef, depth: number): MonsterDef {
  const safeDepth = Math.max(0, depth);

  return {
    ...monster,
    maxHp: monster.maxHp + safeDepth * (monster.id === "ash-boar" ? 4 : 8),
    experienceReward: monster.experienceReward + safeDepth * 2,
    intents: monster.intents.map((intent) => ({
      ...intent,
      damage:
        intent.kind === "attack" || intent.kind === "spell"
          ? intent.damage + safeDepth
          : intent.damage,
      healing: intent.healing === undefined ? undefined : intent.healing + safeDepth,
    })),
  };
}

function getEncounterSeed(depth: number, powerBucket: number): number {
  const raw = Math.sin(depth * 91.173 + powerBucket * 17.417) * 43758.5453;
  return raw - Math.floor(raw);
}

function getEffectivePlayerPower(stats: PlayerStats): number {
  return (
    stats.strength * 1.35
    + stats.agility * 1.15
    + stats.decipher * 0.55
    + stats.combination * 0.95
    + stats.stability * 0.9
  );
}

/**
 * 초반 진행에서 먼저 마주치는 둔한 멧돼지다.
 */
export const ASH_BOAR: MonsterDef = {
  id: "ash-boar",
  name: "Ash Boar",
  asciiAssetPath: "assets/ash_boar_ascii.md",
  maxHp: 16,
  experienceReward: 10,
  intents: [
    {
      kind: "attack",
      label: "snorting and charging...",
      damage: 4,
      telegraphs: {
        en: [
          "It drags a hoof through the dirt...",
          "Its snout points straight at you...",
          "The boar lowers its shoulders...",
          "It is preparing to ram...",
          "It is snorting and charging...",
        ],
        ko: [
          "발굽으로 흙을 길게 긁는다...",
          "콧등이 당신 쪽으로 고정된다...",
          "멧돼지가 어깨를 낮춘다...",
          "들이받을 준비를 한다...",
          "코를 울리며 돌진하려 한다...",
        ],
      },
    },
    {
      kind: "attack",
      label: "pawing the dirt...",
      damage: 3,
      telegraphs: {
        en: [
          "Dust puffs up around its hooves...",
          "It scrapes the ground again...",
          "The boar jerks with impatience...",
          "It is winding up a clumsy rush...",
          "It is pawing the dirt...",
        ],
        ko: [
          "발굽 주변으로 먼지가 피어오른다...",
          "땅을 한 번 더 거칠게 긁어낸다...",
          "멧돼지가 조급하게 몸을 튕긴다...",
          "서툰 돌진을 준비하는 듯하다...",
          "앞발로 흙을 긁어댄다...",
        ],
      },
    },
    {
      kind: "heal",
      label: "chewing on bitter roots...",
      damage: 0,
      healing: 4,
      telegraphs: {
        en: [
          "It noses around the burnt roots...",
          "Something disappears into its mouth...",
          "The boar seems less frantic for a beat...",
          "It is trying to patch itself up...",
          "It is chewing on bitter roots...",
        ],
        ko: [
          "불탄 뿌리 근처를 킁킁댄다...",
          "뭔가를 입에 밀어 넣는다...",
          "잠깐 광기가 잦아드는 듯하다...",
          "스스로를 추스르려 하는 것 같다...",
          "쓴 뿌리를 질겅거린다...",
        ],
      },
    },
  ],
  revealTurnsAhead: 1,
};

/**
 * 기본 전투에 등장하는 테스트 몬스터 정의다.
 */
export const HOLLOW_WRAITH: MonsterDef = {
  id: "hollow-wraith",
  name: "Hollow Wraith",
  asciiAssetPath: "assets/new_enemy_ascii.md",
  maxHp: 60,
  experienceReward: 20,
  element: undefined,
  intents: [
    {
      kind: "attack",
      label: "drawing a sword...",
      damage: 8,
      telegraphs: {
        en: [
          "Something shifts at its side...",
          "A long shape drags through the dark...",
          "The movement feels sharp...",
          "It is drawing a blade...",
          "It is drawing a sword...",
        ],
        ko: [
          "옆구리에서 무언가 꿈틀거린다...",
          "길쭉한 형체를 끌어올리는 듯하다...",
          "날카로운 움직임이 느껴진다...",
          "칼날을 끌어올리고 있다...",
          "검을 끌어올린다...",
        ],
      },
    },
    {
      kind: "attack",
      label: "preparing an attack...",
      damage: 6,
      telegraphs: {
        en: [
          "Its posture tightens...",
          "It gathers itself in a low stance...",
          "A hit feels imminent...",
          "It is readying an attack...",
          "It is preparing an attack...",
        ],
        ko: [
          "자세가 조금 굳어진다...",
          "낮게 몸을 모으는 듯하다...",
          "곧 타격이 올 것 같은 기분이 든다...",
          "공격 태세를 갖추고 있다...",
          "공격 태세를 가다듬는다...",
        ],
      },
    },
    {
      kind: "defend",
      label: "bracing for defense...",
      damage: 0,
      telegraphs: {
        en: [
          "Its outline grows denser...",
          "Something folds inward around its frame...",
          "It feels less exposed than before...",
          "It is settling into a guarded stance...",
          "It is bracing for defense...",
        ],
        ko: [
          "형체가 조금 짙어진다...",
          "몸 둘레로 무언가 접혀드는 듯하다...",
          "방금보다 빈틈이 줄어든 느낌이다...",
          "방어 자세로 몸을 굳히고 있다...",
          "방어 태세를 굳힌다...",
        ],
      },
    },
    {
      kind: "spell",
      label: "gathering the power of fire...",
      damage: 12,
      element: "fire",
      telegraphs: {
        en: [
          "Its fingers twitch in the dark...",
          "It seems to be tracing a circle...",
          "The gesture feels threatening...",
          "It is chanting an attack spell...",
          "It is preparing a fireball...",
        ],
        ko: [
          "손가락을 휘적인다...",
          "원을 그리는 듯 하다...",
          "위협이 느껴진다...",
          "공격 마법 영창을 하고 있다...",
          "화염구를 준비하고 있다...",
        ],
      },
    },
    {
      kind: "attack",
      label: "charging fiercely...",
      damage: 10,
      telegraphs: {
        en: [
          "Its weight tips forward...",
          "The floor protests beneath it...",
          "A rush feels close...",
          "It is coiling for a lunge...",
          "It is charging fiercely...",
        ],
        ko: [
          "무게 중심이 앞으로 쏠린다...",
          "바닥이 먼저 끙끙거린다...",
          "돌진의 기세가 느껴진다...",
          "몸을 웅크려 뛰쳐나올 듯하다...",
          "사납게 돌진할 기세다...",
        ],
      },
    },
    {
      kind: "defend",
      label: "summoning something...",
      damage: 0,
      telegraphs: {
        en: [
          "The air puckers beside it...",
          "Something stirs near its hands...",
          "An omen crawls into the room...",
          "It is calling something to its side...",
          "It is summoning something...",
        ],
        ko: [
          "주변 공기가 움푹 꺼지는 느낌이다...",
          "손끝 부근에서 무언가 꿈틀거린다...",
          "불길한 조짐이 방 안을 기어다닌다...",
          "무언가를 곁으로 불러들이고 있다...",
          "무언가를 불러내려 한다...",
        ],
      },
    },
  ],
  revealTurnsAhead: 1,
};

/**
 * 현재 진행 깊이에 맞는 조우 몬스터를 선택한다.
 *
 * @param depth 현재 진행 깊이
 * @returns 현재 깊이에서 사용할 몬스터 정의
 */
export function pickMonsterForDepth(depth: number, effectiveStats?: PlayerStats): MonsterDef {
  if (depth < 3) {
    return scaleMonsterForDepth(ASH_BOAR, depth);
  }

  const power = effectiveStats ? getEffectivePlayerPower(effectiveStats) : 0;
  const powerBucket = Math.max(0, Math.round(power * 10));
  const wraithChance = Math.min(
    0.82,
    (power >= 8 ? 0.6 : power >= 6 ? 0.45 : 0.3) + Math.max(0, depth - 3) * 0.06,
  );
  const encounterRoll = getEncounterSeed(depth, powerBucket);

  if (encounterRoll < wraithChance) {
    return scaleMonsterForDepth(HOLLOW_WRAITH, depth - 2);
  }

  return scaleMonsterForDepth(ASH_BOAR, depth);
}

/**
 * 몬스터 의도 목록에서 다음 행동을 무작위 선택한다.
 */
export function pickMonsterIntent(monster: MonsterDef): MonsterIntent {
  return monster.intents[Math.floor(Math.random() * monster.intents.length)];
}

/**
 * 현재 해독력에 맞는 단계의 몬스터 의도 텔레그래프를 반환한다.
 */
export function getMonsterIntentTelegraph(
  intent: MonsterIntent,
  decipher: number,
  language: "en" | "ko",
): string {
  const stageIndex = Math.max(0, Math.min(4, decipher - 1));
  return intent.telegraphs[language][stageIndex] ?? intent.label;
}
