import { useEffect, useMemo, useState, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Points } from '@react-three/drei'
import { Bloom, Noise, Vignette, EffectComposer } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'

/**
 * Building component rendered as animated point-cloud
 * @param {Object} props.building - Building dimensions {x, y, width, depth, height}
 */
const CityPoints = ({ building }) => {
  const pointsRef = useRef()
  const time = useRef(0)
  const originalPositions = useRef(null)
  
  useFrame((state, delta) => {
    time.current += delta * 0.8
    
    if (pointsRef.current && originalPositions.current) {
      const positions = pointsRef.current.geometry.attributes.position.array
      const colors = pointsRef.current.geometry.attributes.color.array
      const origPositions = originalPositions.current
      
      for (let i = 0; i < positions.length; i += 3) {
        const origY = origPositions[i + 1]
        const origX = origPositions[i]
        const origZ = origPositions[i + 2]
        
        const heightPercent = origY / building.height
        const distFromCenter = Math.sqrt(
          Math.pow(origX - building.x, 2) + 
          Math.pow(origZ - building.y, 2)
        )
        
        const wavePhase = time.current * 2 + distFromCenter * 0.1
        const verticalOffset = Math.sin(wavePhase) * 0.15
        const horizontalOffset = Math.cos(wavePhase * 0.5) * 0.05
        
        positions[i] = origX + horizontalOffset
        positions[i + 1] = origY + verticalOffset
        positions[i + 2] = origZ + horizontalOffset
        
        const pulseIntensity = Math.sin(time.current + heightPercent * 3) * 0.2
        const edgeGlow = Math.sin(time.current * 2 + distFromCenter) * 0.3
        const neuralFlash = Math.random() > 0.997 ? 0.5 : 0
        
        const baseIntensity = 0.6 - heightPercent * 0.4
        
        colors[i] = Math.max(0, 0.1 + edgeGlow * 0.2 + neuralFlash)
        colors[i + 1] = baseIntensity + pulseIntensity + edgeGlow + neuralFlash
        colors[i + 2] = baseIntensity * 0.8 + edgeGlow * 0.5 + neuralFlash
      }
      
      pointsRef.current.geometry.attributes.position.needsUpdate = true
      pointsRef.current.geometry.attributes.color.needsUpdate = true
    }
  })

  useEffect(() => {
    if (pointsRef.current && !originalPositions.current) {
      const positions = pointsRef.current.geometry.attributes.position.array
      originalPositions.current = new Float32Array(positions.length)
      originalPositions.current.set(positions)
    }
  }, [])

  const { points, colorData } = useMemo(() => {
    const pts = []
    const cols = []
    const pointsPerEdge = 20
    const { x, y, width, depth, height } = building
    
    const buildingSeed = Math.random() * 1000
    const colorOffset = Math.random() * 0.3
    
    const addPoint = (px, py, pz) => {
      pts.push({ x: px, y: py, z: pz })
      
      const heightPercent = py / height
      const baseColor = new THREE.Color(0x00ffff)
      const topColor = new THREE.Color(0x000022)
      
      const variationX = Math.sin((px + buildingSeed) * 0.2) * 0.3
      const variationZ = Math.cos((pz + buildingSeed) * 0.15) * 0.3
      const randomOffset = (Math.random() - 0.5) * 0.1
      
      const color = new THREE.Color()
      const lerpFactor = heightPercent + variationX + variationZ + randomOffset + colorOffset
      color.lerpColors(baseColor, topColor, Math.max(0, Math.min(1, lerpFactor)))
      cols.push(color)
    }
    
    const corners = [
      { dx: -width/2, dz: -depth/2 },
      { dx: width/2, dz: -depth/2 },
      { dx: -width/2, dz: depth/2 },
      { dx: width/2, dz: depth/2 }
    ]
    
    corners.forEach(corner => {
      for (let h = 0; h < height; h += height/pointsPerEdge) {
        addPoint(
          x + corner.dx,
          h,
          y + corner.dz
        )
      }
    })

    const heights = [0, height/3, height*2/3, height]
    heights.forEach(h => {
      for (let w = -width/2; w <= width/2; w += width/pointsPerEdge) {
        addPoint(x + w, h, y + depth/2)
      }
      for (let w = -width/2; w <= width/2; w += width/pointsPerEdge) {
        addPoint(x + w, h, y - depth/2)
      }
      for (let d = -depth/2; d <= depth/2; d += depth/pointsPerEdge) {
        addPoint(x - width/2, h, y + d)
      }
      for (let d = -depth/2; d <= depth/2; d += depth/pointsPerEdge) {
        addPoint(x + width/2, h, y + d)
      }
    })

    const edgeNoise = 0.2
    for (let i = 0; i < pointsPerEdge * 2; i++) {
      const side = Math.floor(Math.random() * 4)
      let point
      
      switch(side) {
        case 0:
          point = {
            x: x + (Math.random() - 0.5) * width,
            y: Math.random() * height,
            z: y + depth/2 + (Math.random() - 0.5) * edgeNoise
          }
          break
        case 1:
          point = {
            x: x + (Math.random() - 0.5) * width,
            y: Math.random() * height,
            z: y - depth/2 + (Math.random() - 0.5) * edgeNoise
          }
          break
        case 2:
          point = {
            x: x - width/2 + (Math.random() - 0.5) * edgeNoise,
            y: Math.random() * height,
            z: y + (Math.random() - 0.5) * depth
          }
          break
        case 3:
          point = {
            x: x + width/2 + (Math.random() - 0.5) * edgeNoise,
            y: Math.random() * height,
            z: y + (Math.random() - 0.5) * depth
          }
          break
      }
      addPoint(point.x, point.y, point.z)
    }

    return { points: pts, colorData: cols }
  }, [building])

  const positions = useMemo(() => {
    const positions = new Float32Array(points.length * 3)
    points.forEach((point, i) => {
      positions[i * 3] = point.x
      positions[i * 3 + 1] = point.y
      positions[i * 3 + 2] = point.z
    })
    return positions
  }, [points])

  const colors = useMemo(() => {
    const colorArray = new Float32Array(points.length * 3)
    colorData.forEach((color, i) => {
      colorArray[i * 3] = color.r
      colorArray[i * 3 + 1] = color.g
      colorArray[i * 3 + 2] = color.b
    })
    return colorArray
  }, [colorData])

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={points.length}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.3}
        vertexColors={true}
        transparent={true}
        opacity={0.9}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

