import { motion } from 'framer-motion'

export default function Controls() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-lg rounded-2xl p-4"
    >
      使用底部控制条进行操作（打乱 / 重置 / 撤销 / 重做）
    </motion.div>
  )
}
