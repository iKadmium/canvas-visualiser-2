precision highp float;

uniform vec3 iResolution;
uniform float uFft[10];
uniform vec3 uBaseColor;
const int fftCount = 10;
uniform float uSegmentWidth;
uniform float uGlowIntensity;
const float maxHeight = 0.25;

float lineSegment(in vec2 p, in vec2 a, in vec2 b) {
    vec2 ba = b - a;
    vec2 pa = p - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    return length(pa - h * ba);
}

float singleEq(vec2 pos) {
    float d = 1000.;

    for(int i = 0; i < fftCount; i++) {
        float x = ((float(i + 1) / float(fftCount + 2)) * 2.0) - 1.0 + .075;
        vec2 from = vec2(x, -(uFft[i] * maxHeight));
        vec2 to = vec2(x, (uFft[i] * maxHeight));
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
    vec3 color = uBaseColor * value;

    gl_FragColor = vec4(color, value);
}
