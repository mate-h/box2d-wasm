import { Box2D } from "../game";
import { noop } from "svelte/internal";

Object.prototype.hasOwnProperty = function(property) {
  return typeof this[property] !== "undefined";
};

function createChainShape(vertices, closedLoop) {
  var shape = new Box2D.b2ChainShape();
  // var buffer = Box2D.allocate(vertices.length * 8, "float", Box2D.ALLOC_STACK);
  var buffer = Box2D._malloc(vertices.length * 8);
  var offset = 0;
  for (var i = 0; i < vertices.length; i++) {
    // Box2D.setValue(buffer + (offset), vertices[i].get_x(), 'float'); // x
    Box2D.HEAPF32[(buffer + offset) >> 2] = vertices[i].get_x();
    // Box2D.setValue(buffer + (offset + 4), vertices[i].get_y(), 'float'); // y
    Box2D.HEAPF32[(buffer + (offset + 4)) >> 2] = vertices[i].get_y();
    offset += 8;
  }
  var ptr_wrapped = Box2D.wrapPointer(buffer, Box2D.b2Vec2);
  if (closedLoop) shape.CreateLoop(ptr_wrapped, vertices.length);
  else shape.CreateChain(ptr_wrapped, vertices.length);
  return shape;
}

function createPolygonShape(vertices) {
  var shape = new Box2D.b2PolygonShape();
  // var buffer = Box2D.allocate(vertices.length * 8, 'float', Box2D.ALLOC_STACK);
  var buffer = Box2D._malloc(vertices.length * 8);
  var offset = 0;
  for (var i = 0; i < vertices.length; i++) {
    // Box2D.setValue(buffer + (offset), vertices[i].get_x(), 'float'); // x
    Box2D.HEAPF32[(buffer + offset) >> 2] = vertices[i].get_x();
    // Box2D.setValue(buffer + (offset + 4), vertices[i].get_y(), 'float'); // y
    Box2D.HEAPF32[(buffer + (offset + 4)) >> 2] = vertices[i].get_y();
    offset += 8;
  }
  var ptr_wrapped = Box2D.wrapPointer(buffer, Box2D.b2Vec2);
  shape.Set(ptr_wrapped, vertices.length);
  return shape;
}

function loadBodyFromRUBE(bodyJso, world) {
  if (!bodyJso.hasOwnProperty("type")) {
    console.log("Body does not have a 'type' property");
    return null;
  }

  const bd = new Box2D.b2BodyDef();
  if (bodyJso.type == "dynamic" || bodyJso.type == 2)
    bd.set_type(Box2D.b2_dynamicBody);
  else if (bodyJso.type == "kinetic" || bodyJso.type == 1)
    bd.set_type(Box2D.b2_kinematicBody);
  else bd.set_type(Box2D.b2_staticBody);

  bd.set_angle(bodyJso.angle || 0);
  bd.set_angularVelocity(bodyJso.angularVelocity || 0);
  bd.set_angularDamping(bodyJso.angularDamping || 0);
  bd.set_awake(bodyJso.awake || false);
  bd.set_bullet(bodyJso.bullet || false);
  bd.set_fixedRotation(bodyJso.fixedRotation || false);
  bd.set_linearDamping(bodyJso.linearDamping || false);

  if (
    bodyJso.hasOwnProperty("linearVelocity") &&
    bodyJso.linearVelocity instanceof Object
  )
    bd.set_linearVelocity(parseVec(bodyJso.linearVelocity));
  else bd.set_linearVelocity(new Box2D.b2Vec2(0, 0));

  if (bodyJso.hasOwnProperty("position") && bodyJso.position instanceof Object)
    bd.set_position(parseVec(bodyJso.position));
  else bd.set_position(new Box2D.b2Vec2(0, 0));

  if (
    bodyJso.hasOwnProperty("gravityScale") &&
    !isNaN(parseFloat(bodyJso.gravityScale)) &&
    isFinite(bodyJso.gravityScale)
  ) {
    bd.set_gravityScale(bodyJso.gravityScale);
  } else {
    bd.set_gravityScale(1);
  }

  const body = world.CreateBody(bd);

  const md = new Box2D.b2MassData();
  md.set_mass(bodyJso["massData-mass"] || 0);
  if (
    bodyJso.hasOwnProperty("massData-center") &&
    bodyJso["massData-center"] instanceof Object
  )
    md.set_center(parseVec(bodyJso["massData-center"]));
  else md.set_center(new Box2D.b2Vec2(0, 0));

  md.set_I(bodyJso["massData-I"] || 0);

  body.SetMassData(md);

  if (bodyJso.hasOwnProperty("fixture")) {
    for (let k = 0; k < bodyJso["fixture"].length; k++) {
      const fixtureJso = bodyJso["fixture"][k];
      loadFixtureFromRUBE(body, fixtureJso);
    }
  }
  if (bodyJso.hasOwnProperty("name")) body.name = bodyJso.name;
  if (bodyJso.hasOwnProperty("id")) body.id = bodyJso.id;
  if (bodyJso.hasOwnProperty("customProperties"))
    body.customProperties = bodyJso.customProperties;
  return body;
}

