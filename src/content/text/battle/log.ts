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
    spellNeedStability: "Not enough stability... (need tier {tier})",
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
    promptFailure:
      "The phrase ruptures and lashes back... HP -{hpCost}, MP -{manaCost}",
    promptBacklash:
      "Backlash bites into you... HP -{hpCost}, MP -{manaCost}",
    promptMiss: "{actionWord} slips through the dark.",
    promptMissShield:
      "The phrase misses, but its residue hardens into shield +{shield}.",
    promptHit: "{actionWord} lands! {damage} damage!",
    promptCriticalHit: "{actionWord} lands critically! {damage} damage!",
    promptShieldHit:
      "{actionWord} lands! {shieldAbsorb} absorbed, {hpDamage} damage!",
    promptShieldCriticalHit:
      "{actionWord} lands critically! {shieldAbsorb} absorbed, {hpDamage} damage!",
    promptShieldGainOnHit:
      "The phrase knits itself closed into shield +{shield}.",
    promptShieldOnly: "The phrase coils around you. Shield +{shield}.",
    monsterStunned: "{monsterName} is stunned and cannot act!",
    monsterDefend: "{monsterName} hardens its guard! (Shield {shield})",
    monsterHeal: "{intentLabel} - {monsterName} recovers {heal} HP!",
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
    spellNeedStability: "안정성이 부족하다... (필요 티어 {tier})",
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
    promptFailure:
      "문장이 폭주하며 당신을 되문다... HP -{hpCost}, MP -{manaCost}",
    promptBacklash:
      "반동이 몸을 파고든다... HP -{hpCost}, MP -{manaCost}",
    promptMiss: "{actionWord} 구문이 허공을 가른다.",
    promptMissShield:
      "문장은 빗나갔지만 잔문이 응고된다... 방어막 +{shield}",
    promptHit: "{actionWord} 구문이 적중한다! {damage} 피해!",
    promptCriticalHit:
      "{actionWord} 구문이 치명적으로 파고든다! {damage} 피해!",
    promptShieldHit:
      "{actionWord} 구문이 적중한다! {shieldAbsorb} 막히고 {hpDamage} 피해!",
    promptShieldCriticalHit:
      "{actionWord} 구문이 치명적으로 파고든다! {shieldAbsorb} 막히고 {hpDamage} 피해!",
    promptShieldGainOnHit: "구문이 재정렬되며 방어막 +{shield}",
    promptShieldOnly: "문장이 몸 둘레에 감기며 방어막 +{shield}",
    monsterStunned: "{monsterName}은(는) 기절해 움직이지 못한다!",
    monsterDefend:
      "{monsterName}이(가) 몸을 굳히며 방어한다! (방어막 {shield})",
    monsterHeal: "{intentLabel} - {monsterName}이(가) HP를 {heal} 회복했다!",
    monsterHitThroughShield:
      "{intentLabel} - {absorbed} 막아내고 {hpDamage} 피해!",
    monsterHitBlocked: "{intentLabel} - 방어막이 완전히 막아냈다!",
    monsterHit: "{intentLabel} - {damage} 피해!",
    victoryLog: "{monsterName}을(를) 쓰러뜨렸다!",
    victoryBanner: "{monsterName}을(를) 쓰러뜨렸다.",
    defeatLog: "망령의 맹공에 무너졌다.",
  },
} as const;
