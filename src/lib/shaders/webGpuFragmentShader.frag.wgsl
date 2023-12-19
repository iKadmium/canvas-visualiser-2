struct Options {
  iResolution : vec3f,
  uBaseColor : vec3f,
  uLineColor : vec3f,
  uSegmentWidth : f32,
  uGlowIntensity : f32,
  uLineHeightMultiplier : f32
};

//Define individual uniforms
@group(0) @binding(0) var<uniform> options : Options;
@group(0) @binding(1) var<uniform> uFft : array<vec4f, 10>;
@group(0) @binding(2) var<storage, read> uSamples : array<f32>;

const eqStartOffset = 2;
const eqEndOffset = 1;
const eqRawTotal = 10;
const eqTotal = eqRawTotal - (eqStartOffset + eqEndOffset);
const minStrength = 0.0;

fn rescale(value : f32, originalMin : f32, originalMax : f32, newMin : f32, newMax : f32) -> f32{
  let originalRange = originalMax - originalMin;
  let originalPct = (value - originalMin) / originalRange;

  let newRange = newMax - newMin;
  let newValue = (originalPct * newRange) + newMin;
  return newValue;
}

fn sdCircle(p : vec2f, r : f32) -> f32 {
  return length(p) - r;
}

//Function lineTo calculate line segment distance
fn lineSegment(p : vec2f, a : vec2f, b : vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * h);
}

//Function lineTo calculate distance for a single line
fn singleEq(pos : vec2f, aspectRatio : f32) -> f32 {
  var eqDistance : f32 = 1000.0;
  let maxStrength = 0.4;

  for (var i : i32 = 0; i < eqTotal; i++)
  {
    let x : f32 = rescale(f32(i) + 1, 0, f32(eqTotal + 1), 0, aspectRatio);
    var strength = abs(uFft[i][0]) * options.uLineHeightMultiplier;
    var y = clamp(strength, minStrength, maxStrength);
    let lineFrom : vec2f = vec2f (x, 0.5 + y);
    let lineTo : vec2f = vec2f (x, 0.5 - y);
    let dCurrent : f32 = lineSegment(pos, lineFrom, lineTo) - options.uSegmentWidth;
    eqDistance = min(eqDistance, dCurrent);
  }

  return eqDistance;
}

fn eqColor(pos : vec2f, aspectRatio : f32) -> vec4f {
  var eqDistance : f32 = singleEq(pos, aspectRatio);

  var value : f32 = options.uGlowIntensity / eqDistance;
  var color : vec3f = options.uBaseColor * value;
  if (eqDistance < 0.0)
  {
    color = options.uLineColor;
    value = 1.0;
  }
  return vec4(color, value);
}

fn scopeColor(pos : vec2f, aspectRatio : f32) -> vec4f {
  var sampleIndex = rescale(pos.x, 0, aspectRatio, 0, 800);
  var sample = uSamples[i32(sampleIndex)];

  var y = 0.5 + sample / 2.0;
  var dist = 1.0 - smoothstep(0.01, 0.03, abs(y - pos.y));
  dist = min(2, 0.01 / abs(y - pos.y));
  return vec4f(options.uBaseColor * dist, dist);
}

fn blend(front : vec4f, back : vec4f) -> vec4f {
  var color = vec4f(clamp(back.rgb * (1 - front.a) + front.rgb * front.a, vec3f(0.0), vec3f(1.0)), clamp(back.a + front.a, 0.0, 1.0));
  return color;
}

//Entry point
@fragment
fn main(@builtin(position) fragCoord : vec4f) -> @location(0) vec4f {
  var pos = vec2f(fragCoord.xy / options.iResolution.y);
  var aspectRatio = options.iResolution.x / options.iResolution.y;

  var eqColor = eqColor(pos, aspectRatio);
  var scopeColor = scopeColor(pos, aspectRatio);

  var color = blend(eqColor, scopeColor);
  return color;
}
