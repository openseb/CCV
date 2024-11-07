import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import CityScene from './components/CityScene'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas
        camera={{ 
          position: [50, 50, 50],
          fov: 60,
          near: 0.1,
          far: 1000
        }}
        gl={{ 
          antialias: true,
          alpha: false,
          depth: true,
          powerPreference: "high-performance"
        }}
      >
        <ambientLight intensity={0.2} />
        <pointLight position={[0, 100, 0]} intensity={1} />
        <CityScene />
        <OrbitControls 
          maxDistance={150}
          minDistance={10}
          maxPolarAngle={Math.PI / 2.1}
        />
      </Canvas>
    </div>
  )
}

export default App 