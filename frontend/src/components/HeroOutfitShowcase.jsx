import { Suspense, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei'
import { motion } from 'framer-motion'
import * as THREE from 'three'

const avatarModelUrl = new URL('./avatar.glb', import.meta.url).href

function AvatarModel() {
  const { scene } = useGLTF(avatarModelUrl)
  const groupRef = useRef()

  const model = useMemo(() => {
    const clonedScene = scene.clone()

    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    const box = new THREE.Box3().setFromObject(clonedScene)
    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)

    clonedScene.position.set(-center.x, -center.y + 0.35, -center.z)

    const maxDimension = Math.max(size.x, size.y, size.z) || 1
    clonedScene.scale.setScalar(2.1 / maxDimension)

    return clonedScene
  }, [scene])

  return <primitive ref={groupRef} object={model} />
}

export default function HeroOutfitShowcase() {
  return (
    <div className="relative w-full h-full">
      <Canvas camera={{ position: [0, 0.6, 4.9], fov: 30 }} shadows dpr={[1, 2]} className="!absolute inset-0">
        <ambientLight intensity={1.1} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-2.5, 2, -2]} intensity={0.65} color="#d7c0a0" />

        <Suspense fallback={null}>
          <AvatarModel />
        </Suspense>

        <ContactShadows position={[0, -1.9, 0]} opacity={0.38} scale={5} blur={2.5} far={3.2} />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={1.4}
          minPolarAngle={Math.PI / 2.6}
          maxPolarAngle={Math.PI / 1.7}
          target={[0, 0.2, 0]}
        />
      </Canvas>

      <div className="absolute top-5 left-6 flex items-center gap-1.5 z-10">
        <span className="h-1 w-5 rounded-full bg-clay" />
        <span className="h-1 w-1.5 rounded-full bg-ink/20" />
        <span className="h-1 w-1.5 rounded-full bg-ink/20" />
      </div>

      <span className="absolute top-5 right-6 z-10 font-mono text-[10px] tracking-widest uppercase text-ink/40">
        Drag to spin
      </span>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-6 left-6 right-6 bg-parchment/90 backdrop-blur rounded-xl px-4 py-3 flex items-center justify-between border border-ink/10 z-10"
      >
        <div>
          <span className="text-sm font-medium block">Charcoal tailored set</span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink/45">Work</span>
        </div>
        <span className="font-mono text-xs text-moss shrink-0">91% match</span>
      </motion.div>
    </div>
  )
}
