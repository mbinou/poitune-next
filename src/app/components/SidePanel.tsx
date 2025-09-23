import { LocusSide } from "../util/defaultSide";
import { Color } from "./Color";
import { Num } from "./Num";
import { Section } from "./Section";

type Props = {
  side: LocusSide;
  setSide: (s: LocusSide) => void;
  title: string;
};

export const SidePanel = ({ side, setSide, title }: Props) => (
  <div className="grid gap-4 md:grid-cols-2">
    <Section title={`${title} / Spinner`}>
      <Num
        label="Origin Size"
        value={side.objectSize.origin}
        min={0}
        onChange={(v) => setSide({ ...side, objectSize: { ...side.objectSize, origin: v } })}
      />
      <Num
        label="Arm Size"
        value={side.segmentSize.arm}
        step={0.5}
        onChange={(v) => setSide({ ...side, segmentSize: { ...side.segmentSize, arm: v } })}
      />
      <Num
        label="Hand Size"
        value={side.objectSize.hand}
        min={0}
        onChange={(v) => setSide({ ...side, objectSize: { ...side.objectSize, hand: v } })}
      />
      <Color
        label="Origin Color"
        value={side.objectColor.origin}
        onChange={(v) =>
          setSide({
            ...side,
            objectColor: { ...side.objectColor, origin: v },
          })
        }
      />
      <Color
        label="Arm Color"
        value={side.segmentColor.arm}
        onChange={(v) => setSide({ ...side, segmentColor: { ...side.segmentColor, arm: v } })}
      />
      <Color
        label="Hand Color"
        value={side.objectColor.hand}
        onChange={(v) => setSide({ ...side, objectColor: { ...side.objectColor, hand: v } })}
      />
    </Section>

    <Section title={`${title} / Spinner Rotation`}>
      <Num
        label="Origin X"
        value={side.rotation.originX}
        onChange={(v) => setSide({ ...side, rotation: { ...side.rotation, originX: v } })}
      />
      <Num
        label="Origin Y"
        value={side.rotation.originY}
        onChange={(v) => setSide({ ...side, rotation: { ...side.rotation, originY: v } })}
      />
      <Num
        label="Hand Radius"
        value={side.rotation.radiusHand}
        onChange={(v) => setSide({ ...side, rotation: { ...side.rotation, radiusHand: v } })}
      />
      <Num
        label="Hand Angular Velocity (rev/s)"
        value={side.rotation.omegaHand}
        step={0.1}
        onChange={(v) =>
          setSide({
            ...side,
            rotation: { ...side.rotation, omegaHand: v },
          })
        }
      />
      <Num
        label="Hand Initial Angle (°)"
        value={side.rotation.angleHand / (Math.PI / 180)}
        step={5}
        onChange={(v) =>
          setSide({
            ...side,
            rotation: { ...side.rotation, angleHand: v * (Math.PI / 180) },
          })
        }
      />
    </Section>

    <Section title={`${title} / Poi`}>
      <Num
        label="Head Size"
        value={side.objectSize.poi}
        min={0}
        onChange={(v) => setSide({ ...side, objectSize: { ...side.objectSize, poi: v } })}
      />
      <Num
        label="Chain Size"
        value={side.segmentSize.chain}
        step={0.5}
        min={0}
        onChange={(v) => setSide({ ...side, segmentSize: { ...side.segmentSize, chain: v } })}
      />

      <Color
        label="Head Color"
        value={side.objectColor.poi}
        onChange={(v) => setSide({ ...side, objectColor: { ...side.objectColor, poi: v } })}
      />
      <Color
        label="Chain Color"
        value={side.segmentColor.chain}
        onChange={(v) =>
          setSide({
            ...side,
            segmentColor: { ...side.segmentColor, chain: v },
          })
        }
      />
    </Section>

    <Section title={`${title} / Poi Rotation`}>
      <Num
        label="Head Radius"
        value={side.rotation.radiusPoi}
        onChange={(v) => setSide({ ...side, rotation: { ...side.rotation, radiusPoi: v } })}
      />
      <Num
        label="Head Angular Velocity (rev/s)"
        value={side.rotation.omegaPoi}
        step={0.1}
        onChange={(v) =>
          setSide({
            ...side,
            rotation: { ...side.rotation, omegaPoi: v },
          })
        }
      />
      <Num
        label="Head Initial Angle (°)"
        value={side.rotation.anglePoi / (Math.PI / 180)}
        step={5}
        onChange={(v) =>
          setSide({
            ...side,
            rotation: { ...side.rotation, anglePoi: v * (Math.PI / 180) },
          })
        }
      />
    </Section>
  </div>
);
