import * as shapes from './shapes';
import * as renderer from './glrenderer';

type ListenerCallback<T> = {(event: T): void};
class EventStream<T> {
  listeners: ListenerCallback<T>[];
  constructor() {
    this.listeners = [];
  }
  addEventListener(callback: ListenerCallback<T>): void {
    this.listeners.push(callback);
  }
  push(event: T): void {
    this.listeners.forEach((f)=>f(event));
  }
}

class TimeTicks {
  timerId: number;
  interval: number;
  stream: EventStream<void>;
  constructor(interval: number){
    this.interval = interval;
    this.stream = new EventStream();
  }
  addEventListener(callback: ListenerCallback<void>): void {
    this.stream.addEventListener(callback);
  }
  start(): void {
    this.pause();
    this.timerId = window.setInterval(
      ()=>this.stream.push(), this.interval
    );
  }
  pause(): void {
    window.clearInterval(this.timerId);
  }
}

abstract class GameObject {
  static nextId: number = 0;
  id: number;
  shape: shapes.Transform2D;
  glRenderer: renderer.Shape2DGlRenderer;
  velocity: shapes.Vec2D;
  constructor(gl: WebGL2RenderingContext, shape: shapes.Transform2D) {
    this.id = GameObject.nextId++;
    this.shape = shape;
    this.glRenderer = new renderer.Shape2DGlRenderer(gl, shape);
    this.velocity = new shapes.Vec2D(0,0);
  }
}

class BallHitEvent {
  ball: Ball;
  target: GameObject;
  constructor(ball: Ball, target: GameObject) {
    this.ball = ball;
    this.target = target;
  }
}
class Ball extends GameObject {
  controller: Controller;
  hitEventStream: EventStream<BallHitEvent>;
  constructor(gl: WebGL2RenderingContext, controller: Controller, position: shapes.Vec2D) {
    super(gl, new shapes.Transform2D(new shapes.Circle(), 5, 0, position));
    this.controller = controller;
    controller.timeTickStream.addEventListener(()=>this.onTimeTick());
    this.hitEventStream = new EventStream();
    this.velocity = new shapes.Vec2D(1,2);
  }
  onTimeTick() {
    const EPS = 0.001;
    var r = this.shape.scale;
    var v = this.velocity.clone();
    var l = v.len();
    var p = this.shape.translate.clone();
    while (l > 0) {
      var nearest = this.controller.findNearestCollidable(this.id, p, v);
      var d = nearest.shape.getDistance(p) - r;
      if (l < d) {
        p = p.add( v.mul(l / v.len()) );
        l = 0;
      } else if (EPS < d) {
        p = p.add( v.mul(d / v.len()) );
        l -= d;
      } else {
        this.hitEventStream.push(new BallHitEvent(this, nearest));
        var n = nearest.shape.getNormal(p);
        var iv = v.negative();
        var an = Math.atan2(n.y, n.x);
        var av = Math.atan2(iv.y, iv.x);
        var adiff = av - an;
        v = iv.rotate(-2*adiff);
      }
    }
    this.velocity = v;
    this.shape.translate = p;
  }
}

class TargetDestroyedEvent {
  targetId: number;
}
class Target extends GameObject {
  destroyedEventStream: EventStream<TargetDestroyedEvent>;
  constructor(gl: WebGL2RenderingContext, controller: Controller, position: shapes.Vec2D) {
    super(gl, new shapes.Transform2D(new shapes.Rect(new shapes.Vec2D(30,30)), 1,0,position));
    controller.ballHitStream.addEventListener((e)=>this.onBallHit(e));
    this.destroyedEventStream = new EventStream();
  }
  onBallHit(e: BallHitEvent) {
    if (e.target.id == this.id) {
      //// TODO: sound/visual effect
      this.destroyedEventStream.push({targetId: this.id});
    }
  }
}

class Wall extends GameObject {
  constructor(gl: WebGL2RenderingContext, size: shapes.Vec2D, position: shapes.Vec2D) {
    super(gl, new shapes.Transform2D(new shapes.Rect(size), 1,0,position));
  }
  onBallHit(e: BallHitEvent) {
    if (e.target.id == this.id) {
      //// TODO: sound/visual effect
    }
  }
}

class KillZone extends Wall {
  enterEventStream: EventStream<void>;
  constructor(gl: WebGL2RenderingContext, controller: Controller, size: shapes.Vec2D, position: shapes.Vec2D) {
    super(gl, size, position);
    controller.ballHitStream.addEventListener((e)=>this.onBallHit(e));
    this.enterEventStream = new EventStream();
  }
  onBallHit(e: BallHitEvent) {
    if (e.target.id == this.id) {
      //// TODO: sound/visual effect
      this.enterEventStream.push();
    }
  }
}