/**
 * Neural effect particles surrounding buildings
 * @param {Object} props.building - Building dimensions {x, y, width, depth, height}
 */
const NeuralArtifacts = ({ building }) => {
  const artifactsRef = useRef()
  const time = useRef(0)
  
  useFrame((state, delta) => {
    time.current += delta

    if (artifactsRef.current) {
      const positions = artifactsRef.current.geometry.attributes.position.array
      const colors = artifactsRef.current.geometry.attributes.color.array

      for (let i = 0; i < positions.length; i += 3) {
        // Animate position
        const phase = time.current + i * 0.05
        const lifespan = (Math.sin(phase * 0.5) + 1) * 0.5
        
        // Only show artifacts occasionally
        if (Math.random() > 0.9997) {
          colors[i] = 0.2
          colors[i + 1] = 0.8 * lifespan
          colors[i + 2] = 0.7 * lifespan
        } else {
          colors[i] = 0
          colors[i + 1] = 0
          colors[i + 2] = 0
        }
      }
      
      artifactsRef.current.geometry.attributes.color.needsUpdate = true
    }
  })

  const { positions, colors } = useMemo(() => {
    const { x, y, width, depth, height } = building
    const artifactCount = 200
    const positions = new Float32Array(artifactCount * 3)
    const colors = new Float32Array(artifactCount * 3)
    
    // Create artifact points around the building
    for (let i = 0; i < artifactCount * 3; i += 3) {
      const spread = 2
      positions[i] = x + (Math.random() - 0.5) * (width + spread)
      positions[i + 1] = Math.random() * (height + spread)
      positions[i + 2] = y + (Math.random() - 0.5) * (depth + spread)
      
      colors[i] = 0
      colors[i + 1] = 0
      colors[i + 2] = 0
    }
    
    return { positions, colors }
  }, [building])

  return (
    <points ref={artifactsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.4}
        vertexColors={true}
        transparent={true}
        opacity={0.8}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// Generate street grid layout
const Streets = ({ streets }) => {
  const streetLines = useMemo(() => {
    const lines = []
    const gridSize = 5
    const blockSize = 10
    const streetWidth = 0.5

    for (let i = -gridSize; i <= gridSize; i++) {
      lines.push({
        points: [
          new THREE.Vector3(i * blockSize * 2, 0.1, -gridSize * blockSize * 2),
          new THREE.Vector3(i * blockSize * 2, 0.1, gridSize * blockSize * 2)
        ],
        width: streetWidth * 2
      })
      lines.push({
        points: [
          new THREE.Vector3(-gridSize * blockSize * 2, 0.1, i * blockSize * 2),
          new THREE.Vector3(gridSize * blockSize * 2, 0.1, i * blockSize * 2)
        ],
        width: streetWidth * 2
      })
    }

    for (let i = -gridSize * 2; i <= gridSize * 2; i++) {
      if (i % 2 !== 0) {
        lines.push({
          points: [
            new THREE.Vector3(i * blockSize, 0.1, -gridSize * blockSize * 2),
            new THREE.Vector3(i * blockSize, 0.1, gridSize * blockSize * 2)
          ],
          width: streetWidth
        })
        lines.push({
          points: [
            new THREE.Vector3(-gridSize * blockSize * 2, 0.1, i * blockSize),
            new THREE.Vector3(gridSize * blockSize * 2, 0.1, i * blockSize)
          ],
          width: streetWidth
        })
      }
    }

    return lines
  }, [])

  return (
    <group>
      {streetLines.map((street, i) => (
        <line key={i}>
          <bufferGeometry>
            <float32BufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                street.points[0].x, street.points[0].y, street.points[0].z,
                street.points[1].x, street.points[1].y, street.points[1].z
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color="#444444" 
            linewidth={street.width}
            opacity={0.5}
            transparent={true}
          />
        </line>
      ))}
    </group>
  )
}

// Particle with motion trail for ambient traffic
const FlowingParticle = () => {
  const particleRef = useRef()
  const trailRef = useRef([])
  const velocity = useRef(new THREE.Vector3())
  const target = useRef(new THREE.Vector3())
  const time = useRef(0)

  useEffect(() => {
    const pos = new THREE.Vector3(
      (Math.random() - 0.5) * 200,  // Reduced range for denser traffic
      Math.random() * 40 + 5,
      (Math.random() - 0.5) * 200
    )
    particleRef.current.position.copy(pos)
    setNewTarget()
    
    // Longer trails
    trailRef.current = Array(30).fill().map(() => pos.clone())
  }, [])

  const setNewTarget = () => {
    target.current.set(
      (Math.random() - 0.5) * 300,
      Math.random() * 60 + 5,
      (Math.random() - 0.5) * 300
    )
  }

  useFrame((state, delta) => {
    const pos = particleRef.current.position
    time.current += delta

    const direction = target.current.clone().sub(pos)
    const distance = direction.length()
    
    if (distance < 2) {
      setNewTarget()
    }

    direction.normalize()
    // Increased speed and responsiveness
    velocity.current.lerp(direction.multiplyScalar(15), 0.05)
    pos.add(velocity.current.multiplyScalar(delta))

    // Fade trail based on velocity
    const speed = velocity.current.length()
    const trailOpacity = Math.min(1, speed * 0.1)
    particleRef.current.children[0].material.opacity = trailOpacity * 0.6

    // Update trail with longer fade
    trailRef.current.push(pos.clone())
    trailRef.current.shift()
  })

  return (
    <group ref={particleRef}>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={30}  // Increased trail length
            array={new Float32Array(90)}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={0x00ffff}
          transparent
          opacity={0.6}
          blending={THREE.AdditiveBlending}
        />
      </line>
      <mesh>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial
          color={0x00ffff}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

// Ground-level ambient light effects
const StreetSparkles = () => {
  const sparklesRef = useRef()
  const time = useRef(0)

  useFrame((state, delta) => {
    time.current += delta
    
    if (sparklesRef.current) {
      const colors = sparklesRef.current.geometry.attributes.color.array
      
      for (let i = 0; i < colors.length; i += 3) {
        const phase = time.current + i * 0.0001
        const flicker = Math.sin(phase * 5) * 0.5 + 0.5
        const randomBlink = Math.random() > 0.99 ? 1 : 0
        
        colors[i] = 0.2 * flicker + randomBlink * 0.3
        colors[i + 1] = 0.4 * flicker + randomBlink * 0.3
        colors[i + 2] = 0.3 * flicker + randomBlink * 0.3
      }
      
      sparklesRef.current.geometry.attributes.color.needsUpdate = true
    }
  })

  const { positions, colors } = useMemo(() => {
    const gridSize = 200  // Reduced for denser sparkles
    const spacing = 1.5   // Reduced spacing
    const points = []
    const cols = []
    
    for (let x = -gridSize/2; x < gridSize/2; x += spacing) {
      for (let z = -gridSize/2; z < gridSize/2; z += spacing) {
        if (Math.random() > 0.95) {  // Increased density
          points.push(x + (Math.random() - 0.5))
          points.push(0.1)
          points.push(z + (Math.random() - 0.5))
          
          cols.push(0.3)  // Increased brightness
          cols.push(0.6)
          cols.push(0.5)
        }
      }
    }
    
    return {
      positions: new Float32Array(points),
      colors: new Float32Array(cols)
    }
  }, [])

  return (
    <points ref={sparklesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.4}  // Increased size
        vertexColors
        transparent
        opacity={0.9}  // Increased opacity
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// Citywide neural network visualization
const GlobalNeuralNetwork = () => {
  const networkRef = useRef()
  const time = useRef(0)
  
  useFrame((state, delta) => {
    time.current += delta

    if (networkRef.current) {
      const positions = networkRef.current.geometry.attributes.position.array
      const colors = networkRef.current.geometry.attributes.color.array

      for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i]
        const y = positions[i + 1]
        const z = positions[i + 2]

        // Calculate wave patterns
        const wave = Math.sin(time.current * 2 + x * 0.05 + z * 0.05)
        const activation = Math.sin(time.current + y * 0.1)
        
        // Apply neural flash effects
        const flash = Math.random() > 0.9997 ? 0.8 : 0
        const neighborActivation = wave > 0.8 ? 0.5 : 0

        colors[i] = Math.max(0, 0.1 + flash)
        colors[i + 1] = Math.max(0, 0.4 + neighborActivation + flash)
        colors[i + 2] = Math.max(0, 0.3 + neighborActivation * 0.8 + flash)
      }
      
      networkRef.current.geometry.attributes.color.needsUpdate = true
    }
  })

  const { positions, colors } = useMemo(() => {
    // Initialize neural network grid
    const gridSize = 200
    const spacing = 10
    const points = []
    const cols = []
    
    // Distribute points with random height variation
    for (let x = -gridSize/2; x < gridSize/2; x += spacing) {
      for (let z = -gridSize/2; z < gridSize/2; z += spacing) {
        if (Math.random() > 0.7) { // Random distribution
          const y = Math.random() * 40 + 5
          points.push(x + (Math.random() - 0.5) * 5)
          points.push(y)
          points.push(z + (Math.random() - 0.5) * 5)
          
          cols.push(0)
          cols.push(0)
          cols.push(0)
        }
      }
    }
    
    return {
      positions: new Float32Array(points),
      colors: new Float32Array(cols)
    }
  }, [])

  return (
    <points ref={networkRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={colors.length / 3}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.5}
        vertexColors={true}
        transparent={true}
        opacity={0.6}
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// Main scene component with procedural city generation
const CityScene = () => {
  const [buildings, setBuildings] = useState([])

  useEffect(() => {
    // Configure city grid parameters
    const gridSize = 8
    const blockSize = 10
    const sampleBuildings = []

    // Generate buildings with density gradient from center
    for (let x = -gridSize; x <= gridSize; x++) {
      for (let z = -gridSize; z <= gridSize; z++) {
        const distFromCenter = Math.sqrt(x * x + z * z)
        const buildingChance = Math.max(0.4, 1 - distFromCenter / (gridSize * 0.8))
        
        if (Math.random() < buildingChance) {
          const buildingsInBlock = Math.floor(Math.random() * 3) + 1  // Increased max buildings
          
          for (let b = 0; b < buildingsInBlock; b++) {
            const offsetX = (Math.random() - 0.5) * blockSize * 0.7
            const offsetZ = (Math.random() - 0.5) * blockSize * 0.7
            
            sampleBuildings.push({
              x: x * blockSize * 2 + offsetX,
              y: z * blockSize * 2 + offsetZ,
              width: Math.random() * 4 + 2,
              depth: Math.random() * 4 + 2,
              height: Math.random() * 60 + 20  // Increased height range
            })
          }
        }
      }
    }

    setBuildings(sampleBuildings)
  }, [])

  return (
    <>
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 100, 300]} />
      
      <Streets />
      <StreetSparkles />
      <GlobalNeuralNetwork />
      {Array.from({ length: 100 }).map((_, i) => (
        <FlowingParticle key={i} />
      ))}
      
      {buildings.map((building, i) => (
        <group key={i}>
          <CityPoints building={building} />
          <NeuralArtifacts building={building} />
        </group>
      ))}
      
      <EffectComposer>
        <Bloom
          intensity={0.7}
          luminanceThreshold={0.2}
          luminanceSmoothing={0.9}
          blendFunction={BlendFunction.SCREEN}
        />
        <Noise opacity={0.02} />
        <Vignette eskil={false} offset={0.3} darkness={0.8} />
      </EffectComposer>
    </>
  )
}

export default CityScene