// ── Element system ──────────────────────────────────────────
export type Element = "fire" | "water" | "earth" | "nature";

// fire → nature → earth → water → fire
const ELEMENT_ADVANTAGE: Record<Element, Element> = {
  fire: "nature",
  nature: "earth",
  earth: "water",
  water: "fire",
};

export function getElementMultiplier(
  attack: Element,
  defense: Element,
): number {
  if (ELEMENT_ADVANTAGE[attack] === defense) return 2;
  if (ELEMENT_ADVANTAGE[defense] === attack) return 0.5;
  return 1;
}

// ── Player stats ────────────────────────────────────────────
export interface PlayerStats {
  strength: number; // → maxHp, base attack dmg
  agility: number; // → base attack bonus, base shield bonus
  literacy: number; // → maxMana, spell tier unlock, spell success rate
}

export type LiteracyTier = 1 | 2 | 3;

export function getLiteracyTier(literacy: number): LiteracyTier {
  if (literacy >= 20) return 3;
  if (literacy >= 12) return 2;
  return 1;
}

export function getMaxHp(stats: PlayerStats): number {
  return 20 + stats.strength * 2;
}

export function getMaxMana(stats: PlayerStats): number {
  return 8 + stats.literacy * 3;
}

export function getBaseAttackDamage(stats: PlayerStats): number {
  return 3 + stats.strength + stats.agility;
}

export function getBaseShield(stats: PlayerStats): number {
  return 2 + Math.floor(stats.agility * 1.5);
}

export function getHealAmount(_stats: PlayerStats): number {
  return 5;
}

// ── Spells ──────────────────────────────────────────────────
export type SpellMode = "attack" | "defend";

export interface Spell {
  name: string;
  element: Element;
  tier: LiteracyTier;
  manaCost: number;
  modes: SpellMode[];
  baseDamage: number; // attack mode damage
  baseShield: number; // defend mode shield
  stunChance: number; // 0‑1
  healOnDefend: number; // nature spells heal when used defensively
  hint: string; // shown as typing hint
}

export const SPELLS: Spell[] = [
  // ── Fire (attack only) ──
  {
    name: "Flame",
    element: "fire",
    tier: 1,
    manaCost: 3,
    modes: ["attack"],
    baseDamage: 8,
    baseShield: 0,
    stunChance: 0,
    healOnDefend: 0,
    hint: "Fl___e",
  },
  {
    name: "Blaze",
    element: "fire",
    tier: 2,
    manaCost: 6,
    modes: ["attack"],
    baseDamage: 14,
    baseShield: 0,
    stunChance: 0,
    healOnDefend: 0,
    hint: "Bl__e",
  },
  {
    name: "Inferno",
    element: "fire",
    tier: 3,
    manaCost: 10,
    modes: ["attack"],
    baseDamage: 22,
    baseShield: 0,
    stunChance: 0,
    healOnDefend: 0,
    hint: "Inf___o",
  },

  // ── Water (attack + stun chance) ──
  {
    name: "Ripple",
    element: "water",
    tier: 1,
    manaCost: 3,
    modes: ["attack"],
    baseDamage: 6,
    baseShield: 0,
    stunChance: 0,
    healOnDefend: 0,
    hint: "Ri___e",
  },
  {
    name: "Torrent",
    element: "water",
    tier: 2,
    manaCost: 6,
    modes: ["attack"],
    baseDamage: 11,
    baseShield: 0,
    stunChance: 0.2,
    healOnDefend: 0,
    hint: "Tor___t",
  },
  {
    name: "Deluge",
    element: "water",
    tier: 3,
    manaCost: 10,
    modes: ["attack"],
    baseDamage: 18,
    baseShield: 0,
    stunChance: 0.5,
    healOnDefend: 0,
    hint: "Del__e",
  },

  // ── Earth (attack + defend) ──
  {
    name: "Stone",
    element: "earth",
    tier: 1,
    manaCost: 3,
    modes: ["attack", "defend"],
    baseDamage: 5,
    baseShield: 6,
    stunChance: 0,
    healOnDefend: 0,
    hint: "St__e",
  },
  {
    name: "Boulder",
    element: "earth",
    tier: 2,
    manaCost: 6,
    modes: ["attack", "defend"],
    baseDamage: 10,
    baseShield: 12,
    stunChance: 0,
    healOnDefend: 0,
    hint: "Bou___r",
  },
  {
    name: "Bastion",
    element: "earth",
    tier: 3,
    manaCost: 10,
    modes: ["attack", "defend"],
    baseDamage: 16,
    baseShield: 20,
    stunChance: 0,
    healOnDefend: 0,
    hint: "Bas___n",
  },

  // ── Nature (attack weak + defend/heal) ──
  {
    name: "Thorn",
    element: "nature",
    tier: 1,
    manaCost: 3,
    modes: ["attack", "defend"],
    baseDamage: 4,
    baseShield: 5,
    stunChance: 0,
    healOnDefend: 3,
    hint: "Th__n",
  },
  {
    name: "Verdure",
    element: "nature",
    tier: 2,
    manaCost: 6,
    modes: ["attack", "defend"],
    baseDamage: 7,
    baseShield: 10,
    stunChance: 0,
    healOnDefend: 6,
    hint: "Ver___e",
  },
  {
    name: "Sylvan",
    element: "nature",
    tier: 3,
    manaCost: 10,
    modes: ["attack", "defend"],
    baseDamage: 12,
    baseShield: 18,
    stunChance: 0,
    healOnDefend: 10,
    hint: "Syl__n",
  },
];

