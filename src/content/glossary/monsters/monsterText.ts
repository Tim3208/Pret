export const CROWNED_HOLLOW_WRAITH_TEXT = {
  name: {
    en: "Crowned Hollow Wraith",
    ko: "왕관을 쓴 공허의 망령",
  },
  intents: {
    blade: {
      label: {
        en: "raising a cinder blade...",
        ko: "잿불 검을 치켜든다...",
      },
      telegraphs: {
        en: [
          "A crimson ember stirs along its arm...",
          "The ember lengthens into a sharp outline...",
          "A blade of cinders is taking shape...",
          "It is lifting a burning sword...",
          "It is raising a cinder blade...",
        ],
        ko: [
          "팔을 따라 붉은 불씨가 꿈틀거린다...",
          "불씨가 날카로운 윤곽으로 길어진다...",
          "재로 된 검날이 모습을 갖춘다...",
          "불타는 검을 끌어올리고 있다...",
          "잿불 검을 치켜든다...",
        ],
      },
    },
    charge: {
      label: {
        en: "crossing the ash in one stride...",
        ko: "재를 가르며 단숨에 파고든다...",
      },
      telegraphs: {
        en: [
          "Its crown tilts toward your heartbeat...",
          "Ash gathers beneath its trailing form...",
          "The distance between you starts to collapse...",
          "It is coiling for a sudden rush...",
          "It is crossing the ash in one stride...",
        ],
        ko: [
          "왕관이 당신의 심장 쪽으로 기울어진다...",
          "흐릿한 발치로 재가 모여든다...",
          "둘 사이의 거리가 무너져 내리는 듯하다...",
          "순간적인 돌진을 위해 몸을 웅크린다...",
          "재를 가르며 단숨에 파고든다...",
        ],
      },
    },
    fire: {
      label: {
        en: "binding a funeral flame...",
        ko: "장송의 불꽃을 묶어낸다...",
      },
      telegraphs: {
        en: [
          "Cold sparks orbit its ruined crown...",
          "The sparks sink into a black-red knot...",
          "The knot pulses like a buried furnace...",
          "It is weaving a funeral spell...",
          "It is binding a funeral flame...",
        ],
        ko: [
          "차가운 불티가 부서진 왕관 주위를 돈다...",
          "불티가 검붉은 매듭으로 가라앉는다...",
          "매듭이 묻힌 화로처럼 맥동한다...",
          "장송의 주문을 엮어내고 있다...",
          "장송의 불꽃을 묶어낸다...",
        ],
      },
    },
    defend: {
      label: {
        en: "folding the crown into a ward...",
        ko: "왕관을 부적으로 접어 세운다...",
      },
      telegraphs: {
        en: [
          "Its crown sheds a ring of dim ash...",
          "The ash turns in a tight, silent orbit...",
          "A thin barrier gathers around its ribs...",
          "It is drawing a ward close to its body...",
          "It is folding the crown into a ward...",
        ],
        ko: [
          "왕관에서 희미한 재의 고리가 흩어진다...",
          "재가 소리 없이 바짝 회전한다...",
          "갈비뼈 주변으로 얇은 장벽이 모여든다...",
          "몸 가까이 부적을 끌어들이고 있다...",
          "왕관을 부적으로 접어 세운다...",
        ],
      },
    },
  },
} as const;

export const MONSTER_NAME_TEXT = {
  "Ash Boar": {
    en: "Ash Boar",
    ko: "재빛 멧돼지",
  },
  "Hollow Wraith": {
    en: "Hollow Wraith",
    ko: "공허의 망령",
  },
  [CROWNED_HOLLOW_WRAITH_TEXT.name.en]: CROWNED_HOLLOW_WRAITH_TEXT.name,
} as const;

export const MONSTER_INTENT_LABEL_TEXT = {
  "snorting and charging...": {
    en: "snorting and charging...",
    ko: "코를 울리며 들이받을 기세다...",
  },
  "pawing the dirt...": {
    en: "pawing the dirt...",
    ko: "앞발로 흙을 긁어댄다...",
  },
  "chewing on bitter roots...": {
    en: "chewing on bitter roots...",
    ko: "쓴 뿌리를 질겅거린다...",
  },
  "drawing a sword...": {
    en: "drawing a sword...",
    ko: "검을 끌어올린다...",
  },
  "preparing an attack...": {
    en: "preparing an attack...",
    ko: "공격 태세를 가다듬는다...",
  },
  "bracing for defense...": {
    en: "bracing for defense...",
    ko: "방어 태세를 굳힌다...",
  },
  "gathering the power of fire...": {
    en: "gathering the power of fire...",
    ko: "화염의 힘을 끌어모은다...",
  },
  "charging fiercely...": {
    en: "charging fiercely...",
    ko: "사납게 돌진할 기세다...",
  },
  "summoning something...": {
    en: "summoning something...",
    ko: "무언가를 불러내려 한다...",
  },
  [CROWNED_HOLLOW_WRAITH_TEXT.intents.blade.label.en]:
    CROWNED_HOLLOW_WRAITH_TEXT.intents.blade.label,
  [CROWNED_HOLLOW_WRAITH_TEXT.intents.charge.label.en]:
    CROWNED_HOLLOW_WRAITH_TEXT.intents.charge.label,
  [CROWNED_HOLLOW_WRAITH_TEXT.intents.fire.label.en]:
    CROWNED_HOLLOW_WRAITH_TEXT.intents.fire.label,
  [CROWNED_HOLLOW_WRAITH_TEXT.intents.defend.label.en]:
    CROWNED_HOLLOW_WRAITH_TEXT.intents.defend.label,
} as const;

