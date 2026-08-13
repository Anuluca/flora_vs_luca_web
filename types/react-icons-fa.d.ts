declare module "react-icons/fa" {
  import type { ComponentType, SVGProps } from "react";

  type IconProps = SVGProps<SVGSVGElement> & { size?: string | number; title?: string };
  type Icon = ComponentType<IconProps>;

  export const FaArrowLeft: Icon;
  export const FaBookOpen: Icon;
  export const FaCat: Icon;
  export const FaCheck: Icon;
  export const FaFastForward: Icon;
  export const FaGithub: Icon;
  export const FaHistory: Icon;
  export const FaHome: Icon;
  export const FaInfoCircle: Icon;
  export const FaPause: Icon;
  export const FaPlay: Icon;
  export const FaRedoAlt: Icon;
  export const FaShareAlt: Icon;
  export const FaSignOutAlt: Icon;
  export const FaTimes: Icon;
  export const FaVolumeMute: Icon;
  export const FaVolumeUp: Icon;
}
