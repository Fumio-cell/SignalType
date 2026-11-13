/**
 * Where the text is on the stage, as a rectangle in the frame's UV space (0..1, y up). The scene writes
 * it every frame; the post-processing effects that must stay on the text (INTERFERENCE bands) read it.
 */
export const stageInk = { valid: false, x0: 0, y0: 0, x1: 0, y1: 0 };