export const MONSTER_ENCOUNTER_TEXT = {
  "Ash Boar": {
    en:
      "A squat boar lumbers out of the brush, ash clinging to its hide. It snorts, digs at the soil, " +
      "and glares at you with the vacant anger of a creature that only knows hunger.",
    ko:
      "재가 들러붙은 멧돼지 한 마리가 덤불 사이에서 불쑥 튀어나온다. 놈은 코를 울리고 흙을 긁어대며, " +
      "배고픔밖에 모르는 짐승다운 텅 빈 분노로 당신을 노려본다.",
  },
  "Hollow Wraith": {
    en:
      "A twisted figure emerges from the shadows, its body a mass of writhing dark tendrils, " +
      "two pale eyes burning with cold malice. The Hollow Wraith lets out a guttural screech " +
      "that rattles your bones. The air thickens, and the temperature drops.",
    ko:
      "비틀린 형상이 그림자 속에서 모습을 드러낸다. 뒤엉킨 검은 촉수로 이루어진 육체와, " +
      "차가운 악의로 타오르는 창백한 두 눈이 어둠을 가른다. 공허의 망령이 뼈를 울리는 듯한 " +
      "거친 비명을 지르자 공기가 무거워지고 온도가 뚝 떨어진다.",
  },
  [CROWNED_HOLLOW_WRAITH_TEXT.name.en]: {
    en:
      "The hollow closes around a throne made from soot and broken steel. Upon it waits a wraith " +
      "wearing a crown of dead embers. When it rises, every old fire on the path seems to draw breath.",
    ko:
      "그을음과 부서진 강철로 만든 왕좌가 허공을 막아선다. 그 위에는 죽은 불씨의 왕관을 쓴 망령이 " +
      "기다린다. 놈이 일어서자 길 위의 모든 오래된 불씨가 한 번에 숨을 들이켜는 듯하다.",
  },
} as const;

export const MONSTER_AMBIENT_LINE_TEXT = {
  "Ash Boar": {
    en: [
      "The boar's hooves scrape over cinders.",
      "A hot breath steams from its snout.",
      "It snorts and shakes soot from its mane.",
      "Clumps of dirt scatter beneath its feet.",
      "The boar eyes you with dull hostility.",
      "Burnt roots crack under its weight.",
    ],
    ko: [
      "멧돼지의 발굽이 재 위를 긁어댄다.",
      "놈의 콧김이 뜨겁게 새어 나온다.",
      "코를 울리며 갈기에서 그을음을 턴다.",
      "앞발 아래에서 흙덩이가 튄다.",
      "멧돼지는 둔한 적의만을 품고 당신을 본다.",
      "불에 그을린 뿌리가 발밑에서 우지끈거린다.",
    ],
  },
  "Hollow Wraith": {
    en: [
      "Shadows coil around the wraith's tendrils.",
      "The air tastes of iron and decay.",
      "Wind howls through the hollow.",
      "Frost creeps along the stone floor.",
      "The wraith's eyes pulse with faint hunger.",
      "A low hum resonates from the darkness.",
      "Your breath fogs in the cold air.",
      "Embers drift through the stale dark.",
      "The silence presses like a weight.",
      "Something stirs in the deeper shadows.",
    ],
    ko: [
      "그림자가 망령의 촉수 주위를 소용돌이친다.",
      "공기에서 쇠와 부패의 맛이 난다.",
      "허공을 가르는 바람 소리가 스민다.",
      "차가운 서리가 돌바닥을 타고 번진다.",
      "망령의 눈빛이 희미한 굶주림으로 맥동한다.",
      "어둠 깊은 곳에서 낮은 울림이 퍼진다.",
      "차가운 공기 속에 입김이 하얗게 흩어진다.",
      "희미한 불씨가 눅눅한 어둠 사이를 떠돈다.",
      "침묵이 무게처럼 짓눌러 온다.",
      "더 깊은 그림자 속에서 무언가 꿈틀댄다.",
    ],
  },
  [CROWNED_HOLLOW_WRAITH_TEXT.name.en]: {
    en: [
      "Dead embers circle the wraith's crown.",
      "The throne of soot creaks without moving.",
      "Each breath tastes like a fire long extinguished.",
      "Ash rises against the pull of gravity.",
      "The crown watches from behind empty eyes.",
    ],
    ko: [
      "죽은 불씨가 망령의 왕관 주위를 돈다.",
      "그을음 왕좌가 움직이지 않은 채 삐걱거린다.",
      "숨을 들이쉴 때마다 오래전에 꺼진 불의 맛이 난다.",
      "재가 중력을 거슬러 피어오른다.",
      "텅 빈 눈 너머에서 왕관이 당신을 지켜본다.",
    ],
  },
} as const;
