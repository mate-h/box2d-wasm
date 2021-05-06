const e_shapeBit = 0x0001;
const e_jointBit = 0x0002;
const e_aabbBit = 0x0004;
const e_pairBit = 0x0008;
const e_centerOfMassBit = 0x0010;

import { createWorld, loadWorld } from "./lib/loader";
import { Vector } from "./lib/vector";
import * as dat from 'dat.gui';

export let Box2D;

const dppx = window.devicePixelRatio;
let mouseJoint;
let canvasOffset = {
  x: 0,
  y: 0
};
let prevMousePosPixel = {
  x: 0,
  y: 0
};
let mousePosPixel = {
  x: 0,
  y: 0
};
let mousePosWorld = {
  x: 0,
  y: 0
};
let PTM;
let minPTM = 0.1;
let maxPTM = 300;

const gui = new dat.GUI({name: 'Parameters'});

const sceneOptions = [
  'bike',
'bodyTypes',
'car',
'clock',
'documentA',
'documentB',
'fixtureTypes',
'gettingStarted',
'images',
'jointTypes',
'rubegoldberg',
'tank',
'truck',
'walker'
]

export class Game {
  parameters = {
    currentScene: 'bike'
  };
  constructor(engine) {
    Box2D = engine;
  }

  initGui() {
    gui.add(this.parameters, 'currentScene').options(sceneOptions).onChange(name => {
      this.refreshScene();
    });
  }

  init(canvas) {
    this.initGui();
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    let loader = this.loadSceneAsync(this.parameters.currentScene);
    loader.then(scene => {
      this.world = this.loadScene(scene);
      this.debugDraw = this.getDebugDraw();
      this.debugDraw.SetFlags(e_shapeBit | e_jointBit | e_pairBit);
      this.world.SetDebugDraw(this.debugDraw);

      this.setupGameloop();
    });
  }

  setupGameloop() {
    let current = new Date().getTime();
    let prev = new Date().getTime();
    const mainLoop = () => {
      current = new Date().getTime();
      // this.update((current - prev) / 1000);
      this.update(1 / 60);
      prev = current;
      // setTimeout(mainLoop, 1500);
      window.requestAnimationFrame(mainLoop);
    };
    window.requestAnimationFrame(mainLoop);
  }

  refreshScene() {
    let loader = this.loadSceneAsync(this.parameters.currentScene);
    return loader.then(scene => {
      this.world = createWorld(scene);
      this.debugDraw.SetFlags(e_shapeBit | e_jointBit | e_pairBit);
      this.world.SetDebugDraw(this.debugDraw);
      this.setupDebugControls();
    });   
  }

  loadSceneAsync(name) {
    return fetch(`./scenes/${name}.json`).then(r => r.json());
  }

  loadScene(scene) {
    PTM = 24;
    canvasOffset = {
      x: this.canvas.width / 2 - 500,
      y: this.canvas.height - 300
    };

    return createWorld(scene);
  }

  setupDebugControls() {
    this.mouseJointGroundBody = this.world.CreateBody(new Box2D.b2BodyDef());
  }

