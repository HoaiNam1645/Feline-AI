import { Html, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

const STANDING_POSE = new THREE.Quaternion();
const SEATED_POSE = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.08, 0, 0));
const SUPINE_POSE = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0)
  )
);

export type PersonActivity = "idle" | "walking" | "working" | "seated" | "sleeping" | "smoking" | "handoff" | "receiving" | "talking";
export type PersonVariant = "director" | "feline" | "lemiex" | "etsy" | "tiktok" | "fela";

const PALETTES: Record<PersonVariant, {
  jacket: string;
  shirt: string;
  trousers: string;
  shoes: string;
  hair: string;
  skin: string;
  accent: string;
}> = {
  director: {
    jacket: "#7f2028",
    shirt: "#7f2028",
    trousers: "#514943",
    shoes: "#171716",
    hair: "#29211d",
    skin: "#c99070",
    accent: "#8f2832"
  },
  feline: {
    jacket: "#812832",
    shirt: "#f7ede2",
    trousers: "#463a35",
    shoes: "#251f1c",
    hair: "#3d2c25",
    skin: "#d3a07f",
    accent: "#c89546"
  },
  lemiex: {
    jacket: "#35685e",
    shirt: "#e8f0e9",
    trousers: "#344a45",
    shoes: "#1e2a27",
    hair: "#30251f",
    skin: "#d2a07d",
    accent: "#d0a653"
  },
  etsy: {
    jacket: "#b66c3c",
    shirt: "#fff2e8",
    trousers: "#50413a",
    shoes: "#29211d",
    hair: "#4b3025",
    skin: "#d8a583",
    accent: "#f0b36d"
  },
  tiktok: {
    jacket: "#335f63",
    shirt: "#edf6f3",
    trousers: "#36484a",
    shoes: "#1d2829",
    hair: "#28201d",
    skin: "#c89170",
    accent: "#d66b72"
  },
  fela: {
    jacket: "#6f5d83",
    shirt: "#f4eff8",
    trousers: "#453d4d",
    shoes: "#28222d",
    hair: "#3b2923",
    skin: "#d2a07f",
    accent: "#d1ad65"
  }
};

