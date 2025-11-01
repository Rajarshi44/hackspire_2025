// Ambient module declarations for third-party packages without types
declare module 'lenis/react' {
  const ReactLenis: any;
  export { ReactLenis };
  export default ReactLenis;
}

declare module 'postprocessing' {
  export const EffectComposer: any;
  export const EffectPass: any;
  export const RenderPass: any;
  export const Effect: any;
  const _default: any;
  export default _default;
}

declare module 'motion/react' {
  import type { ComponentType } from 'react';
  export const motion: any;
  export const useTransform: any;
  export const useScroll: any;
  export type MotionValue<T = number> = any;
  export default motion as unknown as ComponentType<any>;
}
