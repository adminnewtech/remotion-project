declare module 'bwip-js' {
  interface BwipOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    backgroundcolor?: string;
    paddingwidth?: number;
    paddingheight?: number;
    [key: string]: unknown;
  }
  export function toCanvas(canvas: HTMLCanvasElement, options: BwipOptions): HTMLCanvasElement;
  export function toBuffer(options: BwipOptions): Buffer;
  export default { toCanvas, toBuffer };
}
