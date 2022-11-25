export class Vec2D {
  x: number;
  y: number;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  clone(): Vec2D {
    return new Vec2D(this.x, this.y);
  }
  add(v: Vec2D): Vec2D {
    return new Vec2D(this.x + v.x, this.y + v.y);
  }
  mul(scale: number): Vec2D {
    return new Vec2D(this.x*scale, this.y*scale);
  }
  negative(): Vec2D {
    return new Vec2D(-this.x, -this.y);
  }
  rotate(rad: number): Vec2D {
    return new Vec2D(this.x*Math.cos(rad) - this.y*Math.sin(rad), this.x*Math.sin(rad) + this.y*Math.cos(rad));
  }
  dot(v: Vec2D): number {
    return v.x*this.x + v.y*this.y;
  }
  len(): number {
    return Math.sqrt(this.x*this.x + this.y*this.y);
  }
  normalize(): Vec2D {
    var l: number = this.len();
    return new Vec2D(this.x/l, this.y/l);
  }
}


export abstract class Shape2D { //SignedDistanceFunction
  abstract getDistance(point: Vec2D): number;
  getNormal(point: Vec2D): Vec2D {
    const EPS = 0.01;
    var v: Vec2D = new Vec2D(
      this.getDistance(point.add(new Vec2D(+EPS,0))) - this.getDistance(point.add(new Vec2D(-EPS,0))),
      this.getDistance(point.add(new Vec2D(0,+EPS))) - this.getDistance(point.add(new Vec2D(0,-EPS))),
    );
    return v.normalize();
  }
  abstract getGlSDF(): string;
  abstract getGlVars(): string;
  abstract setGlVars(gl: WebGL2RenderingContext, program: WebGLProgram): void;
}

export class Transform2D extends Shape2D {
  original: Shape2D;
  scale: number;
  rotation: number;
  translate: Vec2D;
  constructor(original: Shape2D, scale: number, rotation: number, translate: Vec2D) {
    super();
    this.original = original;
    this.scale = scale;
    this.rotation = rotation;
    this.translate = translate;
  }
  transform(p: Vec2D): Vec2D {
    var res: Vec2D = p.clone();
    return res.mul(this.scale).rotate(this.rotation).add(this.translate);
  }
  inverse(p: Vec2D): Vec2D {
    var res: Vec2D = p.add(this.translate.negative()).rotate(-this.rotation).mul(1/this.scale);
    return res;
  }
  override getDistance(point: Vec2D): number {
    var p = this.inverse(point);
    var d = this.original.getDistance(p);
    return d * this.scale;
  }
  override getNormal(point: Vec2D): Vec2D {
    var p = this.inverse(point);
    var v = this.original.getNormal(p);
    return v.rotate(this.rotation);
  }
  override getGlSDF(): string {
    var org = this.original.getGlSDF();
    var inv_p = "{\
      point = point - transform_translate; \
      point = vec2(\
        cos(-transform_rotation)*point.x - sin(-transform_rotation)*point.y , \
        cos(-transform_rotation)*point.y + sin(-transform_rotation)*point.x \
      ); \
      point /= transform_scale; \
    }";
    var tran_d = "{\
       distance *= transform_scale; \
    }";
    return inv_p + org + tran_d;
  }
  override getGlVars(): string {
    return this.original.getGlVars() + "\
      uniform float transform_scale; \
      uniform float transform_rotation; \
      uniform vec2 transform_translate; \
    ";
  }
  override setGlVars(gl: WebGL2RenderingContext, program: WebGLProgram): void{
    this.original.setGlVars(gl, program);
    var location: WebGLUniformLocation;
    location = gl.getUniformLocation(program, "transform_scale");
    gl.uniform1f(location, this.scale);
    location = gl.getUniformLocation(program, "transform_rotation");
    gl.uniform1f(location, this.rotation);
    location = gl.getUniformLocation(program, "transform_translate");
    gl.uniform2f(location, this.translate.x, this.translate.y);
  }
}


export class Rect extends Shape2D {
  size: Vec2D;
  constructor(size: Vec2D) {
    super();
    this.size = size;
  }
  override getDistance(point: Vec2D): number {
    var p_abs = new Vec2D(Math.abs(point.x), Math.abs(point.y));
    var diff = p_abs.add(this.size.mul(1/2).negative());
    var positive = (new Vec2D(Math.max(diff.x, 0), Math.max(diff.y, 0))).len();
    var negative = Math.min(0, Math.max(diff.x, diff.y));
    return positive + negative;
  }
  override getGlSDF(): string {
    return "{\
      vec2 p_abs = abs(point); \
      vec2 diff = p_abs - 0.5*rect_size; \
      float positive = length(max(diff, 0.0)); \
      float negative = min(max(diff.x, diff.y), 0.0); \
      distance = positive + negative; \
    }";
  }
  override getGlVars(): string {
    return "\
      uniform vec2 rect_size; \
    ";
  }
  override setGlVars(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    var location = gl.getUniformLocation(program, "rect_size");
    gl.uniform2f(location, this.size.x, this.size.y);
  }
}

export class Circle extends Shape2D {
  override getDistance(point: Vec2D): number {
    return point.len()-1;
  }
  override getGlSDF(): string {
    return "{\
      distance = length(point) - 1.0; \
    }";
  }
  override getGlVars(): string {return "";}
  override setGlVars(gl: WebGL2RenderingContext, program: WebGLProgram): void {}
}

export class Bloated extends Shape2D {
  original: Shape2D;
  radius: number;
  constructor(original: Shape2D, radius: number) {
    super();
    this.original = original;
    this.radius = radius;
  }
  override getDistance(point: Vec2D): number {
    return this.original.getDistance(point) - this.radius;
  }
  override getGlSDF(): string {
    return this.original.getGlSDF() + "{\
      distance -= bloat_radius; \
    }";
  }
  override getGlVars(): string {
    return this.original.getGlVars() + "\
      uniform float bloat_radius; \
    ";
  }
  override setGlVars(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    this.original.setGlVars(gl, program);
    var location = gl.getUniformLocation(program, "bloat_radius");
    gl.uniform1f(location, this.radius);
  }
}
