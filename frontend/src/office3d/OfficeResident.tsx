import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OfficePerson, type PersonActivity, type PersonVariant } from "./OfficePerson";

type Point = [number, number, number];
export type ResidentStop = Point | {
  position: Point;
  rotation?: number;
};

function resolveStop(stop: ResidentStop) {
  return Array.isArray(stop) ? { position: stop as Point, rotation: undefined } : stop;
}

export function OfficeResident({
  name,
  role,
  variant,
  route,
  activities,
  phrases,
  delay = 0,
  scale = 0.88,
  statusOverride,
  activityOverride,
  targetOverride,
  document = false,
  overrideTravelDamping = 0.62,
  travelMs = 7800,
  cycleMs = 27000,
  talkEvery = 4
  ,interactive = false,
  selected = false,
  hidden = false,
  speechOverride,
  onInteract
}: {
  name: string;
  role: string;
  variant: PersonVariant;
  route: ResidentStop[];
  activities?: PersonActivity[];
  phrases: string[];
  delay?: number;
  scale?: number;
  statusOverride?: string;
  activityOverride?: PersonActivity;
  targetOverride?: ResidentStop;
  document?: boolean;
  overrideTravelDamping?: number;
  travelMs?: number;
  cycleMs?: number;
  talkEvery?: number;
  interactive?: boolean;
  selected?: boolean;
  hidden?: boolean;
  speechOverride?: string | null;
  onInteract?: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [activity, setActivity] = useState<PersonActivity>(activities?.[0] ?? "working");
  const [speech, setSpeech] = useState<string | null>(null);
  const [overrideTraveling, setOverrideTraveling] = useState(false);
  const cycleRef = useRef(0);
  const initialPosition = useRef(resolveStop(route[0]).position).current;
  const routeStop = resolveStop(route[targetIndex]);
  const targetStop = targetOverride ? resolveStop(targetOverride) : routeStop;
  const target = targetStop.position;
  const overrideTargetKey = targetOverride ? `${target[0]}:${target[1]}:${target[2]}` : "";
  const safePhrases = useMemo(() => phrases.length ? phrases : ["Đang xử lý công việc."], [phrases]);

  useEffect(() => {
    let moveTimer = 0;
    let workTimer = 0;
    let speechTimer = 0;
    let clearSpeechTimer = 0;
    const beginCycle = () => {
      cycleRef.current += 1;
      setSpeech(null);
      const nextIndex = cycleRef.current % route.length;
      const nextStop = resolveStop(route[nextIndex]);
      const currentPosition = group.current?.position;
      const needsTravel = !currentPosition || Math.hypot(
        nextStop.position[0] - currentPosition.x,
        nextStop.position[2] - currentPosition.z
      ) > 0.08;
      const destinationActivity = activities?.[nextIndex] ?? "working";
      setTargetIndex(nextIndex);
      setActivity(needsTravel ? "walking" : destinationActivity);
      workTimer = window.setTimeout(() => {
        const talk = cycleRef.current % talkEvery === 0 && destinationActivity !== "sleeping" && destinationActivity !== "seated";
        setActivity(talk ? "talking" : destinationActivity);
        if (talk) {
          setSpeech(safePhrases[cycleRef.current % safePhrases.length]);
          clearSpeechTimer = window.setTimeout(() => setSpeech(null), 5800);
        }
      }, needsTravel ? travelMs : 0);
      moveTimer = window.setTimeout(beginCycle, cycleMs + (cycleRef.current % 3) * 2200);
    };
    speechTimer = window.setTimeout(beginCycle, 4200 + delay);
    return () => {
      window.clearTimeout(moveTimer);
      window.clearTimeout(workTimer);
      window.clearTimeout(speechTimer);
      window.clearTimeout(clearSpeechTimer);
    };
  }, [activities, cycleMs, delay, route.length, safePhrases, talkEvery, travelMs]);

  useEffect(() => {
    if (!targetOverride || !group.current) {
      setOverrideTraveling(false);
      return;
    }
    const distance = Math.hypot(
      target[0] - group.current.position.x,
      target[2] - group.current.position.z
    );
    setOverrideTraveling(distance > 0.1);
  }, [overrideTargetKey, targetOverride]);

  const displayedActivity = overrideTraveling ? "walking" : activityOverride ?? activity;
  const displayedStatus = statusOverride ?? statusFor(displayedActivity);
  const labelOffset: Point = displayedActivity === "sleeping"
    ? [0.15, 1.08, 0]
    : displayedActivity === "seated"
      ? [0, 1.78, 0]
      : [0, 1.95, 0];
  const speechOffset: Point = displayedActivity === "sleeping"
    ? [0.15, 1.5, 0]
    : displayedActivity === "seated"
      ? [0.35, 2.12, 0]
      : [0.35, 2.3, 0];

  useFrame((_, delta) => {
    if (!group.current) return;
    const dx = target[0] - group.current.position.x;
    const dz = target[2] - group.current.position.z;
    const distance = Math.hypot(dx, dz);
    const damping = overrideTraveling ? overrideTravelDamping : 0.62;
    group.current.position.x = THREE.MathUtils.damp(group.current.position.x, target[0], damping, delta);
    group.current.position.y = THREE.MathUtils.damp(group.current.position.y, target[1], 4, delta);
    group.current.position.z = THREE.MathUtils.damp(group.current.position.z, target[2], damping, delta);
    if (overrideTraveling && distance < 0.08) setOverrideTraveling(false);
    if (Math.abs(dx) + Math.abs(dz) > 0.04 && displayedActivity === "walking") {
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, Math.atan2(dx, dz), 8, delta);
    } else if (targetStop.rotation !== undefined) {
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, targetStop.rotation, 7, delta);
    }
  });

  if (hidden) return null;

  return <group
    ref={group}
    position={initialPosition}
    onClick={interactive ? (event) => { event.stopPropagation(); onInteract?.(); } : undefined}
    onPointerOver={interactive ? (event) => { event.stopPropagation(); globalThis.document.body.style.cursor = "pointer"; } : undefined}
    onPointerOut={interactive ? () => { globalThis.document.body.style.cursor = ""; } : undefined}
  >
    <OfficePerson
      name={name}
      role={role}
      status={displayedStatus}
      variant={variant}
      activity={displayedActivity}
      document={document}
      scale={scale}
      labelOffset={labelOffset}
      interactive={interactive}
      selected={selected}
      onInteract={onInteract}
    />
    {(speechOverride || (speech && !statusOverride)) && <Html position={speechOffset} center distanceFactor={10} zIndexRange={[30, 0]}>
      <div className={`scene-speech-bubble ${selected ? "interaction" : ""}`} role="status" aria-live="polite">{speechOverride || speech}</div>
    </Html>}
    {displayedActivity === "sleeping" && !statusOverride && <Html position={[0.48, 0.92, 0]} center distanceFactor={10} zIndexRange={[29, 0]}>
      <div className="scene-sleep-indicator"><span>Z</span><span>z</span><span>z</span></div>
    </Html>}
  </group>;
}

function statusFor(activity: PersonActivity) {
  if (activity === "walking") return "Đang di chuyển";
  if (activity === "talking") return "Đang trao đổi";
  if (activity === "working") return "Đang làm việc";
  if (activity === "seated") return "Đang làm việc tại bàn";
  if (activity === "sleeping") return "Đang nghỉ ngắn";
  if (activity === "smoking") return "Đang hút thuốc";
  return "Sẵn sàng";
}
