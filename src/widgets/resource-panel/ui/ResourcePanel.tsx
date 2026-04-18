import HeartHP from "./HeartHP";
import ManaFlask from "./ManaFlask";

interface ResourcePanelProps {
  hpCurrent: number;
  hpMax: number;
  manaCurrent: number;
  manaMax: number;
  shield: number;
  hpLabel: string;
  manaLabel: string;
  shieldLabel: string;
}

/**
 * 전투 장면에서 체력과 마나 위젯을 한 덩어리로 배치하는 자원 패널이다.
 */
export default function ResourcePanel({
  hpCurrent,
  hpMax,
  manaCurrent,
  manaMax,
  shield,
  hpLabel,
  manaLabel,
  shieldLabel,
}: ResourcePanelProps) {
  return (
    <div className="flex items-end gap-6">
      <HeartHP
        current={hpCurrent}
        max={hpMax}
        shield={shield}
        label={hpLabel}
        shieldLabel={shieldLabel}
      />
      <ManaFlask current={manaCurrent} max={manaMax} label={manaLabel} />
    </div>
  );
}
