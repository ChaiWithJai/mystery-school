import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleMovement, normalizeMovementState, validateMovementProposal, sampleMovementComparison, mountMovementLab } from '../public/movement-lab.js';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('cubic endpoints have zero velocity and the specified one-sided accelerations', () => {
  const input = { distance: .4, duration: 2 };
  const start = sampleMovement(0, input);
  near(start.position, 0); near(start.velocity, 0); near(start.acceleration, .6);
  const end = sampleMovement(2, input);
  near(end.position, .4); near(end.velocity, 0); near(end.acceleration, -.6);
});

test('cubic midpoint is half distance, peak speed 1.5 D/T, zero acceleration', () => {
  const mid = sampleMovement(1, { duration: 2, distance: .4 });
  near(mid.position, .2); near(mid.velocity, .3); near(mid.acceleration, 0);
  for (let i = 0; i <= 100; i++) assert.ok(sampleMovement(i / 50).velocity <= mid.velocity + 1e-12);
});

test('doubling duration halves velocity and quarters acceleration at matching progress', () => {
  for (const shape of ['cubic', 'quintic']) {
    const fast = sampleMovement(.25, { duration: 1, distance: .6, shape });
    const slow = sampleMovement(.5, { duration: 2, distance: .6, shape });
    near(fast.position, slow.position); near(slow.velocity, fast.velocity / 2); near(slow.acceleration, fast.acceleration / 4);
  }
});

test('rest strictly outside the interval has zero velocity and acceleration', () => {
  for (const shape of ['cubic', 'quintic']) {
    assert.deepEqual(sampleMovement(-.001, { shape }), { position: 0, velocity: 0, acceleration: 0 });
    assert.deepEqual(sampleMovement(2.001, { shape }), { position: .4, velocity: 0, acceleration: 0 });
  }
});

test('quintic joins rest with zero acceleration and has the defined midpoint speed', () => {
  for (const t of [0, 2]) {
    const point = sampleMovement(t, { shape: 'quintic' });
    near(point.position, t === 0 ? 0 : .4); near(point.velocity, 0); near(point.acceleration, 0);
  }
  const mid = sampleMovement(1, { shape: 'quintic' });
  near(mid.position, .2); near(mid.velocity, 1.875 * .4 / 2); near(mid.acceleration, 0);
});

test('analytic derivatives match independent central finite differences', () => {
  const dt = 1e-5;
  for (const shape of ['cubic', 'quintic']) for (const t of [.2, .6, 1, 1.5, 1.8]) {
    const before = sampleMovement(t - dt, { shape });
    const after = sampleMovement(t + dt, { shape });
    const point = sampleMovement(t, { shape });
    near(point.velocity, (after.position - before.position) / (2 * dt), 1e-8);
    near(point.acceleration, (after.velocity - before.velocity) / (2 * dt), 1e-8);
  }
});

test('both paths are monotonic, bounded and scale linearly with distance', () => {
  for (const shape of ['cubic', 'quintic']) {
    let prior = 0;
    for (let i = 0; i <= 100; i++) {
      const sample = sampleMovement(i / 50, { shape });
      assert.ok(sample.position >= prior - 1e-12 && sample.position <= .4 + 1e-12);
      const doubled = sampleMovement(i / 50, { shape, distance: .8 });
      for (const key of ['position', 'velocity', 'acceleration']) near(doubled[key], 2 * sample[key]);
      prior = sample.position;
    }
  }
});

test('invalid physical inputs are rejected', () => {
  for (const duration of [0, -1, NaN, Infinity, '2']) assert.throws(() => sampleMovement(0, { duration }), RangeError);
  for (const distance of [-1, NaN, Infinity, '.4']) assert.throws(() => sampleMovement(0, { distance }), RangeError);
  for (const time of [NaN, Infinity, '1']) assert.throws(() => sampleMovement(time), RangeError);
  assert.throws(() => sampleMovement(0, { shape: 'unknown' }), RangeError);
});

test('artifact state restores inputs but never resumes playback automatically', () => {
  const saved = { duration: 3, distance: .6, shape: 'quintic', time: 1.7, playing: true, assistanceOpen: true };
  const restored = normalizeMovementState(saved);
  assert.deepEqual(restored, { ...saved, playing: false, compare_shape: 'quintic', view: 'position' });
  assert.deepEqual(normalizeMovementState(JSON.parse(JSON.stringify(restored))), restored);
  assert.equal(saved.playing, true);
});

test('comparison shares time, distance and duration but preserves distinct shape math', () => {
  const state=normalizeMovementState({duration:2,distance:.4,shape:'cubic',compare_shape:'quintic',view:'velocity'});
  const pair=sampleMovementComparison(1,state);
  near(pair.candidate.position,.2);near(pair.reference.position,.2);
  near(pair.candidate.velocity,.3);near(pair.reference.velocity,.375);
  assert.deepEqual(sampleMovementComparison(3,state).reference,{position:.4,velocity:0,acceleration:0});
});

