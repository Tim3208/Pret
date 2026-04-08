/**
 * 현재 게임이 지원하는 언어 코드 목록이다.
 */
export type Locale = "ko" | "en";

/**
 * 언어 설정을 브라우저에 저장할 때 사용할 키다.
 */
export const LOCALE_STORAGE_KEY = "pret.locale";

/**
 * 전환 버튼에 표시할 언어 옵션 목록이다.
 */
export const LOCALE_OPTIONS: ReadonlyArray<{
  code: Locale;
  label: string;
  shortLabel: string;
}> = [
  { code: "ko", label: "한국어", shortLabel: "KR" },
  { code: "en", label: "English", shortLabel: "EN" },
];

/**
 * 루트 장면에서 사용하는 문구 묶음이다.
 */
export interface AppCopy {
  storyText: string;
  inputPlaceholder: string;
  acceptedInputs: string[];
  fireReadyText: string;
  ventureForthLabel: string;
}

/**
 * 전투 장면에서 사용하는 문구 묶음이다.
 */
export interface BattleCopy {
  monsterName: string;
  encounterText: string;
  introHint: string;
  loadingCombatants: string;
  attackPlaceholderFallback: string;
  monsterAttackWords: string[];
  narratives: string[];
  retaliates: (monsterName: string) => string;
}

/**
 * 한 언어권에서 사용하는 전체 문구 묶음이다.
 */
export interface GameCopy {
  languageLabel: string;
  app: AppCopy;
  battle: BattleCopy;
}

/**
 * 언어별 문구 사전이다.
 */
export const TRANSLATIONS: Record<Locale, GameCopy> = {
  ko: {
    languageLabel: "언어",
    app: {
      storyText:
        "매서운 바람이 코트 자락을 파고들며 뼛속까지 식혀 온다. 눈앞에는 누군가 남기고 간 듯한 조잡한 화덕과 마른 장작 몇 토막이 놓여 있다. 어둠 너머에서는 늑대 울음소리가 점점 가까워지고, 불을 피우지 못하면 얼어 죽거나 짐승의 먹잇감이 될 게 분명하다. 모닥불을 피우겠는가?",
      inputPlaceholder: "(불 / 예)",
      acceptedInputs: [
        "불",
        "불켜",
        "불피워",
        "불피운다",
        "모닥불",
        "점화",
        "예",
        "응",
        "ㅇ",
        "y",
        "yes",
      ],
      fireReadyText:
        "모닥불이 살아나며 타닥거린다. 열기가 천천히 몸을 감싸기 시작한다...",
      ventureForthLabel: "[ 앞으로 나아간다 ]",
    },
    battle: {
      monsterName: "공허의 망령",
      encounterText:
        "그림자 틈에서 뒤틀린 형체가 모습을 드러낸다. 검은 촉수가 뒤엉킨 몸체 위로 창백한 두 눈이 차갑게 타오르고, 공허의 망령은 뼈를 울리는 듯한 비명을 토해 낸다. 공기가 무거워지고 온도는 순식간에 떨어진다.",
      introHint: "[ 클릭하여 전투 시작 ]",
      loadingCombatants: "전투 준비 중...",
      attackPlaceholderFallback: "공격할 단어 입력...",
      monsterAttackWords: ["참격", "저주", "암흑", "파열"],
      narratives: [
        "망령이 [돌진]하며 차가운 촉수를 [휘두른다]. 너는 틈을 찾기 위해 숨을 고른다.",
        "그림자가 괴물 주위를 휘감고, 망령은 텅 빈 [비명]을 질러 대지를 [균열]낸다.",
        "창백한 시선이 너를 꿰뚫는다. 흔들리는 [불꽃] 같은 형체가 네 [목]을 향해 뻗어 온다.",
        "짧은 정적 속에서 망령이 원을 그리며 움직인다. 깜빡이는 [약점]이 그 [핵] 깊숙이 드러난다.",
        "괴물이 분노에 찬 [울부짖음]과 함께 어둠을 밀어낸다. 서리가 네 발밑으로 [번진다].",
      ],
      retaliates: (monsterName) => `${monsterName}이 반격한다...`,
    },
  },
  en: {
    languageLabel: "LANG",
    app: {
      storyText:
        "A bitter wind cuts through your coat, chilling you to the bone. Before you lies a crude fire pit with a few dry logs left behind by a forgotten traveler. Wolves howl in the surrounding darkness, their cries echoing closer with every passing moment. Without fire you will surely freeze to death or become prey to the beasts. Will you light the bonfire?",
      inputPlaceholder: "(light / Y)",
      acceptedInputs: [
        "light",
        "ignite",
        "yes",
        "y",
        "bonfire",
        "lightfire",
        "lightthefire",
        "lightthebonfire",
      ],
      fireReadyText:
        "The bonfire crackles to life, its warmth wrapping around you...",
      ventureForthLabel: "[ venture forth ]",
    },
    battle: {
      monsterName: "Hollow Wraith",
      encounterText:
        "A twisted figure emerges from the shadows, its body a mass of writhing dark tendrils, two pale eyes burning with cold malice. The Hollow Wraith lets out a guttural screech that rattles your bones. The air thickens, and the temperature drops.",
      introHint: "[ click to fight ]",
      loadingCombatants: "Loading combatants...",
      attackPlaceholderFallback: "type to attack...",
      monsterAttackWords: ["CLAW", "BITE", "HEX", "DARK"],
      narratives: [
        "The wraith [lunges] forward, dark tendrils [slashing] through the frigid air. You grip your weapon tightly, searching for an opening.",
        "Shadows coil around the creature as it lets out a hollow [scream]. The ground beneath you [cracks] with unholy energy.",
        "The wraith's pale eyes fixate on you. Its form flickers like a dying [flame], tendrils reaching toward your [throat].",
        "A moment of stillness. The wraith circles you, its movements unnaturally fluid. You see a [weakness] in its flickering [core].",
        "The creature [howls] in fury, summoning a wave of darkness. Frost [spreads] across the ground toward your feet.",
      ],
      retaliates: (monsterName) => `The ${monsterName} retaliates...`,
    },
  },
};

/**
 * 브라우저 언어 설정을 기준으로 기본 언어를 추론한다.
 */
function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") {
    return "ko";
  }

  return navigator.language.toLowerCase().startsWith("ko") ? "ko" : "en";
}

/**
 * 문자열이 지원하는 언어 코드인지 판별한다.
 *
 * @param value 검사할 값
 */
function isLocale(value: string | null): value is Locale {
  return value === "ko" || value === "en";
}

/**
 * 앱 최초 진입 시 사용할 언어를 결정한다.
 */
export function getInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "ko";
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(storedLocale) ? storedLocale : detectBrowserLocale();
}
