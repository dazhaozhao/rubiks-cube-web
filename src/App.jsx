import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import { useRef, useState } from "react";
import Cube from "./components/Cube";
import UI from "./components/UI";

export default function App() {
  const cubeRef = useRef(null);
  const [resetSignal, setResetSignal] = useState(0);
  return (
    <div className="w-screen h-screen flex flex-col">
      <div className="flex-1 relative">
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
