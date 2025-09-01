import { motion } from "framer-motion";

export default function UI({ cubeRef, onAfterResetOrScramble }) {
  const call = (fn, ...args) => () => cubeRef?.current?.[fn]?.(...args);
  const rotate = (m) => () => cubeRef?.current?.rotate?.(m);
  const afterReset = () => {
    onAfterResetOrScramble && onAfterResetOrScramble();
  };

  const Button = ({ children, onClick, className = "" }) => (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`px-4 py-2 rounded-xl bg-gray-800/80 text-white font-semibold hover:bg-gray-700 ${className}`}
    >
      {children}
    </motion.button>
  );

  // 中文标签映射
  const labelMap = {
    U: '上', D: '下', L: '左', R: '右', F: '前', B: '后'
  };
  const renderLabel = (m) => {
    // m 可能是 U, U', U2 等
    const face = m[0];
    const suffix = m.slice(1);
    let zh = labelMap[face] || face;
    if (suffix === "'") zh += " 逆"; // 逆时针
    if (suffix === "2") zh += "2"; // 180 度
    return zh;
  };

  return (
    <div className="p-4 bg-gradient-to-t from-black/60 to-black/20 backdrop-blur-md flex flex-col gap-3 border-t border-white/10">
      {/* 第一行：打乱/复原/撤销/重做 */}
      <div className="flex justify-center gap-3 flex-wrap">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            cubeRef?.current?.scramble?.(25);
            afterReset();
          }}
          className="px-5 py-2 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 text-white font-bold shadow-[0_8px_30px_rgb(79,70,229,0.4)] hover:brightness-110"
        >
          打乱
        </motion.button>
        <Button onClick={() => { cubeRef?.current?.reset?.(); afterReset(); }}>重置</Button>
        <Button onClick={call("undo")}>撤销</Button>
        <Button onClick={call("redo")}>重做</Button>
      </div>

      {/* 第二行：面转动快捷按钮（中文标签） */}
      <div className="flex justify-center gap-2 flex-wrap">
        {['U','D','L','R','F','B'].map((f)=> (
          <Button key={f} onClick={rotate(f)} className="bg-indigo-700/80">{renderLabel(f)}</Button>
        ))}
      </div>
      <div className="flex justify-center gap-2 flex-wrap">
        {["U'","D'","L'","R'","F'","B'"].map((f)=> (
          <Button key={f} onClick={rotate(f)} className="bg-emerald-700/80">{renderLabel(f)}</Button>
        ))}
      </div>
      <div className="flex justify-center gap-2 flex-wrap">
        {['U2','D2','L2','R2','F2','B2'].map((f)=> (
          <Button key={f} onClick={rotate(f)} className="bg-pink-700/80">{renderLabel(f)}</Button>
        ))}
      </div>
    </div>
  );
}
