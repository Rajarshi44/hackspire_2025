declare module "lottie-react" {
  import { ComponentType } from "react";

  type LottieProps = {
    animationData?: any;
    loop?: boolean | number;
    autoplay?: boolean;
    style?: React.CSSProperties;
    className?: string;
  } & Record<string, any>;

  const Lottie: ComponentType<LottieProps>;
  export default Lottie;
}
