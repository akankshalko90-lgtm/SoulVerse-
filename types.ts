// Declare webkitAudioContext on the Window interface to resolve TypeScript errors
declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
// Makes this file an ambient module, allowing global augmentations.
export {};