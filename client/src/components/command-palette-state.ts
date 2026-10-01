export const COMMAND_PALETTE_EVENT = 'switchllm:command-palette'

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT))
}
