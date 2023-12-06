precision highp float;

uniform vec3 iResolution;
uniform float uFft[10];
uniform vec3 uBaseColor;
uniform vec3 uLineColor;
const int fftCount = 10;
const int fftLeftSkipCount = 2;
const int fftRightSkipCount = 0;
const float maxHeight = 0.4;
uniform float uSegmentWidth;
uniform float uGlowIntensity;
uniform float uLineHeightMultiplier;

float lineSegment(in vec2 p, in vec2 a, in vec2 b) {
    vec2 ba = b - a;
    vec2 pa = p - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    return length(pa - h * ba);
}

float singleEq(vec2 pos) {
    float d = 1000.;

    for(int i = fftLeftSkipCount; i < (fftCount - fftRightSkipCount); i++) {
        float x = ((float(i + 1 - fftLeftSkipCount) / float((fftCount - fftLeftSkipCount - fftRightSkipCount) + 2)) * 2.0) - 1.0 + .075;
        float y = min(uFft[i] * uLineHeightMultiplier, maxHeight);
        vec2 from = vec2(x, -y);
        vec2 to = vec2(x, y);
        float dCurrent = lineSegment(pos, from, to) - uSegmentWidth;
        d = min(d, dCurrent);
    }

    return d;
}

float mirrorEq(vec2 pos) {
    float d = 1000.;

    for(int i = 0; i < fftCount; i++) {
        float x = ((float(i + 1) / float((fftCount + 2) * 2)) * 10.0) - 4.4;
        vec2 from = vec2(x, -uFft[i]);
        vec2 to = vec2(x, uFft[i]);
        float dCurrent = lineSegment(pos, from, to) - uSegmentWidth;
        d = min(d, dCurrent);
    }

    for(int i = 0; i < fftCount; i++) {
        float x = 4.5 - ((float(i + 1) / float((fftCount + 2) * 2)) * 10.0) - .1;
        vec2 from = vec2(x, -uFft[i]);
        vec2 to = vec2(x, uFft[i]);
        float dCurrent = lineSegment(pos, from, to) - uSegmentWidth;
        d = min(d, dCurrent);
    }
    return d;
}

void main(void) {
    vec2 pos = (gl_FragCoord.xy - iResolution.xy * .5) / iResolution.y;
    float iTime = 0.;

    float d = singleEq(pos);

    float value = (uGlowIntensity / d);
    //value = clamp(value, 0.0, 1.0);
    vec3 color = uBaseColor * value;
    if(d < 0.) {
        color = uLineColor;
        value = 1.0;
    }
    gl_FragColor = vec4(color, value);

}
