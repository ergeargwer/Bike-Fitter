export type MambaSize = "XS" | "S" | "M" | "L" | "XL";

export interface FullBikeGeometry {
  seatTube: number;
  stack: number;
  reach: number;
  headTube: number;
  seatAngle: number;
  bbDrop: number;
  forkRake: number;
  headAngle: number;
  rearCenter: number;
  wheelbase: number;
}

export const MAMBA_SIZES: readonly MambaSize[] = ["XS", "S", "M", "L", "XL"] as const;

export const MAMBA_GEOMETRY: Record<MambaSize, FullBikeGeometry> = {
  XS: { seatTube: 430, stack: 493, reach: 378, headTube:  85, seatAngle: 76.0, rearCenter: 408, wheelbase:  965, bbDrop: 70, forkRake: 43, headAngle: 71.5 },
  S:  { seatTube: 460, stack: 502, reach: 385, headTube:  95, seatAngle: 75.0, rearCenter: 408, wheelbase:  977, bbDrop: 70, forkRake: 43, headAngle: 71.5 },
  M:  { seatTube: 490, stack: 528, reach: 388, headTube: 130, seatAngle: 75.7, rearCenter: 408, wheelbase:  976, bbDrop: 70, forkRake: 43, headAngle: 72.0 },
  L:  { seatTube: 520, stack: 552, reach: 391, headTube: 145, seatAngle: 74.6, rearCenter: 408, wheelbase:  955, bbDrop: 70, forkRake: 43, headAngle: 72.0 },
  XL: { seatTube: 550, stack: 582, reach: 402, headTube: 175, seatAngle: 74.0, rearCenter: 408, wheelbase: 1010, bbDrop: 70, forkRake: 43, headAngle: 72.5 },
};
