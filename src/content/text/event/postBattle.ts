export const POST_BATTLE_INVESTIGATE_KEYWORDS = [
  "investigate",
  "inspect",
  "approach",
  "continue",
  "yes",
  "y",
  "look",
  "살핀다",
  "조사",
  "다가간다",
  "예",
  "응",
  "진행",
] as const;

export const POST_BATTLE_LEAVE_KEYWORDS = [
  "leave",
  "pass",
  "skip",
  "no",
  "n",
  "walk away",
  "떠난다",
  "지나친다",
  "거절",
  "아니오",
  "아니",
  "넘긴다",
] as const;

export const POST_BATTLE_TAKE_KEYWORDS = [
  "take",
  "keep",
  "equip",
  "bind",
  "yes",
  "y",
  "가져간다",
  "줍는다",
  "장착",
  "결속",
  "예",
  "응",
] as const;

export const POST_BATTLE_ACCEPT_KEYWORDS = [
  "accept",
  "touch",
  "risk",
  "yes",
  "y",
  "받는다",
  "감수",
  "수락",
  "손을 댄다",
  "예",
  "응",
] as const;

export const POST_BATTLE_EXPERIENCE_KEYWORDS = [
  "experience",
  "xp",
  "memory",
  "ash",
  "경험치",
  "기억",
  "재",
] as const;

export const POST_BATTLE_POTION_KEYWORDS = [
  "potion",
  "flask",
  "bottle",
  "heal",
  "물약",
  "플라스크",
  "병",
  "회복",
] as const;