export function OfficePerson({
  name,
  role,
  status,
  variant,
  activity = "idle",
  document = false,
  position = [0, 0, 0],
  labelOffset = [0, 2.02, 0],
  scale = 1,
  interactive = false,
  selected = false,
  onInteract
}: {
  name: string;
  role: string;
  status: string;
  variant: PersonVariant;
  activity?: PersonActivity;
  document?: boolean;
  position?: [number, number, number];
  labelOffset?: [number, number, number];
  scale?: number;
  interactive?: boolean;
  selected?: boolean;
  onInteract?: () => void;
}) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const smoke = useRef<THREE.Group>(null);
  const palette = PALETTES[variant];
  const isDirector = variant === "director";

  useFrame((state, delta) => {
    if (!root.current || !torso.current || !leftArm.current || !rightArm.current || !leftLeg.current || !rightLeg.current) return;
    const time = state.clock.elapsedTime;
    const walking = activity === "walking";
    const working = activity === "working" || activity === "seated";
    const seated = activity === "seated";
    const sleeping = activity === "sleeping";
    const smoking = activity === "smoking";
    const handoff = activity === "handoff" || activity === "receiving" || activity === "talking" || smoking;
    const swing = walking ? Math.sin(time * 5.4) * 0.52 : 0;
    const armTarget = smoking ? -1.25 + Math.sin(time * 1.4) * 0.04 : working ? -0.72 + Math.sin(time * 4.6) * 0.07 : activity === "talking" ? -0.45 + Math.sin(time * 2.4) * 0.22 : handoff ? -0.9 : swing;

    leftArm.current.rotation.x = THREE.MathUtils.damp(leftArm.current.rotation.x, sleeping ? -0.12 : working ? -0.62 : handoff ? -0.45 : -swing, 8, delta);
    rightArm.current.rotation.x = THREE.MathUtils.damp(rightArm.current.rotation.x, sleeping ? 0.12 : armTarget, 8, delta);
    leftLeg.current.rotation.x = THREE.MathUtils.damp(leftLeg.current.rotation.x, seated ? -1.18 : sleeping ? -0.08 : swing, 9, delta);
    rightLeg.current.rotation.x = THREE.MathUtils.damp(rightLeg.current.rotation.x, seated ? -1.18 : sleeping ? 0.08 : -swing, 9, delta);
    const pose = sleeping ? SUPINE_POSE : seated ? SEATED_POSE : STANDING_POSE;
    torso.current.quaternion.slerp(pose, 1 - Math.exp(-6 * delta));
    torso.current.position.y = THREE.MathUtils.damp(
      torso.current.position.y,
      sleeping ? 0.3 : seated ? -0.14 : walking ? Math.abs(Math.sin(time * 5.4)) * 0.03 : Math.sin(time * 1.35) * 0.008,
      8,
      delta
    );
    if (smoke.current) {
      smoke.current.position.y = 1.5 + (time % 3.2) * 0.075;
      smoke.current.rotation.y = time * 0.3;
    }
  });

  return <group ref={root} position={position} scale={scale}>
    <group ref={torso}>
      <group position={[0, 1.38, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.255, 24, 20]} />
          <meshStandardMaterial color={palette.skin} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 0.12, -0.08]} scale={[1.03, 0.62, 1.02]}>
          <sphereGeometry args={[0.26, 20, 16, 0, Math.PI * 2, 0, Math.PI / 1.75]} />
          <meshStandardMaterial color={palette.hair} roughness={0.88} />
        </mesh>
        <mesh position={[0, -0.01, 0.245]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.035, 0.085, 10]} />
          <meshStandardMaterial color={palette.skin} roughness={0.8} />
        </mesh>
      </group>

      <mesh castShadow position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.095, 0.11, 0.16, 14]} />
        <meshStandardMaterial color={palette.skin} roughness={0.72} />
      </mesh>

      <RoundedBox args={[isDirector ? 0.69 : 0.64, 0.73, isDirector ? 0.39 : 0.35]} radius={0.12} smoothness={4} position={[0, 0.78, 0]} castShadow>
        <meshStandardMaterial color={palette.jacket} roughness={0.68} />
      </RoundedBox>
      {isDirector && <mesh castShadow position={[0, 0.67, 0.08]} scale={[0.34, 0.3, 0.25]}>
        <sphereGeometry args={[1, 24, 18]} />
        <meshStandardMaterial color={palette.jacket} roughness={0.7} />
      </mesh>}
      {!isDirector && <mesh position={[0, 0.83, 0.19]}>
        <boxGeometry args={[0.2, 0.55, 0.015]} />
        <meshStandardMaterial color={palette.shirt} roughness={0.78} />
      </mesh>}
      {!isDirector && <mesh position={[0, 0.83, 0.205]}>
        <boxGeometry args={[0.055, 0.43, 0.018]} />
        <meshStandardMaterial color={palette.accent} roughness={0.72} />
      </mesh>}
      {!isDirector && <RoundedBox args={[0.18, 0.12, 0.035]} radius={0.02} smoothness={3} position={[0.23, 0.89, 0.195]}>
        <meshStandardMaterial color="#f6f0e5" roughness={0.7} />
      </RoundedBox>}

      <group ref={leftArm} position={[isDirector ? -0.42 : -0.38, 0.98, 0]}>
        <mesh castShadow position={[0, isDirector ? -0.16 : -0.26, 0]}>
          <capsuleGeometry args={[0.095, isDirector ? 0.18 : 0.38, 6, 12]} />
          <meshStandardMaterial color={palette.jacket} roughness={0.7} />
        </mesh>
        {isDirector && <mesh castShadow position={[0, -0.39, 0]}><capsuleGeometry args={[0.085, 0.22, 6, 12]} /><meshStandardMaterial color={palette.skin} roughness={0.75} /></mesh>}
        <mesh castShadow position={[0, -0.52, 0]}>
          <sphereGeometry args={[0.1, 14, 12]} />
          <meshStandardMaterial color={palette.skin} roughness={0.75} />
        </mesh>
      </group>
      <group ref={rightArm} position={[isDirector ? 0.42 : 0.38, 0.98, 0]}>
        <mesh castShadow position={[0, isDirector ? -0.16 : -0.26, 0]}>
          <capsuleGeometry args={[0.095, isDirector ? 0.18 : 0.38, 6, 12]} />
          <meshStandardMaterial color={palette.jacket} roughness={0.7} />
        </mesh>
        {isDirector && <mesh castShadow position={[0, -0.39, 0]}><capsuleGeometry args={[0.085, 0.22, 6, 12]} /><meshStandardMaterial color={palette.skin} roughness={0.75} /></mesh>}
        <mesh castShadow position={[0, -0.52, 0]}>
          <sphereGeometry args={[0.1, 14, 12]} />
          <meshStandardMaterial color={palette.skin} roughness={0.75} />
        </mesh>
      </group>

      <group ref={leftLeg} position={[-0.17, 0.44, 0]}>
        <mesh castShadow position={[0, isDirector ? -0.16 : -0.28, 0]}>
          <capsuleGeometry args={[0.105, isDirector ? 0.16 : 0.38, 6, 12]} />
          <meshStandardMaterial color={palette.trousers} roughness={0.76} />
        </mesh>
        {isDirector && <mesh castShadow position={[0, -0.41, 0]}><capsuleGeometry args={[0.09, 0.25, 6, 12]} /><meshStandardMaterial color={palette.skin} roughness={0.76} /></mesh>}
        <RoundedBox args={[0.22, 0.14, 0.38]} radius={0.05} smoothness={3} position={[0, -0.55, 0.08]} castShadow>
          <meshStandardMaterial color={palette.shoes} roughness={0.82} />
        </RoundedBox>
      </group>
      <group ref={rightLeg} position={[0.17, 0.44, 0]}>
        <mesh castShadow position={[0, isDirector ? -0.16 : -0.28, 0]}>
          <capsuleGeometry args={[0.105, isDirector ? 0.16 : 0.38, 6, 12]} />
          <meshStandardMaterial color={palette.trousers} roughness={0.76} />
        </mesh>
        {isDirector && <mesh castShadow position={[0, -0.41, 0]}><capsuleGeometry args={[0.09, 0.25, 6, 12]} /><meshStandardMaterial color={palette.skin} roughness={0.76} /></mesh>}
        <RoundedBox args={[0.22, 0.14, 0.38]} radius={0.05} smoothness={3} position={[0, -0.55, 0.08]} castShadow>
          <meshStandardMaterial color={palette.shoes} roughness={0.82} />
        </RoundedBox>
      </group>

      {document && <group position={[0.43, 0.61, 0.31]} rotation={[-0.08, -0.12, -0.12]}>
        <RoundedBox args={[0.42, 0.32, 0.045]} radius={0.025} smoothness={3} castShadow>
          <meshStandardMaterial color="#fffaf0" roughness={0.68} />
        </RoundedBox>
        <mesh position={[0, 0.05, 0.026]}>
          <boxGeometry args={[0.26, 0.025, 0.008]} />
          <meshStandardMaterial color={palette.accent} />
        </mesh>
        <mesh position={[-0.045, -0.035, 0.026]}>
          <boxGeometry args={[0.17, 0.018, 0.008]} />
          <meshStandardMaterial color="#b9aa96" />
        </mesh>
      </group>}
      {activity === "smoking" && <>
        <group position={[0.36, 1.25, 0.28]} rotation={[0, 0, -Math.PI / 2]}>
          <mesh><cylinderGeometry args={[0.018, 0.018, 0.24, 10]} /><meshStandardMaterial color="#eee5d8" roughness={0.8} /></mesh>
          <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.021, 0.021, 0.035, 10]} /><meshStandardMaterial color="#d46343" emissive="#b63b2c" emissiveIntensity={0.8} /></mesh>
        </group>
        <group ref={smoke} position={[0.52, 1.5, 0.28]}>
          {[0, 1, 2, 3, 4, 5, 6].map((index) => <mesh key={index} position={[Math.sin(index * 1.45) * (0.055 + index * 0.012), index * 0.14, Math.cos(index * 1.2) * 0.035]} scale={0.72 + index * 0.12}>
            <sphereGeometry args={[0.06, 12, 10]} />
            <meshStandardMaterial color="#ddd7cf" transparent opacity={Math.max(0.06, 0.25 - index * 0.027)} depthWrite={false} />
          </mesh>)}
        </group>
      </>}
    </group>

    {!selected && <Html position={labelOffset} center distanceFactor={11} zIndexRange={[20, 0]}>
      {interactive ? <button type="button" className={`scene-character-status interactive ${selected ? "selected" : ""} ${variant}`} onClick={(event) => { event.stopPropagation(); onInteract?.(); }} aria-label={`Trò chuyện với ${name}`}>
        <span className="scene-character-name">{name}<small>{role}</small></span>
        <span className="scene-character-activity"><i />{status}</span>
      </button> : <div className={`scene-character-status ${variant}`}>
        <span className="scene-character-name">{name}<small>{role}</small></span>
        <span className="scene-character-activity"><i />{status}</span>
      </div>}
    </Html>}
  </group>;
}