function loadFixtureFromRUBE(body, fixtureJso) {
  const fd = new Box2D.b2FixtureDef();
  fd.set_density(fixtureJso.density || 0);
  fd.set_friction(fixtureJso.friction || 0);
  fd.set_restitution(fixtureJso.restitution || 0);
  fd.set_isSensor(fixtureJso.sensor || 0);

  const filter = new Box2D.b2Filter();

  filter.set_categoryBits(fixtureJso["filter-categoryBits"] || 1);
  filter.set_maskBits(fixtureJso["filter-maskBits"] || 65535);
  filter.set_groupIndex(fixtureJso["filter-groupIndex"] || 0);

  fd.set_filter(filter);
  if (!fixtureJso.shapes) {
    if (fixtureJso.circle)
      fixtureJso.shapes = [{ type: "circle", ...fixtureJso.circle }];
    else if (fixtureJso.chain)
      fixtureJso.shapes = [{ type: "chain", ...fixtureJso.chain }];
    else if (fixtureJso.polygon) {
      fixtureJso.shapes = [{ type: "polygon" }];
      fixtureJso.vertices = fixtureJso.polygon.vertices;
    }
  }
  fixtureJso.shapes.forEach(shapeJso => {
    if (shapeJso.type === "circle") {
      let shape = new Box2D.b2CircleShape();

      shape.set_m_radius(shapeJso.radius || 0);
      if (shapeJso.center) shape.set_m_p(parseVec(shapeJso.center));
      else shape.set_m_p(new Box2D.b2Vec2(0, 0));

      fd.set_shape(shape);

      const fixture = body.CreateFixture(fd);
      if (fixtureJso.name) fixture.name = fixtureJso.name;
    } else if (shapeJso.type === "polygon") {
      const verts = [];
      for (let v = 0; v < fixtureJso.vertices.x.length; v++) {
        verts.push(
          new Box2D.b2Vec2(fixtureJso.vertices.x[v], fixtureJso.vertices.y[v])
        );
      }

      if (3 <= verts.length && verts.length <= 8) {
        let shape = createPolygonShape(verts);
        fd.set_shape(shape);
        const fixture = body.CreateFixture(fd);

        if (fixture && fixtureJso.name) fixture.name = fixtureJso.name;
      } else {
        // TODO: apply polygon decomposition ?
      }

      // }
    } else if (shapeJso.type === "chain") {
      const verts = [];
      for (let v = 0; v < fixtureJso.chain.vertices.x.length; v++)
        verts.push(
          new Box2D.b2Vec2(
            fixtureJso.chain.vertices.x[v],
            fixtureJso.chain.vertices.y[v]
          )
        );

      let shape = createChainShape(verts);
      fd.set_shape(shape);

      const fixture = body.CreateFixture(fd);
      if (fixtureJso.name) fixture.name = fixtureJso.name;
    } else if (shapeJso.type === "line") {
      const shape = new Box2D.b2EdgeShape();
      const verts = fixtureJso.vertices;
      shape.Set(
        new Box2D.b2Vec2(verts.x[0], verts.y[0]),
        new Box2D.b2Vec2(verts.x[1], verts.y[1])
      );
      fd.set_shape(shape);
      const fixture = body.CreateFixture(fd);
      if (fixtureJso.name) fixture.name = fixtureJso.name;
    } else {
      console.log("Could not find shape type for fixture");
    }
  });
}

function getVectorValue(val) {
  if (val instanceof Object) return val;
  else return { x: 0, y: 0 };
}

function parseVec(obj) {
  if (obj instanceof Object) return new Box2D.b2Vec2(obj.x || 0, obj.y || 0);
  else return new Box2D.b2Vec2(0, 0);
}

