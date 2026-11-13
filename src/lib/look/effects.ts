import { GlitchEffect, Effect, EffectAttribute, BlendFunction } from 'postprocessing';
import { Uniform, Vector4 } from 'three';
import { stageInk } from './stageInk';

/**
 * INK: a blur followed by a threshold on the alpha channel. Strokes swell and strokes that are close
 * join, and the outline stays soft. Only alpha is thresholded: where the blurred alpha is 0 the output is
 * 0 in every channel, so a transparent frame stays transparent.
 *
 * The buffer holds premultiplied colour (three blends into it that way): the blurred colour is divided by
 * the blurred alpha to get the stroke colour back, then premultiplied again with the new alpha.
 */
const INK_FRAGMENT = /* glsl */ `
uniform float radius; // fraction of the frame height
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    float r = radius * resolution.y;
    if (r < 0.01) {
        outputColor = inputColor;
        return;
    }
    vec4 acc = vec4(0.0);
    const int N = 64;
    for (int i = 0; i < N; i++) {
        float fi = float(i) + 0.5;
        float rr = sqrt(fi / float(N));
        float th = fi * 2.39996323;
        acc += texture2D(inputBuffer, uv + vec2(cos(th), sin(th)) * rr * r * texelSize);
    }
    acc /= float(N);
    float a = smoothstep(0.06, 0.55, acc.a);
    vec3 stroke = acc.rgb / max(acc.a, 0.0001);
    outputColor = vec4(stroke * a, a);
}
`;

export class InkEffect extends Effect {
    /** Returns the blur radius as a fraction of the frame height; read once per rendered frame. */
    radiusSource: () => number = () => 0;

    constructor() {
        super('InkEffect', INK_FRAGMENT, {
            blendFunction: BlendFunction.NORMAL,
            attributes: EffectAttribute.CONVOLUTION,
            uniforms: new Map([['radius', new Uniform(0)]]),
        });
    }

    update(): void {
        this.uniforms.get('radius')!.value = this.radiusSource();
    }
}

/**
 * INTERFERENCE: the library's glitch with a limit. The original displaces bands and columns that run across
 * the whole frame, plus a warp of every pixel. Here the displacement only applies inside a window of the
 * frame that lies on the text and is half as tall as the text (a different part of the text each frame),
 * so a band is only ever a part of the text and never reaches the edges of the frame.
 */
const BAND_FRACTION = 0.5;

const BANDED_GLITCH_FRAGMENT = /* glsl */ `
uniform lowp sampler2D perturbationMap;
uniform bool active;
uniform float columns;
uniform float random;
uniform vec2 seeds;
uniform vec2 distortion;
uniform vec4 region; // x0, y0, x1, y1 in UV
void mainUv(inout vec2 uv) {
    if (active && uv.x > region.x && uv.x < region.z && uv.y > region.y && uv.y < region.w) {
        if (uv.y < distortion.x + columns && uv.y > distortion.x - columns * random) {
            float sx = clamp(ceil(seeds.x), 0.0, 1.0);
            uv.y = sx * (1.0 - (uv.y + distortion.y)) + (1.0 - sx) * distortion.y;
        }
        if (uv.x < distortion.y + columns && uv.x > distortion.y - columns * random) {
            float sy = clamp(ceil(seeds.y), 0.0, 1.0);
            uv.x = sy * distortion.x + (1.0 - sy) * (1.0 - (uv.x + distortion.x));
        }
        vec2 normal = texture2D(perturbationMap, uv * random * random).rg;
        uv += normal * seeds * (random * 0.2);
    }
}
`;

export class BandedGlitchEffect extends GlitchEffect {
    constructor(options: ConstructorParameters<typeof GlitchEffect>[0]) {
        super(options);
        (this as any).fragmentShader = BANDED_GLITCH_FRAGMENT;
        this.uniforms.set('region', new Uniform(new Vector4(0, 0, 0, 0)));
    }

    update(renderer: any, inputBuffer: any, deltaTime: number): void {
        super.update(renderer, inputBuffer, deltaTime);
        const region = (this.uniforms.get('region')!.value as Vector4);
        if (!stageInk.valid) {
            region.set(0, 0, 0, 0);
            return;
        }
        // `distortion` is the glitch's own random pair for this frame: x picks which part of the text.
        const height = stageInk.y1 - stageInk.y0;
        const band = height * BAND_FRACTION;
        const centre = stageInk.y0 + band / 2 + (this as any).distortion.x * (height - band);
        region.set(stageInk.x0, centre - band / 2, stageInk.x1, centre + band / 2);
    }
}
