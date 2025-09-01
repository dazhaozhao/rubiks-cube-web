import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import { useRef, useState, useEffect } from "react";
import Cube from "./components/Cube";
import UI from "./components/UI";
import Controls from "./components/Controls";
import confetti from "canvas-confetti";

export default function App() {
  const cubeRef = useRef(null);
  const [resetSignal, setResetSignal] = useState(0);
  const confettiAttachedRef = useRef(false);

  // 等待魔方 ref 就绪后再绑定 onMoveEnd，复原时触发彩带
  useEffect(() => {
    let rafId = 0;
    const randomInRange = (min, max) => Math.random() * (max - min) + min;
    const attach = () => {
      if (confettiAttachedRef.current) return;
      const cube = cubeRef.current;
      if (cube && typeof cube.onMoveEnd === "function") {
        const handler = () => {
          try {
            if (cube.isSolved && cube.isSolved()) {
              confetti({
                particleCount: 160,
                spread: 70,
                angle: randomInRange(55, 125),
                origin: { y: 0.6 }
              });
            }
          } catch {}
        };
        cube.onMoveEnd(handler);
        confettiAttachedRef.current = true;
        return;
      }
      rafId = requestAnimationFrame(attach);
    };
    rafId = requestAnimationFrame(attach);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      try {
        const cube = cubeRef.current;
        if (cube && typeof cube.onMoveEnd === "function") {
          cube.onMoveEnd(null);
        }
      } catch {}
      confettiAttachedRef.current = false;
    };
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="flex-1 relative">
        <div className="absolute top-4 left-4 z-10"><Controls /></div>
        <Canvas camera={{ position: [4.5, 4.5, 4.5], fov: 45 }}>
          <Stage environment="city" intensity={0.6} adjustCamera={false}>
            {/* 传入 ref 以便 UI 可以调用魔方动作 */}
            <Cube ref={cubeRef} />
          </Stage>
          <OrbitControls enablePan={false} minDistance={2.5} maxDistance={12} />
        </Canvas>
      </div>
      {/* 将 cubeRef 传给 UI 控制区，并透传重置信号 setter */}
      <UI cubeRef={cubeRef} onAfterResetOrScramble={() => setResetSignal((n) => n + 1)} />
    </div>
  );
}