export const POST_BATTLE_EVENT_TEXT = {
  equipmentApproachLead: {
    en: "At the cliff's lip, just beyond the bonfire path, something catches in the cinders and shale.",
    ko: "모닥불로 돌아가는 길목의 절벽 끝, 재와 혈암 사이에서 무언가 희미하게 걸린다.",
  },
  equipmentApproachDetail: {
    en: "It looks like a half-buried helm, faintly warm, as though it has been waiting for the next survivor to notice it.",
    ko: "반쯤 묻힌 투구처럼 보인다. 방금까지 누군가 기다리고 있던 것처럼 희미한 온기가 남아 있다.",
  },
  approachQuestion: {
    en: "Will you draw closer?",
    ko: "가까이 다가가겠는가?",
  },
  equipmentOfferLead: {
    en: "You brush the ash aside. A dark half-dome helm rises from the embers, catching the firelight along its curve.",
    ko: "재를 걷어내자 어두운 반구형 투구가 불씨 사이에서 모습을 드러낸다. 둥근 곡면을 따라 불빛이 번진다.",
  },
  equipmentOfferQuestion: {
    en: "Will you take it with you?",
    ko: "이것을 가져가겠는가?",
  },
  equipmentOfferReplaceQuestion: {
    en: "It will replace what already rests on that part of you. Will you take it anyway?",
    ko: "이미 그 자리에 있는 것을 밀어내게 된다. 그래도 가져가겠는가?",
  },
  potionApproachLead: {
    en: "A squat glass flask glints between the shale teeth, cork still sealed with pitch.",
    ko: "혈암 틈 사이에서 낮은 유리 플라스크 하나가 반짝인다. 코르크는 아직 타르로 밀봉돼 있다.",
  },
  potionApproachDetail: {
    en: "Whoever hid it expected to come back alive. The red liquid inside has not spoiled.",
    ko: "이걸 숨긴 자는 살아 돌아올 생각이었던 듯하다. 안의 붉은 액체는 아직 상하지 않았다.",
  },
  potionOfferLead: {
    en: "You pry it loose. The flask rocks warmly in your palm, heavier than it first appeared.",
    ko: "조심스레 들어 올리자 플라스크가 손바닥 안에서 묵직하게 기운다. 보기보다 오래 버틴 물건이다.",
  },
  potionOfferQuestion: {
    en: "Will you keep the flask for the next fight?",
    ko: "다음 전투를 위해 이 플라스크를 챙기겠는가?",
  },
  experienceApproachLead: {
    en: "Ash circles a cracked stone, refusing to scatter even when the wind tugs at it.",
    ko: "갈라진 돌 하나를 감싼 재가 바람이 끌어당겨도 흩어지지 않는다.",
  },
  experienceApproachDetail: {
    en: "The mark beneath it feels unfinished, as though someone else's memory stalled halfway through becoming yours.",
    ko: "그 아래의 흔적은 미완성처럼 남아 있다. 누군가의 기억이 당신 쪽으로 건너오다 멈춘 것만 같다.",
  },
  experienceOfferLead: {
    en: "You press the stone. Cold recollection floods your teeth and gums before settling behind the eyes.",
    ko: "돌에 손을 얹자 차가운 잔향이 이와 잇몸을 타고 올라온 뒤 눈 뒤쪽에 가라앉는다.",
  },
  experienceOfferQuestion: {
    en: "Will you take in {experience} XP from the ash-memory?",
    ko: "재의 기억에서 경험치 {experience}를 받아들이겠는가?",
  },
  choiceApproachLead: {
    en: "Two relics lie half-exposed in the same soot bed: a red flask and a slate etched with names.",
    ko: "같은 재더미 속에서 두 물건이 반쯤 드러난다. 붉은 플라스크 하나와 이름이 빼곡한 석판 하나다.",
  },
  choiceApproachDetail: {
    en: "The ash around them feels tight, as if only one of them is meant to leave with you.",
    ko: "둘레의 재가 팽팽하게 당겨져 있다. 둘 중 하나만 당신과 함께 움직일 수 있을 것 같다.",
  },
  choiceOfferLead: {
    en: "You kneel between the two finds. One promises a steadier pulse, the other a sharper memory.",
    ko: "둘 사이에 무릎을 꿇자, 하나는 맥박을, 다른 하나는 기억을 당긴다.",
  },
  choiceOfferQuestion: {
    en: "Which will you keep: {experience} XP or +{potions} potion charge?",
    ko: "어느 쪽을 가져가겠는가: 경험치 {experience} 또는 물약 충전 {potions}?",
  },
  scarApproachLead: {
    en: "A charcoal idol waits by the path, its face rubbed smooth where desperate hands once lingered.",
    ko: "길목 옆 숯빛 우상이 놓여 있다. 다급한 손이 몇 번이고 문지른 듯 얼굴이 닳아 있다.",
  },
  scarApproachDetail: {
    en: "Its surface hums against your teeth. Whatever it gives, it will keep a measure of your body.",
    ko: "표면에서 울림이 올라와 이가 먼저 반응한다. 무엇을 주든, 반드시 몸의 일부를 떼어갈 물건이다.",
  },
  scarOfferLead: {
    en: "The idol warms the air around your hand. The promise in it is immediate, and so is the cost.",
    ko: "우상은 손을 대기도 전에 주변 공기를 덥힌다. 약속도 즉각적이고 대가도 즉각적이다.",
  },
  scarOfferQuestion: {
    en: "Will you accept +{experience} XP in exchange for -{maxHpPenalty} Max HP until the bonfire?",
    ko: "모닥불까지 최대 HP -{maxHpPenalty}를 대가로 경험치 +{experience}를 받겠는가?",
  },
  ambushApproachLead: {
    en: "A corpse sags beneath a broken lintel, one hand still wrapped around a sealed flask.",
    ko: "무너진 문설주 밑에 시신 하나가 기대어 있고, 한 손은 아직도 밀봉된 플라스크를 쥐고 있다.",
  },
  ambushApproachDetail: {
    en: "The dark around it feels awake. Touching the flask will be heard by something nearby.",
    ko: "그 주변의 어둠은 아직 깨어 있는 느낌이다. 플라스크에 손대는 순간 무언가가 알아챌 것이다.",
  },
  ambushOfferLead: {
    en: "The corpse gives up the flask easily. The silence around it does not.",
    ko: "시신은 플라스크를 쉽게 내놓지만, 그 주변의 침묵은 그렇지 않다.",
  },
  ambushOfferQuestion: {
    en: "Will you snatch the flask and risk {damage} damage from the dark?",
    ko: "어둠에게 피해 {damage}를 감수하고 플라스크를 낚아채겠는가?",
  },
  currentSlotLabel: {
    en: "Currently worn",
    ko: "현재 장착 중",
  },
  itemHoverLabel: {
    en: "hover the helm to read its effect",
    ko: "효과를 보려면 투구에 마우스를 올린다",
  },
  inactiveLabel: {
    en: "Tooltip only for now. Combat values stay unchanged in this build.",
    ko: "지금은 툴팁 전용이다. 이 빌드에서는 전투 수치가 바뀌지 않는다.",
  },
  invalidApproach: {
    en: "The ash waits for a clearer answer.",
    ko: "재가 더 또렷한 대답을 기다린다.",
  },
  invalidOffer: {
    en: "The find keeps waiting. Choose clearly or walk away.",
    ko: "발견물은 여전히 기다린다. 분명히 고르거나 지나쳐라.",
  },
  approachPlaceholder: {
    en: "(investigate / leave)",
    ko: "(살핀다 / 떠난다)",
  },
  offerPlaceholder: {
    en: "(take / leave)",
    ko: "(가져간다 / 남긴다)",
  },
  choicePlaceholder: {
    en: "(experience / potion / leave)",
    ko: "(경험치 / 물약 / 떠난다)",
  },
  acceptPlaceholder: {
    en: "(accept / leave)",
    ko: "(받는다 / 떠난다)",
  },
  effectLabel: {
    en: "effect:",
    ko: "효과:",
  },
  choiceExperienceLabel: {
    en: "experience",
    ko: "경험치",
  },
  choicePotionLabel: {
    en: "potion",
    ko: "물약",
  },
  riskHelperLabel: {
    en: "accept the cost or leave it untouched",
    ko: "대가를 받거나 건드리지 않고 떠난다",
  },
  leaveLine: {
    en: "You leave the ash undisturbed and move toward the next threshold.",
    ko: "재를 건드리지 않은 채 다음 경계로 발을 옮긴다.",
  },
  equipLine: {
    en: "{itemName} settles into place.",
    ko: "{itemName}을(를) 장착했다.",
  },
  experienceGainLine: {
    en: "Ash-memory grants +{experience} XP.",
    ko: "재의 기억에서 경험치 +{experience}.",
  },
  potionGainLine: {
    en: "Recovered flask adds +{potions} potion charge.",
    ko: "회수한 플라스크로 물약 충전 +{potions}.",
  },
  choiceExperienceGainLine: {
    en: "You claim the slate and gain +{experience} XP.",
    ko: "석판을 택해 경험치 +{experience}를 얻었다.",
  },
  choicePotionGainLine: {
    en: "You pocket the flask and gain +{potions} potion charge.",
    ko: "플라스크를 챙겨 물약 충전 +{potions}을 얻었다.",
  },
  scarGainLine: {
    en: "The idol brands you: +{experience} XP, Max HP -{maxHpPenalty} until the bonfire.",
    ko: "우상이 낙인을 남긴다. 경험치 +{experience}, 모닥불까지 최대 HP -{maxHpPenalty}.",
  },
  ambushGainLine: {
    en: "Something lashes from the dark: potion +{potions}, HP -{damage}.",
    ko: "어둠에서 무언가가 할퀴고 지나간다. 물약 충전 +{potions}, HP -{damage}.",
  },
} as const;
