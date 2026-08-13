import HuaVsLucaGame from "./HuaVsLucaGame";
import { BalloonBackdrop } from "@/features/game/components/BalloonBackdrop";
import { KineticBackdrop } from "@/features/game/components/KineticBackdrop";

export default function Home() {
  return (
    <>
      <KineticBackdrop />
      <BalloonBackdrop />
      <HuaVsLucaGame />
    </>
  );
}
