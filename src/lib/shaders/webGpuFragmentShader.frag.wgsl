struct Options {
  iResolution : vec3f,
  uBaseColor : vec3f,
  uLineColor : vec3f,
  uSegmentWidth : f32,
  uGlowIntensity : f32,
  uLineHeightMultiplier : f32
};

//Define individual uniforms
@binding(0) @group(0) var<uniform> options : Options;
@binding(1) @group(0) var<uniform> uFft : array<vec4f, 10>;

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

//Function lineTo calculate line segment distance
fn lineSegment(p : vec2f, a : vec2f, b : vec2f) -> f32 {
  let pa = p - a;
  let ba = b - a;
  let h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return length(pa - ba * h);
}

//Function lineTo calculate distance for a single line
fn singleEq(pos : vec2f, aspectRatio : f32) -> f32 {
  var d : f32 = 1000.0;
  let maxStrength = 0.4;

  for (var i : i32 = 0; i < eqTotal; i++)
  {
    let x : f32 = rescale(f32(i) + 1, 0, f32(eqTotal + 1), 0, aspectRatio);
    var strength = abs(uFft[i][0]) * options.uLineHeightMultiplier;
    var y = clamp(strength, minStrength, maxStrength);
    let lineFrom : vec2f = vec2f (x, 0.5 + y);
    let lineTo : vec2f = vec2f (x, 0.5 - y);
    let dCurrent : f32 = lineSegment(pos, lineFrom, lineTo) - options.uSegmentWidth;
    d = min(d, dCurrent);
  }

  return d;
}

//Entry point
@fragment
fn main(@builtin(position) fragCoord : vec4f) -> @location(0) vec4f {
  var pos = vec2f(fragCoord.xy / options.iResolution.y);
  var aspectRatio = options.iResolution.x / options.iResolution.y;

  var d : f32 = singleEq(pos, aspectRatio);

  var value : f32 = (options.uGlowIntensity / d);
  var color : vec3f = options.uBaseColor * value;
  if (d < 0.0)
  {
    color = options.uLineColor;
    value = 1.0;
  }

  return vec4f(color, value);
}
