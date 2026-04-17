/**
 * 플레이어 능력치 묶음이다.
 */
export interface PlayerStats {
  strength: number;
  agility: number;
  literacy: number;
}

export type LiteracyTier = 1 | 2 | 3;

/**
 * 새 전투 시작 시 사용하는 기본 플레이어 능력치다.
 */
export const DEFAULT_STATS: PlayerStats = {
  strength: 6,
  agility: 5,
  literacy: 8,
};

/**
 * 문해력 수치로 해금된 주문 티어를 계산한다.
 */
export function getLiteracyTier(literacy: number): LiteracyTier {
  if (literacy >= 20) return 3;
  if (literacy >= 12) return 2;
  return 1;
}

/**
 * 현재 능력치 기준 최대 체력을 계산한다.
 */
export function getMaxHp(stats: PlayerStats): number {
  return 20 + stats.strength * 2;
}

/**
 * 현재 능력치 기준 최대 마나를 계산한다.
 */
export function getMaxMana(stats: PlayerStats): number {
  return 8 + stats.literacy * 3;
}

/**
 * 기본 물리 공격 피해량을 계산한다.
 */
export function getBaseAttackDamage(stats: PlayerStats): number {
  return 3 + stats.strength + stats.agility;
}

/**
 * 기본 방어 행동으로 얻는 방어막 수치를 계산한다.
 */
export function getBaseShield(stats: PlayerStats): number {
  return 2 + Math.floor(stats.agility * 1.5);
}

/**
 * 회복 행동의 기본 회복량을 반환한다.
 */
export function getHealAmount(stats?: PlayerStats): number {
  void stats;
  return 5;
}