function loadJointFromRUBE(jointJso, world, loadedBodies) {
  if (!jointJso.hasOwnProperty("type")) {
    console.log("Joint does not have a 'type' property");
    return null;
  }
  if (jointJso.bodyA >= loadedBodies.length) {
    console.log("Index for bodyA is invalid: " + jointJso.bodyA);
    return null;
  }
  if (jointJso.bodyB >= loadedBodies.length) {
    console.log("Index for bodyB is invalid: " + jointJso.bodyB);
    return null;
  }

  let joint = null;
  function setCommonProps(jd) {
    jd.set_bodyA(
      loadedBodies.find(b => b.id === jointJso.bodyA) ||
        loadedBodies[jointJso.bodyA]
    );
    jd.set_bodyB(
      loadedBodies.find(b => b.id === jointJso.bodyB) ||
        loadedBodies[jointJso.bodyB]
    );
    jd.set_collideConnected(jointJso.collideConnected || false);

    return jd;
  }
  if (jointJso.type == "revolute") {
    let jd = new Box2D.b2RevoluteJointDef();
    jd = setCommonProps(jd);
    jd.set_localAnchorA(parseVec(jointJso.anchorA));
    jd.set_localAnchorB(parseVec(jointJso.anchorB));
    jd.set_enableLimit(jointJso.enableLimit || false);
    jd.set_enableMotor(jointJso.enableMotor || false);
    jd.set_lowerAngle(jointJso.lowerLimit || 0);
    jd.set_maxMotorTorque(jointJso.maxMotorTorque || 0);
    jd.set_motorSpeed(jointJso.motorSpeed || 0);
    jd.set_referenceAngle(jointJso.refAngle || 0);
    jd.set_upperAngle(jointJso.upperLimit || 0);

    joint = world.CreateJoint(jd);
  } else if (jointJso.type == "distance") {
    let jd = new Box2D.b2DistanceJointDef();
    jd = setCommonProps(jd);
    jd.set_localAnchorA(parseVec(jointJso.anchorA));
    jd.set_localAnchorB(parseVec(jointJso.anchorB));
    jd.set_dampingRatio(jointJso.dampingRatio || 0);
    jd.set_frequencyHz(jointJso.frequency || 0);
    jd.set_length(jointJso.length || 0);

    joint = world.CreateJoint(jd);
  } else if (jointJso.type == "rope") {
    let jd = new Box2D.b2RopeJointDef();

    jd = setCommonProps(jd);
    jd.set_localAnchorA(parseVec(jointJso.anchorA));
    jd.set_localAnchorB(parseVec(jointJso.anchorB));
    jd.set_maxLength(jointJso.maxLength || 0);
    joint = world.CreateJoint(jd);
  } else if (jointJso.type == "motor") {
    if (Box2D.b2MotorJointDef) {
      let jd = new Box2D.b2MotorJointDef();

      jd = setCommonProps(jd);

      jd.set_linearOffset(parseVec(jointJso.anchorA));
      jd.set_angularOffset(jointJso.refAngle || 0);
      jd.set_maxForce(jointJso.maxForce || 0);
      jd.set_maxTorque(jointJso.maxTorque || 0);
      jd.set_correctionFactor(jointJso.correctionFactor || 0);

      joint = world.CreateJoint(jd);
    } else {
      console.log("This version of box2d doesn't support motor joints");
    }
  } else if (jointJso.type == "prismatic") {
    let jd = new Box2D.b2PrismaticJointDef();
    jd = setCommonProps(jd);
    jd.set_localAnchorA(parseVec(jointJso.anchorA));
    jd.set_localAnchorB(parseVec(jointJso.anchorB));
    jd.set_enableLimit(jointJso.enableLimit || false);
    jd.set_enableMotor(jointJso.enableMotor || false);
    jd.set_localAxisA(parseVec(jointJso.localAxisA));
    jd.set_lowerTranslation(jointJso.lowerLimit || 0);
    jd.set_maxMotorForce(jointJso.maxMotorForce || 0);
    jd.set_motorSpeed(jointJso.motorSpeed || 0);
    jd.set_referenceAngle(jointJso.refAngle || 0);
    jd.set_upperTranslation(jointJso.upperLimit || 0);
    joint = world.CreateJoint(jd);
  } else if (jointJso.type == "wheel") {
    let jd = new Box2D.b2WheelJointDef();
    jd = setCommonProps(jd);
    jd.set_localAnchorA(parseVec(jointJso.anchorA));
    jd.set_localAnchorB(parseVec(jointJso.anchorB));
    jd.set_enableMotor(jointJso.enableMotor || false);
    jd.set_localAxisA(parseVec(jointJso.localAxisA));
    jd.set_maxMotorTorque(jointJso.maxMotorTorque || 0);
    jd.set_motorSpeed(jointJso.motorSpeed || 0);
    jd.set_dampingRatio(jointJso.springDampingRatio || 0);
    jd.set_frequencyHz(jointJso.springFrequency || 0);
    joint = world.CreateJoint(jd);
  } else if (jointJso.type == "friction") {
    let jd = new Box2D.b2FrictionJointDef();

    jd = setCommonProps(jd);
    jd.set_localAnchorA(parseVec(jointJso.anchorA));
    jd.set_localAnchorB(parseVec(jointJso.anchorB));
    jd.set_maxForce(jointJso.maxForce || 0);
    jd.set_maxTorque(jointJso.maxTorque || 0);
    joint = world.CreateJoint(jd);
  } else if (jointJso.type == "weld") {
    let jd = new Box2D.b2WeldJointDef();

    jd = setCommonProps(jd);
    jd.set_localAnchorA(parseVec(jointJso.anchorA));
    jd.set_localAnchorB(parseVec(jointJso.anchorB));
    jd.set_referenceAngle(jointJso.refAngle || 0);
    jd.set_dampingRatio(jointJso.dampingRatio || 0);
    jd.set_frequencyHz(jointJso.frequency || 0);
    joint = world.CreateJoint(jd);
  } else {
    console.log("Unsupported joint type: " + jointJso.type);
    console.log(jointJso);
  }
  if (joint && jointJso.name) joint.name = jointJso.name;
  return joint;
}

