import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export default function Controls() {
  const [steps, setSteps] = useState(0)

  useEffect(() => {
    const onUserRotate = () => setSteps((s) => s + 1)
    const onClear = () => setSteps(0)
    window.addEventListener('steps:user-rotate', onUserRotate)
    window.addEventListener('steps:clear', onClear)
    return () => {
      window.removeEventListener('steps:user-rotate', onUserRotate)
      window.removeEventListener('steps:clear', onClear)
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-lg rounded-2xl p-4"
    >
      <div className="text-white font-semibold">步数：{steps}</div>
      <div className="mt-1 text-white/80 text-sm">使用底部控制条进行操作（打乱 / 重置 / 撤销 / 重做）</div>
    </motion.div>
  )
}
