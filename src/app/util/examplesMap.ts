import { CommonParams } from "../page";
import { defaultSide, LocusSide } from "./defaultSide";

export const examplesMap: Record<
  string,
  { left: LocusSide; right: LocusSide; common?: Partial<CommonParams> }
> = {
  Clover: {
    left: defaultSide(70, 70, 1, -3, 0, 0),
    right: defaultSide(70, 70, 1, -3, Math.PI, Math.PI),
  },
  "Negative Clover": {
    left: defaultSide(70, 70, 3, -1, 0, 0),
    right: defaultSide(70, 70, 3, -1, Math.PI, Math.PI),
  },
  Pentagram: {
    left: defaultSide(70, 70, 1, -4, (Math.PI / 2) * 3, (Math.PI / 2) * 3),
    right: defaultSide(70, 70, 1, -4, (Math.PI / 180) * 126, (Math.PI / 180) * 126),
  },
  "Clear Pentagram": {
    left: defaultSide(70, 70, 1, -2, (Math.PI / 180) * 90, (Math.PI / 180) * 90),
    right: defaultSide(70, 70, 1, -2, (Math.PI / 180) * 270, (Math.PI / 180) * 270),
  },
  Hexagram: {
    left: defaultSide(70, 70, 1, -5, Math.PI / 2, Math.PI / 2),
    right: defaultSide(70, 70, 1, -5, (Math.PI / 2) * 3, (Math.PI / 2) * 3),
  },
  "Clear Hexagram": {
    left: defaultSide(70, 70, 1, -2, Math.PI / 2, Math.PI / 2),
    right: defaultSide(70, 70, 1, -2, (Math.PI / 2) * 3, (Math.PI / 2) * 3),
  },
  "Cat Eye": {
    left: defaultSide(50, 100, 1, -1, Math.PI / 2, Math.PI / 2),
    right: defaultSide(50, 100, 1, -1, (Math.PI / 2) * 3, (Math.PI / 2) * 3),
  },
  "Linear Cat Eye": {
    left: defaultSide(70, 70, 1, -1, Math.PI / 2, Math.PI / 2),
    right: defaultSide(70, 70, 1, -1, (Math.PI / 2) * 3, (Math.PI / 2) * 3),
  },
  Isolation: {
    left: defaultSide(70, 140, 1, 1, 0, Math.PI),
    right: defaultSide(70, 140, 1, 1, Math.PI, 2 * Math.PI),
  },
};