class Bar extends GameObject {
  controller: Controller;
  constructor(gl: WebGL2RenderingContext, controller: Controller, position: shapes.Vec2D) {
    super(gl,
      new shapes.Transform2D(
        new shapes.Bloated( new shapes.Rect(new shapes.Vec2D(48,0)), 5 ),
        1,0,position
      )
    );
    this.controller = controller;
    controller.timeTickStream.addEventListener(()=>this.onTimeTick());
    controller.ballHitStream.addEventListener((e)=>this.onBallHit(e));
  }
  onTimeTick() {
    this.velocity.x = this.controller.mousePosition.x - this.shape.translate.x;
    this.shape.translate = this.shape.translate.add( this.velocity );
  }
  onBallHit(e: BallHitEvent) {
    if (e.target.id == this.id) {
    /// TODO: sound/visual effect
    }
  }
}


export class Controller {
  gameObjects: GameObject[];
  numTargets: number;
  timeTickStream: EventStream<void>;
  ballHitStream: EventStream<BallHitEvent>;
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  mousePosition: shapes.Vec2D;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2");
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clearDepth(1.0);
    this.gameObjects = [];
    var size = new shapes.Vec2D(canvas.width, canvas.height);
    var ballPosition = new shapes.Vec2D(size.x/2, size.y*1/4);
    var barPosition = new shapes.Vec2D(size.x/2, size.y*1/8);
    var tick = new TimeTicks(1000/60);
    this.timeTickStream = tick.stream;
    this.timeTickStream.addEventListener(()=>this.onTimeTick());
    var ball = new Ball(this.gl, this, ballPosition);
    this.gameObjects.push(ball);
    this.ballHitStream = ball.hitEventStream;
    var bar = new Bar(this.gl, this, barPosition);
    this.gameObjects.push( bar );
    this.gameObjects.push( new Wall(this.gl, new shapes.Vec2D(10,size.y), new shapes.Vec2D(0, size.y/2)) );
    this.gameObjects.push( new Wall(this.gl, new shapes.Vec2D(10,size.y), new shapes.Vec2D(size.x, size.y/2)) );
    this.gameObjects.push( new Wall(this.gl, new shapes.Vec2D(size.x,10), new shapes.Vec2D(size.x/2, size.y)) );
    var killZone = new KillZone(this.gl, this, new shapes.Vec2D(size.x,20), new shapes.Vec2D(size.x/2, 0) );
    this.gameObjects.push( killZone );
    killZone.enterEventStream.addEventListener(()=>this.onKillZoneEntered());
    var numTargets = 0;
    for (var i: number = -4; i<=4; i++) {
      for (var j: number = -2; j<=2; j++) {
        var target = new Target(this.gl, this, new shapes.Vec2D(size.x/2 + i*32 , size.y*3/4 + j*32));
        this.gameObjects.push(target);
        target.destroyedEventStream.addEventListener((e)=>this.onTargetDestroyed(e));
        numTargets++;
      }
    }
    this.numTargets = numTargets;
    this.mousePosition = new shapes.Vec2D(0,0);
    canvas.addEventListener("mousemove", (ev)=>this.onMouseMove(ev));
    tick.start();
  }
  onMouseMove(ev: MouseEvent) {
    var p_js = new shapes.Vec2D(ev.clientX, ev.clientY);
    var size = new shapes.Vec2D(this.canvas.width, this.canvas.height);
    this.mousePosition =  new shapes.Vec2D(p_js.x, size.y-p_js.y);
  }
  onTimeTick() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.gameObjects.forEach((o)=>{o.glRenderer.draw()});
    this.gl.flush();
  }
  onTargetDestroyed(e: TargetDestroyedEvent) {
    this.gameObjects = this.gameObjects.filter((o) => o.id != e.targetId);
    if (--this.numTargets <= 0) {
      //// TODO:  game clear
      window.alert("clear");
    }
  }
  onKillZoneEntered() {
    //// TODO: miss
    window.alert("miss");
  }
  findNearestCollidable(id: number, point: shapes.Vec2D, velocity: shapes.Vec2D): GameObject {
    var candidates = this.gameObjects;
    candidates = candidates.filter((o) => o.id != id);
    candidates = candidates.filter((o) => o.shape.getNormal(point).dot(velocity) < 0);
    return candidates.reduce((prev, current) =>
      (prev.shape.getDistance(point) < current.shape.getDistance(point)) ? prev : current
    );
  }
}
