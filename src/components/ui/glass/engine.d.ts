export type GlassParameters = Record<string, string | number | boolean>;
export type GlassFrame = Record<string, number | number[]>;
export const BASE: GlassParameters;
export function loadImage(src: string): Promise<HTMLImageElement>;
export function fitToTexture(
  source: HTMLImageElement,
  width: number,
  height: number,
): HTMLCanvasElement;
export function buildSdf(canvas: HTMLCanvasElement): Float32Array;
export function frameAt(time: number, parameters: GlassParameters, outro?: number): GlassFrame;
export function endOf(parameters: GlassParameters): number;
export function createRenderer(canvas: HTMLCanvasElement): null | {
  gl: WebGL2RenderingContext;
  setLogo(logo: { canvas: HTMLCanvasElement; sdf: Float32Array }): void;
  render(frame: GlassFrame, width: number, height: number, tilePx: number): void;
  dispose(): void;
};