test('fixed comparison axes contain every supported shape and bounded input',()=>{
  for(const view of ['position','velocity','acceleration'])for(const duration of [1,2,4])for(const distance of [.1,.4,1]){
    const state=normalizeMovementState({view,duration,distance});
    for(let i=0;i<=100;i++){
      const {candidate,reference,axis}=sampleMovementComparison(4*i/100,state);
      for(const value of [candidate[view],reference[view]])assert.ok(value>=axis.min-1e-10&&value<=axis.max+1e-10);
      assert.deepEqual(axis,sampleMovementComparison(0,normalizeMovementState({view})).axis);
    }
  }
});

test('strict proposals reject invalid or missing fields without coercion',()=>{
  const good={duration:2,distance:.4,shape:'cubic',compare_shape:'quintic',view:'acceleration'};
  assert.deepEqual(validateMovementProposal(good),good);
  for(const patch of [{duration:0},{duration:4.1},{duration:'2'},{distance:.09},{distance:1.1},{distance:NaN},{shape:'punch'},{compare_shape:undefined},{view:'force'},{unexpected:true}])assert.throws(()=>validateMovementProposal({...good,...patch}),RangeError);
  assert.throws(()=>validateMovementProposal(null),RangeError);
});

function movementDOM(){
  const elements=[],frames=new Map();let nextFrame=0;
  const doc={hidden:false,addEventListener(){},removeEventListener(){},defaultView:{matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>{frames.set(++nextFrame,fn);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id)}};
  doc.createElement=tag=>{
    const element={tag,ownerDocument:doc,children:[],attributes:{},handlers:{},textContent:'',
      append(...items){this.children.push(...items);items.forEach(item=>{item.parent=this;});},
      prepend(...items){this.children.unshift(...items);items.forEach(item=>{item.parent=this;});},
      setAttribute(key,value){this.attributes[key]=String(value);},
      addEventListener(type,fn){(this.handlers[type]??=new Set()).add(fn);},removeEventListener(type,fn){this.handlers[type]?.delete(fn);},
      fire(type){this.handlers[type]?.forEach(fn=>fn({target:this}));},
      remove(){if(this.parent)this.parent.children=this.parent.children.filter(item=>item!==this);}};
    elements.push(element);return element;
  };
  doc.createElementNS=(_,tag)=>doc.createElement(tag);doc.createTextNode=text=>({textContent:text});
  return {container:doc.createElement('main'),elements,frames};
}

test('handle applies, serializes, and exactly undoes full state including deterministic derived fields',()=>{
  const {container,elements}=movementDOM(),changes=[],events=[];
  const handle=mountMovementLab(container,{initialState:{time:1},onChange:s=>changes.push(s),onEvent:(...args)=>events.push(args)});
  assert.equal(typeof handle,'function');assert.equal(changes.length,1);assert.equal(events.length,0);
  const before=handle.getState();
  handle.setState({...before,duration:3,distance:.7,shape:'quintic',compare_shape:'cubic',view:'acceleration',time:1.5,position:999});
  const after=handle.getState();near(after.position,.35);assert.equal(after.compare_shape,'cubic');assert.equal(after.view,'acceleration');
  assert.deepEqual(JSON.parse(JSON.stringify(after)),after);
  handle.setState(before);assert.deepEqual(handle.getState(),before);assert.equal(events.length,0);
  const copy=handle.getState();copy.units.position='bad';assert.equal(handle.getState().units.position,'m');
  const view=elements.find(e=>e.id?.endsWith('-view'));view.value='velocity';view.fire('change');assert.equal(handle.getState().view,'velocity');
  assert.equal(events.at(-1)[0],'movement.view');
  handle();assert.equal(container.children.length,0);assert.throws(()=>handle.setState(before),/disposed/);
});

test('invalid setState is atomic and does not cancel current playback',()=>{
  const {container,frames}=movementDOM();const handle=mountMovementLab(container);
  handle.setState({...handle.getState(),time:.5,playing:true});const before=handle.getState();
  assert.equal(frames.size,1);
  assert.throws(()=>handle.setState({...before,compare_shape:'invalid'}),RangeError);
  assert.deepEqual(handle.getState(),before);assert.equal(frames.size,1);
  handle.setState({...before,playing:false});assert.equal(frames.size,0);handle();
});

test('malformed restore state is bounded and JSON safe', () => {
  const restored = normalizeMovementState({ duration: -10, distance: Infinity, shape: 'bad', time: 999 });
  assert.equal(restored.duration, 1); assert.equal(restored.time, 1); assert.equal(restored.distance, .4); assert.equal(restored.shape, 'cubic');
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), restored);
  assert.equal(normalizeMovementState(null).duration, 2);
});
