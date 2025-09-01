import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// 颜色定义（与经典配色接近）
const FACE_COLORS = {
  R: "#ff4136", // 右 x+
  L: "#ff851b", // 左 x-
  U: "#ffffff", // 上 y+
  D: "#ffdc00", // 下 y-
  F: "#2ecc40", // 前 z+
  B: "#0074d9", // 后 z-
  X: "#0c0c0f", // 内部/无贴纸
};

const AXIS_VEC = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

// 工具：四舍五入到最近的网格 -1/0/1
function roundToGrid(v, step) {
  return Math.round(v / step) * step;
}

// 生成所有网格索引 -1,0,1
const GRID = [-1, 0, 1];

// 每个小块尺寸和间隙控制
const CUBIE_SIZE = 0.96; // 小于 1 以形成缝隙
const GRID_STEP = 1; // 网格步长

// 将 move 字符串解析为 { axis, layerVal, angle }（弧度，正负方向）
function parseMove(move) {
  // 基础方向定义：未加' 时，使用 baseAngle；加' 取反；加2 为两倍
  // 这里的 baseAngle 选择使得 "从该面的法向量方向看过去是顺时针"。
  const base = {
    U: { axis: "y", layer: +1, angle: -Math.PI / 2 },
    D: { axis: "y", layer: -1, angle: +Math.PI / 2 },
    R: { axis: "x", layer: +1, angle: -Math.PI / 2 },
    L: { axis: "x", layer: -1, angle: +Math.PI / 2 },
    F: { axis: "z", layer: +1, angle: -Math.PI / 2 },
    B: { axis: "z", layer: -1, angle: +Math.PI / 2 },
  };
  const m = move.trim();
  const face = m[0];
  if (!base[face]) throw new Error(`未知的转动: ${move}`);
  const suf = m.slice(1);
  let times = 1;
  let angle = base[face].angle;
  if (suf === "'") angle = -angle;
  else if (suf === "2") times = 2; // 1.5x 速度内做两次 90°
  return { axis: base[face].axis, layerVal: base[face].layer, angle: angle * times };
}

// 为某个 cubie 生成 6 面材质：顺序 [right, left, top, bottom, front, back]
function materialsFor(ix, iy, iz) {
  const mat = [];
  // 右 x+
  mat[0] = new THREE.MeshBasicMaterial({ color: ix === 1 ? FACE_COLORS.R : FACE_COLORS.X });
  // 左 x-
  mat[1] = new THREE.MeshBasicMaterial({ color: ix === -1 ? FACE_COLORS.L : FACE_COLORS.X });
  // 上 y+
  mat[2] = new THREE.MeshBasicMaterial({ color: iy === 1 ? FACE_COLORS.U : FACE_COLORS.X });
  // 下 y-
  mat[3] = new THREE.MeshBasicMaterial({ color: iy === -1 ? FACE_COLORS.D : FACE_COLORS.X });
  // 前 z+
  mat[4] = new THREE.MeshBasicMaterial({ color: iz === 1 ? FACE_COLORS.F : FACE_COLORS.X });
  // 后 z-
  mat[5] = new THREE.MeshBasicMaterial({ color: iz === -1 ? FACE_COLORS.B : FACE_COLORS.X });
  return mat;
}

// 小方块组件
function Cubie({ materials, meshRef }) {
  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <boxGeometry args={[CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE]} />
      {materials.map((m, i) => (
        <primitive key={i} attach={`material-${i}`} object={m} />
      ))}
    </mesh>
  );
}

