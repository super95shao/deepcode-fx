export const DEEPSEEK_V4_MODELS = new Set(["deepseek-v4-flash", "deepseek-v4-pro"]);

/**
 * DeepSeek V4 models always use thinking mode by default.
 * Since the plugin only supports DeepSeek models, this always returns true.
 */
export function defaultsToThinkingMode(_model: string): boolean {
  return true;
}

/**
 * DeepSeek V4 models do not support multimodal (image) inputs.
 * Since the plugin only supports DeepSeek models, this always returns false.
 */
export function supportsMultimodal(_model: string): boolean {
  return false;
}