function makeClone(obj) {
  const newObj = obj instanceof Array ? [] : {};
  for (let i in obj) {
    if (obj[i] && typeof obj[i] == "object") newObj[i] = makeClone(obj[i]);
    else newObj[i] = obj[i];
  }
  return newObj;
}

//load the scene into an already existing world constiable
export function loadWorld(worldJso, world) {
  let success = true;

  const loadedBodies = [];
  if (worldJso.hasOwnProperty("metabody")) {
    for (let i = 0; i < worldJso.metabody.length; i++) {
      const bodyJso = worldJso.metabody[i];
      const body = loadBodyFromRUBE(bodyJso, world);
      if (body) loadedBodies.push(body);
      else success = false;
    }
  }

  const loadedJoints = [];
  if (worldJso.hasOwnProperty("metajoint")) {
    const l = worldJso.metajoint.length;
    // const l = 1;
    for (let i = 0; i < l; i++) {
      const jointJso = worldJso.metajoint[i];
      const joint = loadJointFromRUBE(jointJso, world, loadedBodies);
      if (joint) loadedJoints.push(joint);
      //else
      //    success = false;
    }
  }

  return success;
}

//create a world constiable and return it if loading succeeds
export function createWorld(rubeFile) {
  const m = rubeFile.metaworld || rubeFile;
  let gravity = new Box2D.b2Vec2(0, 0);
  if (m.hasOwnProperty("gravity") && m.gravity instanceof Object)
    gravity = new Box2D.b2Vec2(m.gravity.x, m.gravity.y);
  const world = new Box2D.b2World(gravity);
  if (!loadWorld(m, world)) return false;
  return world;
}

function getNamedBodies(world, name) {
  const bodies = [];
  for (let b = world.m_bodyList; b; b = b.m_next) {
    if (b.name == name) bodies.push(b);
  }
  return bodies;
}

function getNamedFixtures(world, name) {
  const fixtures = [];
  for (let b = world.m_bodyList; b; b = b.m_next) {
    for (let f = b.m_fixtureList; f; f = f.m_next) {
      if (f.name == name) fixtures.push(f);
    }
  }
  return fixtures;
}

function getNamedJoints(world, name) {
  const joints = [];
  for (let j = world.m_jointList; j; j = j.m_next) {
    if (j.name == name) joints.push(j);
  }
  return joints;
}

//custom properties
function getBodiesByCustomProperty(
  world,
  propertyType,
  propertyName,
  valueToMatch
) {
  const bodies = [];
  for (let b = world.m_bodyList; b; b = b.m_next) {
    if (!b.hasOwnProperty("customProperties")) continue;
    for (let i = 0; i < b.customProperties.length; i++) {
      if (!b.customProperties[i].hasOwnProperty("name")) continue;
      if (!b.customProperties[i].hasOwnProperty(propertyType)) continue;
      if (
        b.customProperties[i].name == propertyName &&
        b.customProperties[i][propertyType] == valueToMatch
      )
        bodies.push(b);
    }
  }
  return bodies;
}

function hasCustomProperty(item, propertyType, propertyName) {
  if (!item.hasOwnProperty("customProperties")) return false;
  for (let i = 0; i < item.customProperties.length; i++) {
    if (!item.customProperties[i].hasOwnProperty("name")) continue;
    if (!item.customProperties[i].hasOwnProperty(propertyType)) continue;
    return true;
  }
  return false;
}

function getCustomProperty(item, propertyType, propertyName, defaultValue) {
  if (!item.hasOwnProperty("customProperties")) return defaultValue;
  for (let i = 0; i < item.customProperties.length; i++) {
    if (!item.customProperties[i].hasOwnProperty("name")) continue;
    if (!item.customProperties[i].hasOwnProperty(propertyType)) continue;
    if (item.customProperties[i].name == propertyName)
      return item.customProperties[i][propertyType];
  }
  return defaultValue;
}
