export const BATTLE_LOG_TEXT = {
  en: {
    potionUse: "The crimson flask bursts over you... +{healAmount} HP",
    attackMiss: "Strike misses {targetName}!",
    attackShieldHit: "Strike! {shieldAbsorb} absorbed, {hpDamage} damage!",
    attackShieldCriticalHit:
      "Critical strike! {shieldAbsorb} absorbed, {hpDamage} damage!",
    attackHit: "Strike! {damage} damage!",
    attackCriticalHit: "Critical strike! {damage} damage!",
    attackSelfHit: "You strike yourself for {damage} damage!",
    attackSelfCriticalHit:
      "Critical strike! You hit yourself for {damage} damage!",
    defend: "Brace! Shield +{shield}!",
    heal: "Steady breath... +{heal} HP.",
    spellNeedLiteracy: "Not enough literacy... (need tier {tier})",
    spellNeedMana: "Not enough mana! (need {manaCost})",
    spellMiss: "{spellName} misses {targetName}! (MP -{manaCost})",
    spellHit: "{spellName}! {damage} damage! (MP -{manaCost})",
    spellCriticalHit:
      "Critical {spellName}! {damage} damage! (MP -{manaCost})",
    spellSelfHit:
      "{spellName} hits yourself for {damage} damage. (MP -{manaCost})",
    spellSelfCriticalHit:
      "Critical {spellName}! You take {damage} damage. (MP -{manaCost})",
    spellWard: "{spellName} ward! Shield +{shield}! (MP -{manaCost})",
    spellDefendHeal: "Nature mends your wounds... +{heal} HP",
    monsterStunned: "{monsterName} is stunned and cannot act!",
    monsterDefend: "{monsterName} hardens its guard! (Shield {shield})",
    monsterHitThroughShield:
      "{intentLabel} - {absorbed} blocked, {hpDamage} damage!",
    monsterHitBlocked: "{intentLabel} - fully blocked by shield!",
    monsterHit: "{intentLabel} - {damage} damage!",
    victoryLog: "{monsterName} has been slain!",
    victoryBanner: "{monsterName} has been slain.",
    defeatLog: "You collapse beneath the wraith's assault.",
  },
  ko: {
    potionUse: "진홍 물약이 몸 위에서 터진다... HP +{healAmount}",
    attackMiss: "일격이 {targetName}에게 빗나갔다!",
    attackShieldHit:
      "일격! 방어막이 {shieldAbsorb} 막아내고 {hpDamage} 피해를 입혔다!",
    attackShieldCriticalHit:
      "치명타! 방어막이 {shieldAbsorb} 막아내고 {hpDamage} 피해를 입혔다!",
    attackHit: "일격! {damage} 피해!",
    attackCriticalHit: "치명타! {damage} 피해!",
    attackSelfHit: "당신 자신을 공격해 {damage} 피해를 입었다!",
    attackSelfCriticalHit: "치명타! 당신 자신에게 {damage} 피해를 입혔다!",
    defend: "방어 태세! 방어막 +{shield}!",
    heal: "호흡을 가다듬는다... HP +{heal}.",
    spellNeedLiteracy: "문해력이 부족하다... (필요 티어 {tier})",
    spellNeedMana: "마나가 부족하다! ({manaCost} 필요)",
    spellMiss: "{spellName}이(가) {targetName}에게 빗나갔다! (MP -{manaCost})",
    spellHit: "{spellName}! {damage} 피해! (MP -{manaCost})",
    spellCriticalHit: "치명적인 {spellName}! {damage} 피해! (MP -{manaCost})",
    spellSelfHit:
      "{spellName}이(가) 당신 자신에게 {damage} 피해를 주었다. (MP -{manaCost})",
    spellSelfCriticalHit:
      "치명적인 {spellName}! 당신이 {damage} 피해를 입었다. (MP -{manaCost})",
    spellWard: "{spellName} 수호! 방어막 +{shield}! (MP -{manaCost})",
    spellDefendHeal: "자연의 힘이 상처를 메운다... HP +{heal}",
    monsterStunned: "{monsterName}은(는) 기절해 움직이지 못한다!",
    monsterDefend:
      "{monsterName}이(가) 몸을 굳히며 방어한다! (방어막 {shield})",
    monsterHitThroughShield:
      "{intentLabel} - {absorbed} 막아내고 {hpDamage} 피해!",
    monsterHitBlocked: "{intentLabel} - 방어막이 완전히 막아냈다!",
    monsterHit: "{intentLabel} - {damage} 피해!",
    victoryLog: "{monsterName}을(를) 쓰러뜨렸다!",
    victoryBanner: "{monsterName}을(를) 쓰러뜨렸다.",
    defeatLog: "망령의 맹공에 무너졌다.",
  },
} as const;
