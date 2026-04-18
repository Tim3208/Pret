interface PromptJudgementContext {
  language: "en" | "ko";
  decipher: number;
  combination: number;
  stability: number;
  outcome: "stable" | "risky" | "failure";
  failureReason:
    | "empty"
    | "unknown-token"
    | "invalid-order"
    | "dangling-connector"
    | "dangling-rune"
    | "too-many-actions"
    | "rune-needs-attack"
    | "stability-overload"
    | null;
  combinationLoad: number;
  stabilityCost: number;
  combinationAdequate: boolean;
  selfHpCost: number;
  selfManaCost: number;
}

export interface PromptJudgementCopy {
  title: string;
  detail: string;
}

/**
 * word prompt 판정 결과를 플레이어가 읽는 서술형 문구로 변환한다.
 */
export function getPromptJudgementCopy({
  language,
  decipher,
  combination,
  stability,
  outcome,
  failureReason,
  combinationLoad,
  stabilityCost,
  combinationAdequate,
  selfHpCost,
  selfManaCost,
}: PromptJudgementContext): PromptJudgementCopy {
  const combinationShort = !combinationAdequate && combinationLoad > 0;

  if (outcome === "failure") {
    if (failureReason === "stability-overload") {
      if (decipher >= 3) {
        return language === "ko"
          ? {
              title: "안정성 파단",
              detail: `코스트 ${stabilityCost}가 안정성 ${stability}을 넘어 문장이 스스로 찢어진다.`,
            }
          : {
              title: "Stability Breach",
              detail: `Cost ${stabilityCost} overwhelms stability ${stability}; the phrase tears itself apart.`,
            };
      }

      if (decipher >= 2) {
        return language === "ko"
          ? {
              title: "결속 붕괴",
              detail: "문장이 감당할 수 있는 무게를 넘겨 반동이 돌아온다.",
            }
          : {
              title: "Binding Collapse",
              detail: "The sentence carries more weight than you can anchor.",
            };
      }

      return language === "ko"
        ? {
            title: "무언가 찢어진다",
            detail: "말이 당신을 거스른다.",
          }
        : {
            title: "Something Tears",
            detail: "The phrase turns on you.",
          };
    }

    if (decipher >= 3) {
      const detail = (() => {
        switch (failureReason) {
          case "unknown-token":
            return language === "ko"
              ? "허용되지 않은 단어가 끼어 있어 결속이 처음부터 성립하지 않는다."
              : "An unsupported word breaks the pattern before it can bind.";
          case "rune-needs-attack":
            return language === "ko"
              ? "XLEW는 단독 공격이거나 공격 앞에서만 성립한다. 방어 동사와는 결속하지 않는다."
              : "XLEW works on its own or directly before an attack verb, not with defense.";
          default:
            return language === "ko"
              ? "연결어와 룬어의 순서가 어긋나 문장 뼈대가 틀어졌다."
              : "The connector-rune order slips out of alignment and fractures the sentence.";
        }
      })();

      return language === "ko"
        ? { title: "구문 파열", detail }
        : { title: "Syntax Fracture", detail };
    }

    if (decipher >= 2) {
      return language === "ko"
        ? {
            title: "문장이 엇물리지 않는다",
            detail: "어떤 단어가 제자리를 찾지 못했다.",
          }
        : {
            title: "The Words Refuse",
            detail: "Something in the phrase never found its place.",
          };
    }

    return language === "ko"
      ? {
          title: "받지 않는다",
          detail: "문장이 입안에서 깨진다.",
        }
      : {
          title: "It Will Not Take",
          detail: "The phrase breaks in your mouth.",
        };
  }

  if (outcome === "risky") {
    if (combinationShort && decipher >= 3) {
      return language === "ko"
        ? {
            title: "약한 결속",
            detail: `조합 부하 ${combinationLoad}가 조합력 ${combination}을 넘어 일부 글자가 힘을 잃는다. 대신 구문은 간신히 남는다.`,
          }
        : {
            title: "Weak Binding",
            detail: `Combination load ${combinationLoad} exceeds combine ${combination}; parts of the phrase lose force before the weave barely holds.`,
          };
    }

    if (decipher >= 3) {
      return language === "ko"
        ? {
            title: "위태로운 결속",
            detail: `코스트 ${stabilityCost}가 한계를 한 칸 넘겼다. 반동 HP -${selfHpCost}, MP -${selfManaCost}.`,
          }
        : {
            title: "Precarious Binding",
            detail: `Cost ${stabilityCost} pushes one step past your limit. Backlash HP -${selfHpCost}, MP -${selfManaCost}.`,
          };
    }

    if (decipher >= 2) {
      return language === "ko"
        ? {
            title: "간신히 엮인다",
            detail: "성공은 하지만 몸이 그 값을 치른다.",
          }
        : {
            title: "It Barely Holds",
            detail: "The weave succeeds, but your body pays for it.",
          };
    }

    return language === "ko"
      ? {
          title: "말이 문다",
          detail: "성공했지만 아프다.",
        }
      : {
          title: "The Phrase Bites",
          detail: "It works, but it hurts.",
        };
  }

  if (combinationShort) {
    if (decipher >= 3) {
      return language === "ko"
        ? {
            title: "흐트러진 결속",
            detail: `조합 부하 ${combinationLoad}가 조합력 ${combination}보다 높아 절반 효율로 엮였다.`,
          }
        : {
            title: "Frayed Binding",
            detail: `Combination load ${combinationLoad} sits above combine ${combination}, so the weave lands at reduced strength.`,
          };
    }

    if (decipher >= 2) {
      return language === "ko"
        ? {
            title: "조금 약하다",
            detail: "문장이 닿기는 했지만 단단히 맞물리지는 않았다.",
          }
        : {
            title: "A Little Weak",
            detail: "The phrase reaches the box, but never locks tightly.",
          };
    }

    return language === "ko"
      ? {
          title: "휘청인다",
          detail: "힘이 조금 샌다.",
        }
      : {
          title: "It Falters",
          detail: "Some force leaks away.",
        };
  }

  if (decipher >= 3) {
    return language === "ko"
      ? {
          title: "재정렬 완료",
          detail: `조합 부하 ${combinationLoad}, 안정 코스트 ${stabilityCost}. 문장이 제자리를 찾는다.`,
        }
      : {
          title: "Reordering Complete",
          detail: `Combination load ${combinationLoad}, stability cost ${stabilityCost}. The phrase settles cleanly.`,
        };
  }

  if (decipher >= 2) {
    return language === "ko"
      ? {
          title: "문장이 맞물린다",
          detail: "낱말들이 흔들리다 곧 한 줄로 정돈된다.",
        }
      : {
          title: "The Sentence Locks",
          detail: "The words shudder, then find a single line.",
        };
  }

  return language === "ko"
    ? {
        title: "제자리를 찾는다",
        detail: "말이 잠잠해진다.",
      }
    : {
        title: "It Settles",
        detail: "The words stop fighting you.",
      };
}
