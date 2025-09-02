export class Color {
  r: number = 0;
  g: number = 0;
  b: number = 0;
  a: number = 0;

  init(color: Color): Color {
    this.r = color.r;
    this.g = color.g;
    this.b = color.b;
    this.a = color.a;
    return this;
  }

  initRgba(r: number, g: number, b: number, a: number = 255): Color {
    this.r = Math.max(Math.min(Math.round(r), 255), 0);
    this.g = Math.max(Math.min(Math.round(g), 255), 0);
    this.b = Math.max(Math.min(Math.round(b), 255), 0);
    this.a = Math.max(Math.min(Math.round(a), 255), 0);
    return this;
  }

  static color(r: number, g: number, b: number, a: number = 255): Color {
    return new Color().initRgba(r, g, b, a);
  }

  static greyScaleColor(c: number, a: number = 255): Color {
    return new Color().initRgba(c, c, c, a);
  }

  static color1(r: number, g: number, b: number, a: number = 1): Color {
    return new Color().initRgba(255 * r, 255 * g, 255 * b, 255 * a);
  }

  static greyScaleColor1(c: number, a: number = 1): Color {
    return new Color().initRgba(255 * c, 255 * c, 255 * c, 255 * a);
  }

  static fromUint32(color: number): Color {
    return new Color().initRgba(color & 255, (color >>> 8) & 255, (color >>> 16) & 255, color >>> 24);
  }

  static black = new Color().initRgba(0, 0, 0);
  static white = new Color().initRgba(255, 255, 255);
  static red = new Color().initRgba(255, 0, 0);
  static green = new Color().initRgba(0, 255, 0);
  static blue = new Color().initRgba(0, 0, 255);
  static transparentBlack = new Color().initRgba(0, 0, 0, 0);

  uint32(): number {
    return ((this.a << 24) | (this.b << 16) | (this.g << 8) | this.r);
  }

  rgba(): string {
    return `rgba(${this.r},${this.g},${this.b},${this.a / 255})`;
  }

  mix(color: Color, f: number): Color {
    return new Color().initRgba((1 - f) * this.r + f * color.r, (1 - f) * this.g + f * color.g, (1 - f) * this.b + f * color.b);
  }
  
  shadow(sh: number): Color {
    const addShadow = (c: number, sh: number): number => {
      const result: number = c + sh;
      return result > 255 ? 255 : result < 0 ? 0 : result;
    };
    return new Color().initRgba(addShadow(this.r, sh), addShadow(this.g, sh), addShadow(this.b, sh));
  }
}