  getDebugDraw() {
    const context = this.ctx;
    const canvas = this.canvas;
    let scrolling = false;
    function addEventListeners() {
      canvas.addEventListener(
        "pointermove",
        function(evt) {
          onMouseMove(canvas, evt);
        },
        false
      );

      canvas.addEventListener(
        "pointerdown",
        function(evt) {
          onMouseDown(canvas, evt);
        },
        false
      );

      canvas.addEventListener(
        "pointerup",
        function(evt) {
          onMouseUp(canvas, evt);
        },
        false
      );

      canvas.addEventListener(
        "pointerout",
        function(evt) {
          onMouseOut(canvas, evt);
        },
        false
      );
      window.addEventListener(
        "wheel",
        function(e) {
          onWheel(e);
        },
        { passive: false }
      );
      window.addEventListener("keydown", function(e) {
        // space
        if (e.which === 32 && !scrolling) {
          scrolling = true;
          canvas.style.cursor = "grab";
        }
      });
      window.addEventListener("keyup", function(e) {
        if (e.which === 32 && scrolling) {
          scrolling = false;
          canvas.style.cursor = "auto";
        }
      });
    }
    // C++ operator =
    function copyVec2(vec) {
      return new Box2D.b2Vec2(vec.get_x(), vec.get_y());
    }
    // C++ operator *= (float)
    function scaledVec2(vec, scale) {
      return new Box2D.b2Vec2(scale * vec.get_x(), scale * vec.get_y());
    }

    function drawAxes(ctx) {
      ctx.strokeStyle = "rgb(192,0,0)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(1, 0);
      ctx.stroke();
      ctx.strokeStyle = "rgb(0,192,0)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 1);
      ctx.stroke();
    }

    function setColorFromDebugDrawCallback(color) {
      var col = Box2D.wrapPointer(color, Box2D.b2Color);
      var red = (col.get_r() * 255) | 0;
      var green = (col.get_g() * 255) | 0;
      var blue = (col.get_b() * 255) | 0;
      var colStr = red + "," + green + "," + blue;
      context.fillStyle = "rgba(" + colStr + ",0.5)";
      context.strokeStyle = "rgb(" + colStr + ")";
    }

    function drawSegment(vert1, vert2) {
      var vert1V = Box2D.wrapPointer(vert1, Box2D.b2Vec2);
      var vert2V = Box2D.wrapPointer(vert2, Box2D.b2Vec2);
      context.beginPath();
      context.moveTo(vert1V.get_x(), vert1V.get_y());
      context.lineTo(vert2V.get_x(), vert2V.get_y());
      context.stroke();
    }

    function drawPolygon(vertices, vertexCount, fill) {
      context.beginPath();
      for (let tmpI = 0; tmpI < vertexCount; tmpI++) {
        var vert = Box2D.wrapPointer(vertices + tmpI * 8, Box2D.b2Vec2);
        if (tmpI == 0) context.moveTo(vert.get_x(), vert.get_y());
        else context.lineTo(vert.get_x(), vert.get_y());
      }
      context.closePath();
      if (fill) context.fill();
      context.stroke();
    }

    function drawCircle(center, radius, axis, fill) {
      var centerV = Box2D.wrapPointer(center, Box2D.b2Vec2);
      var axisV = Box2D.wrapPointer(axis, Box2D.b2Vec2);

      context.beginPath();
      context.arc(
        centerV.get_x(),
        centerV.get_y(),
        radius,
        0,
        2 * Math.PI,
        false
      );
      if (fill) context.fill();
      context.stroke();

      if (fill) {
        //render axis marker
        var vert2V = copyVec2(centerV);
        vert2V.op_add(scaledVec2(axisV, radius));
        context.beginPath();
        context.moveTo(centerV.get_x(), centerV.get_y());
        context.lineTo(vert2V.get_x(), vert2V.get_y());
        context.stroke();
      }
    }

    function drawTransform(transform) {
      var trans = Box2D.wrapPointer(transform, Box2D.b2Transform);
      var pos = trans.get_p();
      var rot = trans.get_q();

      context.save();
      context.translate(pos.get_x(), pos.get_y());
      context.scale(0.5, 0.5);
      context.rotate(rot.GetAngle());
      context.lineWidth *= 2;
      drawAxes(context);
      context.restore();
    }

    const queryCallback = new Box2D.JSQueryCallback();

    queryCallback.ReportFixture = fixturePtr => {
      var fixture = Box2D.wrapPointer(fixturePtr, Box2D.b2Fixture);
      if (fixture.GetBody().GetType() != Box2D.b2_dynamicBody)
        //mouse cannot drag static bodies around
        return true;
      if (!fixture.TestPoint(queryCallback.m_point)) return true;
      queryCallback.m_fixture = fixture;
      return false;
    };

    this.mouseJointGroundBody = this.world.CreateBody(new Box2D.b2BodyDef());
    var mouseDown = false;

    const startMouseJoint = () => {
      if (mouseJoint != null) return;

      // Make a small box.
      var aabb = new Box2D.b2AABB();
      var d = 0.001;
      aabb.set_lowerBound(
        new Box2D.b2Vec2(mousePosWorld.x - d, mousePosWorld.y - d)
      );
      aabb.set_upperBound(
        new Box2D.b2Vec2(mousePosWorld.x + d, mousePosWorld.y + d)
      );

      // Query the world for overlapping shapes.
      queryCallback.m_fixture = null;
      queryCallback.m_point = new Box2D.b2Vec2(
        mousePosWorld.x,
        mousePosWorld.y
      );
      this.world.QueryAABB(queryCallback, aabb);

      if (queryCallback.m_fixture) {
        var body = queryCallback.m_fixture.GetBody();
        var md = new Box2D.b2MouseJointDef();
        md.set_bodyA(this.mouseJointGroundBody);
        md.set_bodyB(body);
        md.set_target(new Box2D.b2Vec2(mousePosWorld.x, mousePosWorld.y));
        md.set_maxForce(1000 * body.GetMass());
        md.set_collideConnected(true);

        mouseJoint = Box2D.castObject(
          this.world.CreateJoint(md),
          Box2D.b2MouseJoint
        );
        body.SetAwake(true);
      }
    };

    function updateMousePos(canvas, evt) {
      var rect = canvas.getBoundingClientRect();
      const h = canvas.height / dppx;
      prevMousePosPixel = mousePosPixel;
      mousePosPixel = {
        x: evt.clientX - rect.left,
        y: h - (evt.clientY - rect.top)
      };
      mousePosWorld = getWorldPointFromPixelPoint(mousePosPixel);
    }

    function getWorldPointFromPixelPoint(pixelPoint) {
      const h = canvas.height / dppx;
      let p = {
        x: (pixelPoint.x - canvasOffset.x / dppx) / PTM,
        y: (pixelPoint.y - (h - canvasOffset.y / dppx)) / PTM
      };
      context.fillRect(p.x, p.y, 2 / PTM, 2 / PTM);
      return p;
    }

    function onMouseMove(canvas, evt) {
      updateMousePos(canvas, evt);
      if (mouseDown && mouseJoint != null) {
        mouseJoint.SetTarget(
          new Box2D.b2Vec2(mousePosWorld.x, mousePosWorld.y)
        );
      }
      if (scrolling && mouseDown) {
        const dx = prevMousePosPixel.x - mousePosPixel.x;
        const dy = prevMousePosPixel.y - mousePosPixel.y;
        canvasOffset.x -= dx * dppx;
        canvasOffset.y += dy * dppx;
      }
    }

    function onMouseOut(canvas, evt) {
      onMouseUp(canvas, evt);
    }

    function onMouseDown(canvas, evt) {
      updateMousePos(canvas, evt);
      if (!mouseDown) startMouseJoint();
      mouseDown = true;
      if (scrolling) {
        canvas.style.cursor = "grabbing";
      }
    }

    const onMouseUp = (canvas, evt) => {
      mouseDown = false;
      updateMousePos(canvas, evt);
      if (mouseJoint != null) {
        this.world.DestroyJoint(mouseJoint);
        mouseJoint = null;
      }
      if (scrolling) {
        canvas.style.cursor = "grab";
      }
    }

    function onWheel(e) {
      const focused = document.activeElement === canvas;
      if (e.ctrlKey) {
        e.preventDefault();
        const deltaZoom = -e.deltaY * (PTM / 100);
        const prevPTM = PTM;
        PTM = Math.min(maxPTM, Math.max(minPTM, PTM + deltaZoom));
        // mouse in terms of offset coordinates (top left is 0,0)
        function m2o(v) {
          return new Vector(v.x * dppx, -(dppx * v.y - canvas.height));
        }
        const offset = new Vector(canvasOffset.x, canvasOffset.y);
        const mouse = m2o(mousePosPixel);
        const newVec = mouse.add(
          offset.subtract(mouse).multiply(PTM / prevPTM)
        );
        canvasOffset.x = newVec.x;
        canvasOffset.y = newVec.y;
      } else if (focused) {
        e.preventDefault();
        canvasOffset.x -= e.deltaX * dppx;
        canvasOffset.y -= e.deltaY * dppx;
      }
    }

    addEventListeners();

    const debugDraw = new Box2D.JSDraw();
    debugDraw.DrawSegment = function(vert1, vert2, color) {
      setColorFromDebugDrawCallback(color);
      drawSegment(vert1, vert2);
    };

    debugDraw.DrawPolygon = function(vertices, vertexCount, color) {
      setColorFromDebugDrawCallback(color);
      drawPolygon(vertices, vertexCount, false);
    };

    debugDraw.DrawSolidPolygon = function(vertices, vertexCount, color) {
      setColorFromDebugDrawCallback(color);
      drawPolygon(vertices, vertexCount, true);
    };

    debugDraw.DrawCircle = function(center, radius, color) {
      setColorFromDebugDrawCallback(color);
      var dummyAxis = Box2D.b2Vec2(0, 0);
      drawCircle(center, radius, dummyAxis, false);
    };

    debugDraw.DrawSolidCircle = function(center, radius, axis, color) {
      setColorFromDebugDrawCallback(color);
      drawCircle(center, radius, axis, true);
    };

    debugDraw.DrawTransform = function(transform) {
      drawTransform(transform);
    };

    return debugDraw;
  }

  update(dt) {
    // dt in seconds
    this.world.Step(dt, 8, 3);
    this.draw();
  }

  draw() {
    // clear previous frame
    const ctx = this.ctx;
    const canvas = this.canvas;
    ctx.resetTransform();

    ctx.fillStyle = "#212121";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvasOffset.x, canvasOffset.y);
    ctx.scale(dppx * PTM, -dppx * PTM);
    ctx.lineWidth = 1 / (PTM * dppx);

    // draw axes for world origin
    ctx.strokeStyle = "rgb(192,0,0)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgb(0,192,0)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 1);
    ctx.stroke();

    ctx.fillStyle = "rgb(255,255,0)";
    this.world.DrawDebugData();

    if (mouseJoint != null) {
      //mouse joint is not drawn with regular joints in debug draw
      var p1 = mouseJoint.GetAnchorB();
      var p2 = mouseJoint.GetTarget();
      ctx.strokeStyle = "rgb(204,204,204)";
      ctx.beginPath();
      ctx.moveTo(p1.get_x(), p1.get_y());
      ctx.lineTo(p2.get_x(), p2.get_y());
      ctx.stroke();
    }
    ctx.restore();
  }
}
