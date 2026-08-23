export const DEEPSEEK_V4_MODELS = new Set([
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "deepseek-v4-flash-vision-exp",
]);

/** Vision 模型（支持图片输入）。 */
export const DEEPSEEK_VISION_MODELS = new Set(["deepseek-v4-flash-vision-exp"]);

/**
 * DeepSeek V4 models always use thinking mode by default.
 * Since the plugin only supports DeepSeek models, this always returns true.
 */
export function defaultsToThinkingMode(_model: string): boolean {
  return true;
}

/**
 * 是否支持多模态（图片）输入。
 * 仅 deepseek-v4-flash-vision-exp 支持；其余模型发送图片会返回 400。
 */
export function supportsMultimodal(model: string): boolean {
  return DEEPSEEK_VISION_MODELS.has(model);
}
