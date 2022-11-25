import * as shapes from './shapes';

export class Shape2DGlRenderer {
  shape: shapes.Shape2D;
  context: WebGL2RenderingContext;
  program: WebGLProgram;
  glBuffer: WebGLBuffer;
  constructor(gl: WebGL2RenderingContext, shape: shapes.Shape2D) {
    this.shape = shape;
    this.context = gl;
    this.program = this.context.createProgram();
    this.glBuffer = this.context.createBuffer();
    this.prepareShader(gl.VERTEX_SHADER, this.getVertexShaderSource());
    this.prepareShader(gl.FRAGMENT_SHADER, this.getFragmentShaderSource());
    this.context.linkProgram(this.program);
    if (!this.context.getProgramParameter(this.program, gl.LINK_STATUS)) {
      console.log(this.context.getProgramInfoLog(this.program)); //error
    }
  }
  draw(): void {
    this.context.useProgram(this.program);
    this.shape.setGlVars(this.context, this.program);
    var location_rgba = this.context.getUniformLocation(this.program, "rgba");
    this.context.uniform4f(location_rgba, 0.5, 0.5, 0.5, 1.0);

    var vertexPositions = [[+1.0, +1.0], [+1.0, -1.0], [-1.0, -1.0], [-1.0, +1.0]];
    this.context.bindBuffer(this.context.ARRAY_BUFFER, this.glBuffer);
    this.context.bufferData(this.context.ARRAY_BUFFER, new Float32Array(vertexPositions.flat()), this.context.STATIC_DRAW);
    var location = this.context.getAttribLocation(this.program, 'position');
    this.context.enableVertexAttribArray(location);
    this.context.vertexAttribPointer(location, vertexPositions[0].length, this.context.FLOAT, false, 0, 0);

    this.context.drawArrays(this.context.TRIANGLE_FAN, 0, 4);
    this.context.bindBuffer(this.context.ARRAY_BUFFER, null);
  }

  getVertexShaderSource(): string {
    return "#version 300 es\n \
      in vec2 position; \
      void main(void) { \
        gl_Position = vec4(position, 0, 1); \
      }\
    ";
  }
  getFragmentShaderSource(): string {
    var glVars = this.shape.getGlVars() + "\
      uniform vec4 rgba; \
      out vec4 outColor; \
    ";
    var glMain = "void main(){ \
        float distance; \
        vec2 point = gl_FragCoord.xy ; \
      " + this.shape.getGlSDF() + "\
        if (distance > 0.0) { \
          discard; \
        } else {\
          outColor = rgba; \
        } \
      }"
    ;
    return "#version 300 es\n precision mediump float;" + glVars + glMain;
  }
  private prepareShader(type: number, source: string) {
    var shader = this.context.createShader(type);
    this.context.shaderSource(shader, source);
    this.context.compileShader(shader);
    if (!this.context.getShaderParameter(shader, this.context.COMPILE_STATUS)){
      console.log(this.context.getShaderInfoLog(shader)); //error
    }
    this.context.attachShader(this.program, shader);
  }

}
