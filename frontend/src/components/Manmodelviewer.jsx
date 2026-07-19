import React, { Suspense, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls, Bounds, useAnimations } from '@react-three/drei'

// Loads /public/3d/man.glb (served at /3d/man.glb) and plays its baked-in
// wave animation clip. Just loading the scene only gives you the static
// mesh — the clip has to be explicitly found and played on a mixer.
function GLBModel({ url }) {
  const group = useRef()
  const { scene, animations } = useGLTF(url)
  const { actions, names } = useAnimations(animations, group)

  useEffect(() => {
    if (!names.length) return
    // Prefer a clip actually named "wave", otherwise just play the first one
    const clipName = names.find((n) => /wave/i.test(n)) || names[0]
    const action = actions[clipName]
    action?.reset().fadeIn(0.3).play()
    return () => action?.fadeOut(0.3)
  }, [actions, names])

  return <primitive ref={group} object={scene} />
}

// Auto-framed viewer for the right-side panel of the login/admin pages.
// Bounds fits the camera to the model's real size, so it's never cropped.
export default function ManModelViewer() {
  return (
    <div className="auth-man-viewer">
      <Canvas camera={{ fov: 32 }} dpr={[1, 2]}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 5, 2]} intensity={1.3} />
        <directionalLight position={[-4, 2, -3]} intensity={0.5} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.25}>
            <GLBModel url="/3d/man.glb" />
          </Bounds>
        </Suspense>
        <OrbitControls makeDefault enablePan={false} enableZoom={false} />
      </Canvas>
    </div>
  )
}

useGLTF.preload('/3d/man.glb')