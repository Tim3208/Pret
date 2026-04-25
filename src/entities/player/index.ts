export {
  DEFAULT_STATS,
  getBaseAttackDamage,
  getBaseShield,
  getHealAmount,
  getStabilityTier,
  getMaxHp,
  getMaxMana,
} from "./model/player";
  export {
  BONFIRE_HP_RECOVERY_RATIO,
  BONFIRE_MANA_RECOVERY_RATIO,
  LEVEL_UP_STAT_POINT_GAIN,
  clampPlayerResource,
  createInitialPlayerProgress,
  getNextLevelExperience,
  getPlayerBaseResources,
  grantPlayerExperience,
  recoverPlayerResourceAtBonfire,
  spendPlayerStatPoint,
} from "./model/progression";
export type { PlayerStats, StabilityTier } from "./model/player";
export type { ExperienceGainResult, PlayerProgress, PlayerStatKey } from "./model/progression";
