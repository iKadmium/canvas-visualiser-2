struct Options {
  resolution : vec2f,
  eqGlowColor : vec3f,
  eqLineColor : vec3f,
  scopeColor : vec3f,
  waterColor : vec3f,
  eqSegmentWidth : f32,
  eqGlowIntensity : f32,
  eqLineHeightMultiplier : f32,
  eqEnabled : u32,
  scopeEnabled : u32,
  discoTeqEnabled : u32,
  wetEnabled : u32
};

//Define individual uniforms
@group(0) @binding(0) var<uniform> options : Options;
@group(0) @binding(1) var<uniform> uFft : array<vec4f, 10>;
@group(0) @binding(2) var<uniform> uTime : f32;
@group(0) @binding(3) var<storage, read> uSamples : array<f32>;

const eqStartOffset = 2;
const eqEndOffset = 1;
const eqRawTotal = 10;
const eqTotal = eqRawTotal - (eqStartOffset + eqEndOffset);
const minStrength = 0.0;
const scopeSmoothing = 50;
const speedMultiplier = 2.0 / 60.0;

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
    var strength = abs(uFft[i][0]) * options.eqLineHeightMultiplier;
    var y = clamp(strength, minStrength, maxStrength);
    let lineFrom : vec2f = vec2f (x, 0.5 + y);
    let lineTo : vec2f = vec2f (x, 0.5 - y);
    let dCurrent : f32 = lineSegment(pos, lineFrom, lineTo) - options.eqSegmentWidth;
    eqDistance = min(eqDistance, dCurrent);
  }

  return eqDistance;
}

fn eqColor(pos : vec2f, aspectRatio : f32) -> vec4f {
  var eqDistance : f32 = singleEq(pos, aspectRatio);

  var value : f32 = options.eqGlowIntensity / eqDistance;
  var color : vec3f = options.eqGlowColor * value;
  if (eqDistance < 0.0)
  {
    color = options.eqLineColor;
    value = 1.0;
  }
  return vec4(color, value);
}

fn meanSample(start : i32, end : i32) -> f32 {
  var total : f32 = 0.0;
  for(var i : i32 = start; i < end; i++)
  {
    total += uSamples[i];
  }
  var count = end - start;
  return total / f32(count);
}

fn meanAbsSample(start : i32, end : i32) -> f32 {
  var total : f32 = 0.0;
  for(var i : i32 = start; i < end; i++)
  {
    total += abs(uSamples[i]);
  }
  var count = end - start;
  return total / f32(count);
}

fn scopeColor(pos : vec2f, aspectRatio : f32) -> vec4f {
  var len = i32(arrayLength(&uSamples));
  var sampleIndex = i32(rescale(pos.x, 0, aspectRatio, 0, f32(len)));
  var sample = meanSample(max(0, sampleIndex - scopeSmoothing), min(sampleIndex + scopeSmoothing, len));

  var y = 0.5 + sample / 2.0;
  var dist = 1.0 - smoothstep(0.01, 0.03, abs(y - pos.y));
  dist = min(2, 0.01 / abs(y - pos.y));
  return vec4f(dist);
}

fn lerp(lerpFrom : f32, lerpTo : f32, amount : f32) -> f32{
  return lerpFrom * (1.0 - amount) + lerpTo * amount;
}

fn blend(back : vec4f, front : vec4f) -> vec4f {
  var color = vec4f(clamp(back.rgb * (1 - front.a) + front.rgb * front.a, vec3f(0.0), vec3f(1.0)), clamp(back.a + front.a, 0.0, 1.0));
  return color;
}

//Function to emulate wet
fn discoTeq(uv : vec2f, aspectRatio : f32, iTime : f32, strength : f32) -> vec4f {
  let offset : vec2f = vec2f(-aspectRatio / 2.0, -0.5);
  var O : vec4f = vec4f (0.0, 0.0, 0.0, 0.0);

    //Function to emulate for loop
  for (var i : f32 = 0.0; i <= 5.0; i += 1.0)
  {
    let t : f32 = i / 5.0;
    O += Line(uv + offset, 1.0 + t, strength, vec3(0.2 + t * 0.7, 0.2 + t * 0.4, 0.3), iTime);
  }

  return O;
}

//Function to emulate Line
fn Line(uv : vec2f, speed : f32, height : f32, col : vec3f, iTime : f32) -> vec4f {
  var y = uv.y + smoothstep(1.0, 0.0, abs(uv.x)) * sin(iTime * speed + uv.x) * height * 0.2;
  return vec4f (smoothstep(0.06 * smoothstep(0.2, 0.9, abs(uv.x)), 0.0, abs(y) - 0.004) * col, 1.0) * smoothstep(1.0, 0.3, abs(uv.x));
}

//Define a function to rotate 2D coordinates
fn rotate2D(r : f32) -> mat2x2f {
  return mat2x2f(
  cos(r), sin(r),
  -sin(r), cos(r)
  );
}

//Entry point for the fragment shader
fn wet(uv : vec2f, iTime : f32) -> vec4f {
    //Normalized pixel coordinates (from 0 to 1)
  var col : vec3f = vec3f(0.0);
  var t : f32 = iTime;

  var n : vec2f = vec2f(0.0);
  var q : vec2f;
  var N : vec2f = vec2f(0.0);
  var p : vec2f = uv + sin(t * 0.1) / 10.0;
  var S : f32 = 10.0;
  var m : mat2x2f = rotate2D(1.0);

    //Loop for the fractal pattern
  for (var j : f32 = 0.0; j < 30.0; j = j + 1.0)
  {
    p = p * m;
    n = n * m;
    q = p * S + j + n + t;
    n = n + sin(q);
    N = N + cos(q) / S;
    S = S * 1.2;
  }

    //Calculate final color using the fractal pattern
  col = vec3f(1.0, 1.0, 1.0) * pow((N.x + N.y + 0.2) + 0.005 / length(N), 2.1) * 3.0;

    //Output to screen
  return vec4f(col, 1.0);
}

fn screenComposite(layer : vec4f, opacity : f32) -> vec4f {
  return vec4f(layer.rgb, max(max(layer.r, layer.g), layer.b) * opacity);
}

//Entry point
@fragment
fn main(@builtin(position) fragCoord : vec4f) -> @location(0) vec4f {
  var pos = vec2f(fragCoord.xy / options.resolution.y);
  var aspectRatio = options.resolution.x / options.resolution.y;

  var len = i32(arrayLength(&uSamples));
  var meanStrength = clamp(meanAbsSample(0, len) * 5.0, 0.2, 1.0);

  var color = vec4f(0.0);
  if(options.wetEnabled == 1)
  {
    var wetColor = clamp(wet(pos, uTime * speedMultiplier), vec4f(0.0), vec4f(1.0)) * vec4f(options.waterColor, 1.0);
    color = blend(color, screenComposite(wetColor, 0.5));
  }
  if(options.discoTeqEnabled == 1)
  {
    var discoTeqColor = discoTeq(pos, aspectRatio, uTime * speedMultiplier, meanStrength);
    color = blend(color, screenComposite(discoTeqColor, 1.0));
  }
  if(options.scopeEnabled == 1)
  {
    var scopeColor = scopeColor(pos, aspectRatio) * vec4f(options.scopeColor, 1.0);
    color = blend(color, scopeColor * meanStrength);
  }
  if(options.eqEnabled == 1)
  {
    var eqColor = eqColor(pos, aspectRatio);
    color = blend(color, eqColor);
  }

  return color;
}
