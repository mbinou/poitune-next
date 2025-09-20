import { LocusSide } from "../util/defaultSide";
import { Color } from "./Color";
import { Num } from "./Num";
import { Section } from "./Section";
import { Toggle } from "./Toggle";

type Props = {
  side: LocusSide;
  setSide: (s: LocusSide) => void;
  title: string;
};

export const SidePanel = ({ side, setSide, title }: Props) => (
  <div className="grid gap-4 md:grid-cols-2">
    <Section title={`${title} / Objects`}>
      <Toggle
        label="Origin"
        value={side.objectVisible.origin}
        onChange={(v) =>
          setSide({
            ...side,
            objectVisible: { ...side.objectVisible, origin: v },
          })
        }
      />
      <Toggle
        label="Hand"
        value={side.objectVisible.hand}
        onChange={(v) =>
          setSide({
            ...side,
            objectVisible: { ...side.objectVisible, hand: v },
          })
        }
      />
      <Toggle
        label="Poi"
        value={side.objectVisible.poi}
        onChange={(v) =>
          setSide({
            ...side,
            objectVisible: { ...side.objectVisible, poi: v },
          })
        }
      />
      <Num
        label="Origin Size"
        value={side.objectSize.origin}
        min={0}
        onChange={(v) => setSide({ ...side, objectSize: { ...side.objectSize, origin: v } })}
      />
      <Num
        label="Hand Size"
        value={side.objectSize.hand}
        min={0}
        onChange={(v) => setSide({ ...side, objectSize: { ...side.objectSize, hand: v } })}
      />
      <Num
        label="Poi Size"
        value={side.objectSize.poi}
        min={0}
        onChange={(v) => setSide({ ...side, objectSize: { ...side.objectSize, poi: v } })}
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
        label="Hand Color"
        value={side.objectColor.hand}
        onChange={(v) => setSide({ ...side, objectColor: { ...side.objectColor, hand: v } })}
      />
      <Color
        label="Poi Color"
        value={side.objectColor.poi}
        onChange={(v) => setSide({ ...side, objectColor: { ...side.objectColor, poi: v } })}
      />
    </Section>

    <Section title={`${title} / Rotation`}>
      <Num
        label="Hand Radius"
        value={side.rotation.radiusHand}
        onChange={(v) => setSide({ ...side, rotation: { ...side.rotation, radiusHand: v } })}
      />
      <Num
        label="Poi Radius"
        value={side.rotation.radiusPoi}
        onChange={(v) => setSide({ ...side, rotation: { ...side.rotation, radiusPoi: v } })}
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
        label="Poi Angular Velocity (rev/s)"
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
      <Num
        label="Poi Initial Angle (°)"
        value={side.rotation.anglePoi / (Math.PI / 180)}
        step={5}
        onChange={(v) =>
          setSide({
            ...side,
            rotation: { ...side.rotation, anglePoi: v * (Math.PI / 180) },
          })
        }
      />
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
    </Section>

    <Section title={`${title} / Segments`}>
      <Toggle
        label="Arm"
        value={side.segmentVisible.arm}
        onChange={(v) =>
          setSide({
            ...side,
            segmentVisible: { ...side.segmentVisible, arm: v },
          })
        }
      />
      <Toggle
        label="Chain"
        value={side.segmentVisible.chain}
        onChange={(v) =>
          setSide({
            ...side,
            segmentVisible: { ...side.segmentVisible, chain: v },
          })
        }
      />
      <Num
        label="Arm Thickness"
        value={side.segmentSize.arm}
        step={0.5}
        onChange={(v) => setSide({ ...side, segmentSize: { ...side.segmentSize, arm: v } })}
      />
      <Num
        label="Chain Thickness"
        value={side.segmentSize.chain}
        step={0.5}
        onChange={(v) => setSide({ ...side, segmentSize: { ...side.segmentSize, chain: v } })}
      />
      <Color
        label="Arm Color"
        value={side.segmentColor.arm}
        onChange={(v) => setSide({ ...side, segmentColor: { ...side.segmentColor, arm: v } })}
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
  </div>
);