export function findSpell(input: string): Spell | null {
  const normalised = input.trim().toLowerCase();
  if (!normalised) return null;

  // exact match
  for (const spell of SPELLS) {
    if (spell.name.toLowerCase() === normalised) return spell;
  }

  // fuzzy: Levenshtein ≤ 2
  for (const spell of SPELLS) {
    if (levenshtein(spell.name.toLowerCase(), normalised) <= 2) return spell;
  }

  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Monster ─────────────────────────────────────────────────
export type MonsterIntentKind = "attack" | "defend" | "spell";

export interface MonsterIntent {
  kind: MonsterIntentKind;
  label: string; // narrative hint for the player
  damage: number; // 0 if defend
  element?: Element;
}

export interface MonsterDef {
  name: string;
  maxHp: number;
  element?: Element; // innate element (for weakness calculation)
  intents: MonsterIntent[];
  revealTurnsAhead: number; // how many turns ahead to show intent
}

export const HOLLOW_WRAITH: MonsterDef = {
  name: "Hollow Wraith",
  maxHp: 60,
  element: undefined, // no innate element
  intents: [
    { kind: "attack", label: "어둠의 발톱을 준비하는 듯 하다...", damage: 8 },
    { kind: "attack", label: "공격을 준비하는 듯 하다...", damage: 6 },
    { kind: "defend", label: "방어를 굳히는 것 같다...", damage: 0 },
    {
      kind: "spell",
      label: "불의 기운을 모으고 있다...",
      damage: 12,
      element: "fire",
    },
    { kind: "attack", label: "맹렬하게 돌진하려는 것 같다...", damage: 10 },
    { kind: "defend", label: "무언가 소환하려는 것 같다...", damage: 0 },
  ],
  revealTurnsAhead: 1,
};

export function pickMonsterIntent(monster: MonsterDef): MonsterIntent {
  return monster.intents[Math.floor(Math.random() * monster.intents.length)];
}

// ── Combat action types ─────────────────────────────────────
export type PlayerAction =
  | { type: "attack" }
  | { type: "defend" }
  | { type: "heal" }
  | { type: "spell"; spell: Spell; mode: SpellMode };

// ── Battle log ──────────────────────────────────────────────
export interface BattleLogEntry {
  text: string;
  color?: string; // tailwind text color class
}

// ── Default starting stats ──────────────────────────────────
export const DEFAULT_STATS: PlayerStats = {
  strength: 6,
  agility: 5,
  literacy: 8,
};
