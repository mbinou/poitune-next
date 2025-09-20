export type RotationParams = {
  radiusHand: number; // 手の軌道半径
  radiusPoi: number; // ポイの軌道半径
  omegaHand: number; // 角速度[rad/s]
  omegaPoi: number; // 角速度[rad/s]
  angleHand: number; // 初期角度[rad]
  anglePoi: number; // 初期角度[rad]
  originX: number; // 原点X（canvas座標）
  originY: number; // 原点Y
};

type ObjectVisibility = {
  origin: boolean;
  hand: boolean;
  poi: boolean;
};

type SegmentVisibility = {
  arm: boolean; // 手→ポイの線
  chain: boolean; // 原点→手 とか任意の線
};

type ObjectSize = {
  origin: number; // 点のサイズ(px)
  hand: number;
  poi: number;
};

// 片側（Left / Right）
export type LocusSide = {
  objectVisible: ObjectVisibility;
  objectSize: ObjectSize;
  objectColor: { origin: string; hand: string; poi: string };
  rotation: RotationParams;
  segmentVisible: SegmentVisibility;
  segmentSize: { arm: number; chain: number };
  segmentColor: { arm: string; chain: string };
};

export const defaultSide = (
  radiusHand: number,
  radiusPoi: number,
  omegaHand: number,
  omegaPoi: number,
  angleHand: number,
  anglePoi: number,
): LocusSide => ({
  objectVisible: { origin: true, hand: true, poi: true },
  objectSize: { origin: 2, hand: 4, poi: 10 },
  objectColor: { origin: "#888888", hand: "#00ffcc", poi: "#ffcc00" },
  rotation: {
    radiusHand,
    radiusPoi,
    omegaHand,
    omegaPoi,
    angleHand,
    anglePoi,
    originX: 320,
    originY: 170,
  },
  segmentVisible: { arm: true, chain: true },
  segmentSize: { arm: 2, chain: 2 },
  segmentColor: { arm: "#ffffff", chain: "#999999" },
});
