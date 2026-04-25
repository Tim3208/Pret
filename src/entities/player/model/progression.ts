import {
  DEFAULT_STATS,
  getMaxHp,
  getMaxMana,
  type PlayerStats,
} from "./player";

export type PlayerStatKey = keyof PlayerStats;

export interface PlayerProgress {
  level: number;
  experience: number;
  nextLevelExperience: number;
  unspentStatPoints: number;
  baseStats: PlayerStats;
}

export interface ExperienceGainResult {
  progress: PlayerProgress;
  gainedExperience: number;
  leveledUp: boolean;
  levelsGained: number;
}

export const LEVEL_UP_STAT_POINT_GAIN = 2;
export const BONFIRE_HP_RECOVERY_RATIO = 0.45;
export const BONFIRE_MANA_RECOVERY_RATIO = 0.6;

const PLAYER_STAT_KEYS: readonly PlayerStatKey[] = [
  "strength",
  "agility",
  "decipher",
  "combination",
  "stability",
];

/**
 * 특정 레벨에서 다음 레벨까지 필요한 경험치를 계산한다.
 *
 * @param level 현재 레벨
 * @returns 다음 레벨업에 필요한 경험치
 */
export function getNextLevelExperience(level: number): number {
  return 10 + Math.max(0, level - 1) * 6;
}

/**
 * 새 실행에서 사용할 플레이어 진행 상태를 만든다.
 *
 * @returns 레벨, 경험치, 미사용 포인트가 초기화된 진행 상태
 */
export function createInitialPlayerProgress(): PlayerProgress {
  return {
    level: 1,
    experience: 0,
    nextLevelExperience: getNextLevelExperience(1),
    unspentStatPoints: 0,
    baseStats: { ...DEFAULT_STATS },
  };
}

/**
 * 진행 상태에 경험치를 더하고 레벨업 결과를 반영한다.
 *
 * @param progress 현재 진행 상태
 * @param amount 획득할 경험치
 * @returns 레벨업 여부와 갱신된 진행 상태
 */
export function grantPlayerExperience(
  progress: PlayerProgress,
  amount: number,
): ExperienceGainResult {
  let level = progress.level;
  let experience = progress.experience + Math.max(0, amount);
  let nextLevelExperience = progress.nextLevelExperience;
  let levelsGained = 0;

  while (experience >= nextLevelExperience) {
    experience -= nextLevelExperience;
    level += 1;
    levelsGained += 1;
    nextLevelExperience = getNextLevelExperience(level);
  }

  return {
    progress: {
      ...progress,
      level,
      experience,
      nextLevelExperience,
      unspentStatPoints:
        progress.unspentStatPoints + levelsGained * LEVEL_UP_STAT_POINT_GAIN,
    },
    gainedExperience: Math.max(0, amount),
    leveledUp: levelsGained > 0,
    levelsGained,
  };
}

/**
 * 미사용 스탯 포인트 하나를 원하는 능력치에 적용한다.
 *
 * @param progress 현재 진행 상태
 * @param statKey 포인트를 적용할 능력치 키
 * @returns 스탯 반영 여부와 갱신된 진행 상태
 */
export function spendPlayerStatPoint(
  progress: PlayerProgress,
  statKey: PlayerStatKey,
): PlayerProgress {
  if (progress.unspentStatPoints <= 0 || !PLAYER_STAT_KEYS.includes(statKey)) {
    return progress;
  }

  return {
    ...progress,
    unspentStatPoints: progress.unspentStatPoints - 1,
    baseStats: {
      ...progress.baseStats,
      [statKey]: progress.baseStats[statKey] + 1,
    },
  };
}

/**
 * 스탯 기준의 현재 최대 체력과 마나를 계산한다.
 *
 * @param stats 현재 기본 스탯
 * @returns 최대 체력과 최대 마나
 */
export function getPlayerBaseResources(stats: PlayerStats): {
  hp: number;
  mana: number;
} {
  return {
    hp: getMaxHp(stats),
    mana: getMaxMana(stats),
  };
}

/**
 * 현재 자원을 최대치 범위 안으로 보정한다.
 *
 * @param current 현재 값
 * @param maxValue 현재 최대치
 * @returns 범위를 벗어나지 않는 자원 값
 */
export function clampPlayerResource(current: number, maxValue: number): number {
  return Math.max(0, Math.min(current, maxValue));
}

/**
 * 모닥불에서 회복할 자원 값을 계산한다.
 *
 * @param current 현재 자원 값
 * @param maxValue 현재 최대치
 * @param ratio 최대치 대비 회복 비율
 * @param minimum 최소 회복량
 * @returns 모닥불 회복 후 자원 값
 */
export function recoverPlayerResourceAtBonfire(
  current: number,
  maxValue: number,
  ratio: number,
  minimum: number,
): number {
  const amount = Math.max(minimum, Math.round(maxValue * ratio));
  return clampPlayerResource(current + amount, maxValue);
}