/**
 * The most the colour channels may be pulled apart, as a fraction of the frame width (per channel; red and
 * blue end up twice this far from each other). 0.0017 is 3.3 px of a 1920 px frame: a few pixels at any size.
 * It caps the spread slider, the turbulence that adds to it, and recipes that carry larger values.
 */
export const RGB_SPLIT_MAX = 0.0017;
