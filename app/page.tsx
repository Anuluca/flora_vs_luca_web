import HuaVsLucaGame from "./HuaVsLucaGame";
import { BalloonBackdrop } from "@/features/game/components/BalloonBackdrop";
import { KineticBackdrop } from "@/features/game/components/KineticBackdrop";
import { HomeSeoContent } from "@/features/seo/SeoContent";

export default function Home() {
  return (
    <>
      <KineticBackdrop />
      <BalloonBackdrop />
      <HuaVsLucaGame />
      <HomeSeoContent />
    </>
  );
}