const Cube = forwardRef(function Cube(props, ref) {
  // 记录 27 个 cubie 的 ref 与逻辑网格位置
  const cubieRefs = useRef([]); // index 与 cubie 一一对应
  const [gridPositions, setGridPositions] = useState([]); // [[x,y,z], ...]
  // 使用 ref 持有最新的 gridPositions，避免闭包过期
  const gridPositionsRef = useRef([]);
  useEffect(() => { gridPositionsRef.current = gridPositions; }, [gridPositions]);

  // 动画状态与队列
  const animState = useRef({ active: false, axis: "y", layerVal: 1, remaining: 0, total: 0, affected: [], onEnd: null });
  const speed = 4.2; // 弧度/秒，视觉顺滑

  const movesDone = useRef([]); // 已执行历史
  const movesRedo = useRef([]); // 可重做栈
  // 提供一个稳定的 rotate 引用，供动画结束回调安全调用
  const rotateRef = useRef(null);

  // 初始化 27 个 cubies
  const initial = useMemo(() => {
    const list = [];
    GRID.forEach((ix) => {
      GRID.forEach((iy) => {
        GRID.forEach((iz) => {
          list.push({ ix, iy, iz });
        });
      });
    });
    return list;
  }, []);

  // 初始化 gridPositions，并命令式设置 mesh 初始位姿，避免由 React 受控 position 覆盖动画
  useEffect(() => {
    initial.forEach(({ ix, iy, iz }, i) => {
      const mesh = cubieRefs.current[i]?.current;
      if (!mesh) return;
      mesh.position.set(ix * GRID_STEP, iy * GRID_STEP, iz * GRID_STEP);
      mesh.rotation.set(0, 0, 0);
      mesh.quaternion.identity();
    });
    const initGrid = initial.map(({ ix, iy, iz }) => [ix * GRID_STEP, iy * GRID_STEP, iz * GRID_STEP]);
    gridPositionsRef.current = initGrid;
    setGridPositions(initGrid);
  }, [initial]);

  // 开始一次旋转动画
  const startRotation = useCallback((axis, layerVal, angle, onEnd) => {
    if (animState.current.active) return false;
    // 基于实时 mesh.position 判定受影响的小块，避免读取过期的 gridPositions
    const affected = [];
    cubieRefs.current.forEach((ref, idx) => {
      const mesh = ref?.current;
      if (!mesh) return;
      const x = Math.round(mesh.position.x);
      const y = Math.round(mesh.position.y);
      const z = Math.round(mesh.position.z);
      if ((axis === "x" && x === layerVal) || (axis === "y" && y === layerVal) || (axis === "z" && z === layerVal)) {
        affected.push(idx);
      }
    });
    animState.current = { active: true, axis, layerVal, remaining: angle, total: angle, affected, onEnd: onEnd || null };
    return true;
  }, []);

  // 每帧推进动画
  useEffect(() => {
    let raf = null;
    const tick = (tNow) => {
      if (!animState.current.active) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = 1 / 60; // 固定步长以保证一致性
      const axis = animState.current.axis;
      const A = AXIS_VEC[axis];
      const step = Math.sign(animState.current.remaining) * Math.min(Math.abs(animState.current.remaining), speed * dt);
      animState.current.remaining -= step;

      // 逐个更新受影响 cubie 的位置与朝向
      animState.current.affected.forEach((idx) => {
        const mesh = cubieRefs.current[idx]?.current;
        if (!mesh) return;
        // 旋转位置（世界轴）
        const pos = mesh.position.clone();
        pos.applyAxisAngle(A, step);
        mesh.position.copy(pos);
        // 旋转朝向（世界轴）
        mesh.rotateOnWorldAxis(A, step);
      });

      const finished = Math.abs(animState.current.remaining) < 1e-4;
      if (finished) {
        // 对齐到网格并刷新 gridPositions：对全部 27 个 cubie 进行网格对齐，重建数组
        const newGrid = new Array(initial.length);
        for (let i = 0; i < initial.length; i++) {
          const mesh = cubieRefs.current[i]?.current;
          if (!mesh) continue;
          const snapped = new THREE.Vector3(
            roundToGrid(mesh.position.x, GRID_STEP),
            roundToGrid(mesh.position.y, GRID_STEP),
            roundToGrid(mesh.position.z, GRID_STEP)
          );
          mesh.position.copy(snapped);
          newGrid[i] = [snapped.x, snapped.y, snapped.z];
        }
        // 先同步 ref，确保下一次选层读取最新数据
        gridPositionsRef.current = newGrid;
        setGridPositions(newGrid);
        const cb = animState.current.onEnd;
        animState.current = { active: false, axis: "y", layerVal: 1, remaining: 0, total: 0, affected: [], onEnd: null };
        if (cb) cb();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [gridPositions]);

  // 执行一个标准招法，例如 "U", "R'", "F2"
  const rotate = useCallback((move, options = {}) => {
    const source = options.source || "user"; // user | undo | redo | reset
    const { axis, layerVal, angle } = parseMove(move);
    const ok = startRotation(axis, layerVal, angle, () => {
      // 仅用户新操作才写入 movesDone 并清空重做栈
      if (source === "user") {
        movesDone.current.push(move);
        movesRedo.current = []; // 新操作后清空重做栈
      }
      if (callbacks.current.onMoveEnd) callbacks.current.onMoveEnd(move);

      // 若本次为批次的最后一步，执行批次完成回调
      if (options.lastOfBatch && typeof options.onBatchDone === "function") {
        try { options.onBatchDone(); } catch {}
      }

      // 若还在队列中，继续下一个（使用最新的 rotate 引用，避免闭包过期）
      if (queue.current.length) {
        const next = queue.current.shift();
        rotateRef.current && rotateRef.current(next.move, next.options);
      }
    });
    if (!ok) {
      // 正在动画时，入队（带来源和批次信息）
      queue.current.push({ move, options: { source, lastOfBatch: !!options.lastOfBatch, onBatchDone: options.onBatchDone } });
    }
  }, [startRotation]);
  // 同步最新 rotate 引用
  useEffect(() => { rotateRef.current = rotate; }, [rotate]);

  // 命令队列
  const queue = useRef([]);

  // 打乱（默认 25 步）
  const scramble = useCallback((n = 25) => {
    const faces = ["U", "D", "L", "R", "F", "B"];
    const suffix = ["", "'", "2"];
    const seq = [];
    let lastFace = null;
    for (let i = 0; i < n; i++) {
      let f;
      do {
        f = faces[Math.floor(Math.random() * faces.length)];
      } while (f === lastFace); // 避免连续同一面
      lastFace = f;
      const s = suffix[Math.floor(Math.random() * suffix.length)];
      seq.push(f + s);
    }
    // 入队执行
    seq.forEach((m) => rotate(m));
  }, [rotate]);

  // 复原到初始状态：基于历史步骤逐步旋转回去（动画方式）
  const reset = useCallback(() => {
    // 构造从当前状态回到初始状态的序列：对 movesDone 逆序并取逆招
    const history = movesDone.current;
    if (!history.length) return;
    const seq = [...history].reverse().map((m) => inverseMove(m));

    // 为最后一步设置批次完成回调：清空历史与重做栈
    const lastIdx = seq.length - 1;
    seq.forEach((m, idx) => {
      const isLast = idx === lastIdx;
      if (isLast) {
        rotate(m, {
          source: "reset",
          lastOfBatch: true,
          onBatchDone: () => {
            // 序列结束后，清空历史与重做
            movesDone.current = [];
            movesRedo.current = [];
          },
        });
      } else {
        rotate(m, { source: "reset" });
      }
    });
  }, [rotate]);

  const inverseMove = (m) => {
    if (m.endsWith("2")) return m; // 180° 的逆还是自身
    if (m.endsWith("'")) return m.slice(0, -1);
    return m + "'";
  };

  const undo = useCallback(() => {
    if (animState.current.active) return;
    const m = movesDone.current.pop();
    if (!m) return;
    const inv = inverseMove(m);
    movesRedo.current.push(m);
    rotate(inv, { source: "undo" });
  }, [rotate]);

  const redo = useCallback(() => {
    if (animState.current.active) return;
    const m = movesRedo.current.pop();
    if (!m) return;
    // 先标记到已执行栈，rotate 不再重复写入
    movesDone.current.push(m);
    rotate(m, { source: "redo" });
  }, [rotate]);

  // 获取某个 cubie 当前的贴纸朝向（基于其旋转状态）
  const getCubieOrientation = useCallback((idx) => {
    const mesh = cubieRefs.current[idx]?.current;
    if (!mesh) return null;
    
    // 获取初始坐标
    const { ix, iy, iz } = initial[idx];
    
    // 基于当前旋转矩阵，计算六个面的法向量
    const faces = [
      new THREE.Vector3(1, 0, 0),  // right (R)
      new THREE.Vector3(-1, 0, 0), // left (L)
      new THREE.Vector3(0, 1, 0),  // top (U)
      new THREE.Vector3(0, -1, 0), // bottom (D)
      new THREE.Vector3(0, 0, 1),  // front (F)
      new THREE.Vector3(0, 0, -1), // back (B)
    ];
    
    // 应用当前旋转变换
    const rotatedFaces = faces.map(face => {
      const rotated = face.clone();
      rotated.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
      return rotated;
    });
    
    // 返回当前朝向的面颜色映射
    return {
      right: rotatedFaces[0],
      left: rotatedFaces[1], 
      top: rotatedFaces[2],
      bottom: rotatedFaces[3],
      front: rotatedFaces[4],
      back: rotatedFaces[5],
      initialPos: { ix, iy, iz }
    };
  }, [initial]);

  const isSolved = useCallback(() => {
    // 检查位置是否正确
    const positionCorrect = gridPositions.every((p, i) => {
      const { ix, iy, iz } = initial[i];
      return (
        Math.round(p[0]) === ix * GRID_STEP &&
        Math.round(p[1]) === iy * GRID_STEP &&
        Math.round(p[2]) === iz * GRID_STEP
      );
    });
    
    if (!positionCorrect) return false;
    
    // 检查朝向是否正确
    for (let i = 0; i < initial.length; i++) {
      const { ix, iy, iz } = initial[i];
      const mesh = cubieRefs.current[i]?.current;
      if (!mesh) continue;
      
      // 获取六个标准方向向量
      const standardDirections = [
        new THREE.Vector3(1, 0, 0),  // X+
        new THREE.Vector3(-1, 0, 0), // X-
        new THREE.Vector3(0, 1, 0),  // Y+
        new THREE.Vector3(0, -1, 0), // Y-
        new THREE.Vector3(0, 0, 1),  // Z+
        new THREE.Vector3(0, 0, -1), // Z-
      ];
      
      // 检查每个面是否正确朝向
      for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
        const currentDirection = standardDirections[faceIdx].clone();
        currentDirection.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
        
        // 容忍度检查（考虑浮点误差）
        const expectedDirection = standardDirections[faceIdx];
        const dot = currentDirection.dot(expectedDirection);
        
        // 如果法向量偏差超过阈值，说明朝向不正确
        if (Math.abs(dot - 1) > 0.1) {
          return false;
        }
      }
    }
    
    return true;
  }, [gridPositions, initial, getCubieOrientation]);

  const callbacks = useRef({ onMoveEnd: null });
  const onMoveEnd = useCallback((cb) => {
    callbacks.current.onMoveEnd = cb;
  }, []);

  useImperativeHandle(ref, () => ({ rotate, scramble, reset, undo, redo, isSolved, onMoveEnd }));


  // 鼠标事件处理：在 group 上添加事件监听
  const groupRef = useRef();

  return (
    <group ref={groupRef} {...props} >
      {initial.map(({ ix, iy, iz }, i) => {
        if (!cubieRefs.current[i]) cubieRefs.current[i] = React.createRef();
        const mats = materialsFor(ix, iy, iz);
        return <Cubie key={i} materials={mats} meshRef={cubieRefs.current[i]} />;
      })}
    </group>
  );
});

export default Cube;
