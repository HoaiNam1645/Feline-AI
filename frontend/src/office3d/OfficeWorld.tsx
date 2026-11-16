import { Html, RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import * as THREE from "three";
import { OfficePerson } from "./OfficePerson";
import { OfficeResident } from "./OfficeResident";
import { agentStatus, type CeoIdleState, type VisualPhase } from "./office-status";

type Point = [number, number, number];

const TASK_ROUTE: Point[] = [
  [-7.55, 0.14, -1.5],
  [-6.8, 0.14, -1.75],
  [-6.5, 0.14, -2.75],
  [-5.55, 0.14, -2.75],
  [-5.5, 0.14, 0],
  [2.2, 0.14, 0],
  [4.55, 0.14, 0],
  [5.2, 0.14, 0.2],
  [7.1, 0.14, -0.45]
];

export function OfficeWorld({
  phase,
  ceoIdleState,
  scope = "all",
  selectedAgent,
  selectedAgentSpeech,
  onAgentInteract
}: {
  phase: VisualPhase;
  ceoIdleState: CeoIdleState;
  scope?: "all" | "lemiex";
  selectedAgent?: "tiktok" | null;
  selectedAgentSpeech?: string | null;
  onAgentInteract?: (agent: "tiktok" | "lemiex") => void;
}) {
  if (scope === "lemiex") {
    return <group scale={1.22}>
      <WorkshopGround />
      <LemiexWorkshop phase="IDLE" position={[0, 0, 0]} interactive onInteract={() => onAgentInteract?.("lemiex")} />
    </group>;
  }
  return <group scale={1.1}>
    <CampusGround />
    <FelineCampus phase={phase} ceoIdleState={ceoIdleState} selectedAgent={selectedAgent} selectedAgentSpeech={selectedAgentSpeech} onAgentInteract={onAgentInteract} />
    <LemiexWorkshop phase={phase} />
    <IntercompanyPath />
    <TaskCourier phase={phase} />
  </group>;
}

function WorkshopGround() {
  return <group>
    <RoundedBox args={[12, 0.34, 10]} radius={0.4} smoothness={5} position={[0, -0.2, 0]} receiveShadow>
      <meshStandardMaterial color="#d9e1da" roughness={0.92} />
    </RoundedBox>
    {[-5.1, 5.1].map((x) => <Tree key={x} position={[x, 0, 4]} />)}
  </group>;
}

function CampusGround() {
  return <group>
    <RoundedBox args={[31, 0.34, 16]} radius={0.4} smoothness={5} position={[0, -0.2, 0]} receiveShadow>
      <meshStandardMaterial color="#ded6ca" roughness={0.92} />
    </RoundedBox>
    <mesh receiveShadow position={[0, -0.005, 6.15]}>
      <boxGeometry args={[30.2, 0.06, 2.6]} />
      <meshStandardMaterial color="#c8c0b5" roughness={0.95} />
    </mesh>
    {[-13.4, -11.8, 11.8, 13.4].map((x) => <Tree key={x} position={[x, 0, 6.15]} />)}
    {[-0.7, 1.1, 3].map((x) => <Planter key={x} position={[x, 0, 4.7]} compact />)}
  </group>;
}

function FelineCampus({ phase, ceoIdleState, selectedAgent, selectedAgentSpeech, onAgentInteract }: { phase: VisualPhase; ceoIdleState: CeoIdleState; selectedAgent?: "tiktok" | null; selectedAgentSpeech?: string | null; onAgentInteract?: (agent: "tiktok" | "lemiex") => void }) {
  const taskActive = phase !== "IDLE" && phase !== "COMPLETE" && phase !== "ERROR";
  const ceoIdleActivity = ceoIdleState === "DESK" ? "seated" : ceoIdleState === "SMOKING" ? "smoking" : "sleeping";
  const ceoTaskActivity = phase === "OUTBOUND"
    ? "talking"
    : phase === "DELIVERY"
      ? "receiving"
      : taskActive || phase === "COMPLETE"
        ? "seated"
        : phase === "IDLE" || phase === "ERROR"
          ? ceoIdleActivity
          : "seated";
  const ceoGaming = ceoTaskActivity === "seated";
  const ceoSleepPosition = { position: [-3.05, 0.32, -4] as Point, rotation: 0 };
  const ceoDeskPosition = { position: [-4.85, 0.13, -3.12] as Point, rotation: 0 };
  const ceoSmokingPosition = { position: [-5.7, 0.13, -1.55] as Point, rotation: Math.PI / 2 };
  const ceoIdlePosition = ceoIdleState === "DESK" ? ceoDeskPosition : ceoIdleState === "SMOKING" ? ceoSmokingPosition : ceoSleepPosition;
  return <group position={[-5.25, 0, 0]}>
    <FelineExteriorWalls />
    <OpenOfficeShell />
    <DepartmentRoom title="Phòng Giám đốc" subtitle="CEO AI Feline" tone="director" position={[-3.75, 0, -2.75]} size={[5.8, 4.1]} doorSide="right">
      <ExecutiveDesk position={[-1.1, 0.72, 0.45]} gaming={ceoGaming} />
      <Lounge position={[0.85, 0.3, -1.25]} />
      <Library position={[-2.45, 1, -1.55]} />
      <Planter position={[2.25, 0, 0.85]} compact />
    </DepartmentRoom>
    <DepartmentRoom title="Sell Etsy" subtitle="Sản phẩm & gian hàng" tone="etsy" position={[3.25, 0, -2.75]} size={[5.8, 4.1]} doorSide="left">
      <TeamDesk position={[-0.25, 0.68, -0.35]} accent="#b66c3c" />
      <Moodboard position={[0.55, 1.5, -1.95]} colors={["#d77842", "#f1c59f", "#8c563b"]} />
      <ProductShelf position={[2.45, 0.9, 0.95]} accent="#c37b4b" />
    </DepartmentRoom>
    <DepartmentRoom title="Sell TikTok" subtitle="Nội dung & livestream" tone="tiktok" position={[-3.75, 0, 2.65]} size={[5.8, 4.1]} doorSide="right">
      <CreatorDesk position={[-0.75, 0.67, -0.15]} />
      <StudioSet position={[1.55, 0, 0.45]} />
    </DepartmentRoom>
    <DepartmentRoom title="Sell Fela" subtitle="Thương hiệu & tăng trưởng" tone="fela" position={[3.25, 0, 2.65]} size={[5.8, 4.1]} doorSide="left">
      <TeamDesk position={[-0.45, 0.68, -0.15]} accent="#6f5d83" />
      <MeetingNook position={[1.85, 0.34, 0.8]} />
      <BrandStrategyWall position={[0.2, 1.45, -1.95]} />
    </DepartmentRoom>
    <CommonHub />

    <OfficeResident
      name="CEO AI Feline"
      role="Phòng Giám đốc"
      variant="director"
      route={[ceoIdlePosition]}
      activities={[ceoIdleActivity]}
      phrases={["Mình xem lại ưu tiên hôm nay nhé.", "Phòng nào cần hỗ trợ cứ báo mình.", "Kết quả cần rõ và có căn cứ."]}
      statusOverride={phase === "IDLE" || phase === "ERROR" ? undefined : agentStatus("CEO", phase)}
      activityOverride={ceoTaskActivity}
      targetOverride={phase === "IDLE" || phase === "ERROR" ? ceoIdlePosition : ceoDeskPosition}
      document={phase === "COMPLETE"}
      overrideTravelDamping={0.3}
      travelMs={8200}
      cycleMs={22000}
      talkEvery={5}
      scale={1.04}
      hidden={selectedAgent === "tiktok"}
    />
    <OfficeResident
      name="Etsy AI"
      role="Sell Etsy"
      variant="etsy"
      route={[
        { position: [2.15, 0.13, -3.96], rotation: 0 },
        { position: [1.25, 0.13, -4.35], rotation: -Math.PI / 2 },
        { position: [-0.25, 0.13, -2.75], rotation: -Math.PI / 2 },
        { position: [1.5, 0.13, -1.45], rotation: Math.PI },
        { position: [-0.25, 0.13, -2.75], rotation: Math.PI / 2 },
        { position: [1.25, 0.13, -4.35], rotation: Math.PI / 2 }
      ]}
      activities={["seated", "working", "talking", "working", "talking", "seated"]}
      phrases={["Mẫu này hợp mùa quà tặng đấy.", "Mình đang kiểm tra lại listing.", "Ảnh đầu tiên cần rõ sản phẩm hơn."]}
      delay={900}
      travelMs={7600}
      cycleMs={29000}
      talkEvery={3}
      hidden={selectedAgent === "tiktok"}
    />
    <OfficeResident
      name="TikTok AI"
      role="Sell TikTok"
      variant="tiktok"
      route={[
        { position: [-4.5, 0.13, 1.64], rotation: 0 },
        { position: [-2.75, 0.13, 1.15], rotation: Math.PI / 2 },
        { position: [-0.25, 0.13, 2.65], rotation: Math.PI / 2 },
        { position: [-2.2, 0.13, 3.55], rotation: Math.PI },
        { position: [-0.25, 0.13, 2.65], rotation: -Math.PI / 2 },
        { position: [-2.75, 0.13, 1.15], rotation: -Math.PI / 2 }
      ]}
      activities={["seated", "working", "talking", "working", "talking", "seated"]}
      phrases={["Khung giờ này tương tác đang tốt.", "Chuẩn bị nội dung cho phiên live nhé.", "Mình đang xem lại hiệu suất video."]}
      delay={1900}
      travelMs={8600}
      cycleMs={31000}
      talkEvery={4}
      interactive
      selected={selectedAgent === "tiktok"}
      onInteract={() => onAgentInteract?.("tiktok")}
      targetOverride={selectedAgent === "tiktok" ? { position: [-4.5, 0.13, 1.64], rotation: 0 } : undefined}
      activityOverride={selectedAgent === "tiktok" ? "talking" : undefined}
      statusOverride={selectedAgent === "tiktok" ? "Đang trò chuyện" : undefined}
      speechOverride={selectedAgent === "tiktok" ? selectedAgentSpeech : undefined}
    />
    <OfficeResident
      name="Fela AI"
      role="Sell Fela"
      variant="fela"
      route={[
        { position: [2.05, 0.13, 1.64], rotation: 0 },
        { position: [1.15, 0.13, 1.15], rotation: -Math.PI / 2 },
        { position: [-0.25, 0.13, 2.65], rotation: -Math.PI / 2 },
        { position: [4.45, 0.13, 3.65], rotation: Math.PI },
        { position: [-0.25, 0.13, 2.65], rotation: Math.PI / 2 },
        { position: [1.15, 0.13, 1.15], rotation: Math.PI / 2 }
      ]}
      activities={["seated", "working", "talking", "seated", "talking", "working"]}
      phrases={["Mình đang đối chiếu nhóm sản phẩm.", "Ưu tiên trải nghiệm khách hàng trước.", "Có một ý tưởng cần trao đổi thêm."]}
      delay={2800}
      travelMs={8000}
      cycleMs={27500}
      talkEvery={5}
      hidden={selectedAgent === "tiktok"}
    />

    <Html position={[-0.2, 3.7, -5]} center transform distanceFactor={16}>
      <div className="scene-company-sign feline"><strong>FELINE AI</strong><span>Văn phòng điều hành</span></div>
    </Html>
  </group>;
}

function FelineExteriorWalls() {
  return <group>
    <mesh position={[0, 0.48, 5.48]} castShadow receiveShadow>
      <boxGeometry args={[14.9, 0.92, 0.22]} />
      <meshStandardMaterial color="#f0e5d7" roughness={0.82} />
    </mesh>
    <mesh position={[0, 0.97, 5.48]} castShadow>
      <boxGeometry args={[15.02, 0.08, 0.3]} />
      <meshStandardMaterial color="#812832" roughness={0.64} />
    </mesh>
    {[-3.38, 3.38].map((z) => <group key={z}>
      <mesh position={[7.48, 0.48, z]} castShadow receiveShadow>
        <boxGeometry args={[0.22, 0.92, 4.68]} />
        <meshStandardMaterial color="#f0e5d7" roughness={0.82} />
      </mesh>
      <mesh position={[7.48, 0.97, z]} castShadow>
        <boxGeometry args={[0.3, 0.08, 4.8]} />
        <meshStandardMaterial color="#812832" roughness={0.64} />
      </mesh>
    </group>)}
    {[-1.05, 1.05].map((z) => <mesh key={z} position={[7.48, 0.68, z]} castShadow>
      <boxGeometry args={[0.32, 1.34, 0.32]} />
      <meshStandardMaterial color="#6b4a42" roughness={0.7} />
    </mesh>)}
    <mesh position={[7.46, 0.12, 0]} receiveShadow>
      <boxGeometry args={[0.38, 0.08, 2.08]} />
      <meshStandardMaterial color="#c6933b" roughness={0.72} />
    </mesh>
  </group>;
}

function OpenOfficeShell() {
  return <group>
    <RoundedBox args={[14.7, 0.2, 10.8]} radius={0.14} smoothness={4} position={[0, 0.02, 0]} receiveShadow>
      <meshStandardMaterial color="#f5ede1" roughness={0.84} />
    </RoundedBox>
    <mesh castShadow receiveShadow position={[0, 1.65, -5.3]}>
      <boxGeometry args={[14.7, 3.2, 0.2]} />
      <meshStandardMaterial color="#fffaf2" roughness={0.76} />
    </mesh>
    <mesh castShadow receiveShadow position={[-7.25, 1.65, 0]}>
      <boxGeometry args={[0.2, 3.2, 10.6]} />
      <meshStandardMaterial color="#fffaf2" roughness={0.76} />
    </mesh>
    <mesh position={[0, 0.15, 5.22]}>
      <boxGeometry args={[14.4, 0.13, 0.2]} />
      <meshStandardMaterial color="#812832" />
    </mesh>
    <mesh position={[7.2, 1.6, -2.7]}>
      <boxGeometry args={[0.1, 3.05, 5.25]} />
      <meshPhysicalMaterial color="#d2dedb" transparent opacity={0.3} roughness={0.18} />
    </mesh>
    <OfficeCorridors />
  </group>;
}

function OfficeCorridors() {
  return <group>
    <mesh position={[-0.25, 0.105, 0]} receiveShadow>
      <boxGeometry args={[1.45, 0.05, 10.1]} />
      <meshStandardMaterial color="#dfd2bf" roughness={0.9} />
    </mesh>
    <mesh position={[-0.25, 0.11, 0]} receiveShadow>
      <boxGeometry args={[13.7, 0.055, 1.2]} />
      <meshStandardMaterial color="#e3d6c4" roughness={0.9} />
    </mesh>
    {[-3.6, 3.15].map((x) => <group key={x} position={[x, 0, 0]}>
      <CorridorBench position={[0, 0.25, 0]} />
    </group>)}
    <WaterStation position={[-0.25, 0, 4.25]} />
    <Html position={[-0.25, 0.28, -0.1]} center transform distanceFactor={9}>
      <div className="scene-corridor-label">HÀNH LANG TRUNG TÂM</div>
    </Html>
  </group>;
}

function DepartmentRoom({ title, subtitle, tone, position, size, doorSide, children }: {
  title: string;
  subtitle: string;
  tone: "director" | "etsy" | "tiktok" | "fela";
  position: Point;
  size: [number, number];
  doorSide: "left" | "right";
  children: ReactNode;
}) {
  const accent = { director: "#812832", etsy: "#b66c3c", tiktok: "#356b6b", fela: "#6f5d83" }[tone];
  return <group position={position}>
    <mesh position={[0, 0.075, 0]} receiveShadow>
      <boxGeometry args={[size[0], 0.035, size[1]]} />
      <meshStandardMaterial color={tone === "director" ? "#f2e3dc" : "#f6f0e7"} roughness={0.92} />
    </mesh>
    <DoorPartition side={doorSide} width={size[0]} depth={size[1]} />
    <mesh position={[0, 0.72, position[2] < 0 ? size[1] / 2 : -size[1] / 2]}>
      <boxGeometry args={[size[0], 1.35, 0.07]} />
      <meshPhysicalMaterial color="#d4dfdc" transparent opacity={0.27} roughness={0.2} />
    </mesh>
    <mesh position={[-size[0] / 2 + 0.04, 0.12, 0]}>
      <boxGeometry args={[0.09, 0.16, size[1] - 0.25]} />
      <meshStandardMaterial color={accent} roughness={0.62} />
    </mesh>
    {children}
    <Html position={[-size[0] / 2 + 0.72, 0.36, -size[1] / 2 + 0.3]} center transform distanceFactor={8}>
      <div className={`scene-department-sign ${tone}`}><strong>{title}</strong><span>{subtitle}</span></div>
    </Html>
  </group>;
}

function DoorPartition({ side, width, depth }: { side: "left" | "right"; width: number; depth: number }) {
  const x = side === "right" ? width / 2 : -width / 2;
  const segment = (depth - 1.25) / 2;
  return <group position={[x, 0, 0]}>
    {[-1, 1].map((direction) => <mesh key={direction} position={[0, 0.94, direction * (0.625 + segment / 2)]} castShadow>
      <boxGeometry args={[0.1, 1.8, segment]} />
      <meshStandardMaterial color="#f4eee5" roughness={0.74} />
    </mesh>)}
    <mesh position={[0, 1.78, 0]} castShadow><boxGeometry args={[0.11, 0.12, 1.28]} /><meshStandardMaterial color="#a59687" /></mesh>
    {[-0.63, 0.63].map((z) => <mesh key={z} position={[0, 0.92, z]}><boxGeometry args={[0.12, 1.72, 0.1]} /><meshStandardMaterial color="#a59687" /></mesh>)}
    <group position={[0, 0.9, -0.6]} rotation={[0, side === "right" ? -0.85 : 0.85, 0]}>
      <RoundedBox args={[0.06, 1.65, 1.1]} radius={0.04} smoothness={3} position={[0, 0, 0.55]} castShadow><meshPhysicalMaterial color="#c8d8d4" transparent opacity={0.56} roughness={0.16} /></RoundedBox>
      <mesh position={[side === "right" ? -0.055 : 0.055, 0, 0.96]} castShadow><sphereGeometry args={[0.05, 12, 10]} /><meshStandardMaterial color="#b48b43" metalness={0.4} roughness={0.36} /></mesh>
      <mesh position={[0, 0, 0]} castShadow><cylinderGeometry args={[0.045, 0.045, 1.58, 10]} /><meshStandardMaterial color="#8e8175" metalness={0.25} roughness={0.5} /></mesh>
    </group>
  </group>;
}

function CommonHub() {
  return <group position={[0, 0, 0]}>
    <RoundedBox args={[1.15, 0.08, 0.78]} radius={0.14} smoothness={4} position={[-0.25, 0.15, 0]}><meshStandardMaterial color="#c7a67e" roughness={0.7} /></RoundedBox>
    <Planter position={[0.62, 0, 0]} compact />
    <Html position={[-0.25, 0.46, 0.55]} center transform distanceFactor={9}>
      <div className="scene-common-label">KHU TRAO ĐỔI</div>
    </Html>
  </group>;
}

function LemiexWorkshop({ phase, position = [8.5, 0, 0], interactive = false, onInteract }: { phase: VisualPhase; position?: Point; interactive?: boolean; onInteract?: () => void }) {
  const active = phase === "PROCESSING" || phase === "HANDOFF";
  const taskPosition = phase === "PROCESSING"
    ? { position: [-1.9, 0.13, -1.2] as Point, rotation: 0 }
    : phase === "OUTBOUND" || phase === "ARRIVAL" || phase === "HANDOFF" || phase === "RETURNING"
      ? { position: [-2.05, 0.13, -0.45] as Point, rotation: -Math.PI / 2 }
      : undefined;
  const taskActivity = phase === "OUTBOUND"
    ? "walking"
    : phase === "ARRIVAL"
      ? "receiving"
    : phase === "PROCESSING"
      ? "working"
      : phase === "HANDOFF"
        ? "handoff"
        : phase === "RETURNING"
          ? "idle"
          : undefined;
  return <group position={position}>
    <WorkshopShell />
    <EmbroideryStations active={active} />
    <PackingLine position={[0.4, 0.44, 1.8]} />
    <StorageWall position={[3.15, 1.15, 0.5]} />
    <MetricsScreen position={[-0.35, 2, -3.45]} color="#35685e" />
    <Planter position={[-3.25, 0, 2.8]} compact />
    <OfficeResident
      name="Lemiex AI"
      role="Xưởng fulfillment thêu"
      variant="lemiex"
      route={[[-3.1, 0.13, -0.35], [-2.75, 0.13, 2.75], [-1.75, 0.13, 2.75], [-2.75, 0.13, 2.75]]}
      phrases={["Máy thêu đang chạy ổn định.", "Mình kiểm tra lại lô hàng này.", "Khu đóng gói đã sẵn sàng."]}
      statusOverride={phase === "OUTBOUND" || phase === "ARRIVAL" || active || phase === "RETURNING" ? agentStatus("LEMIEX", phase) : undefined}
      activityOverride={taskActivity}
      targetOverride={taskPosition}
      scale={1}
      interactive={interactive}
      onInteract={onInteract}
    />
    <OfficeResident
      name="Điều phối xưởng"
      role="Fulfillment"
      variant="lemiex"
      route={[[1.75, 0.13, -2.25], [1.75, 0.13, 0.2], [2.75, 0.13, 2.75], [1.75, 0.13, 0.2]]}
      phrases={["Đơn này chuyển sang khu đóng gói nhé.", "Kiểm lại chỉ thêu trước khi chạy.", "Lô tiếp theo đã sẵn sàng."]}
      delay={1500}
      scale={0.9}
    />
    <Html position={[0, 3.9, -3.35]} center transform distanceFactor={16}>
      <div className="scene-company-sign lemiex"><strong>LEMIEX</strong><span>Xưởng fulfillment thêu</span></div>
    </Html>
  </group>;
}

function WorkshopShell() {
  return <group>
    <RoundedBox args={[8.2, 0.2, 7.7]} radius={0.12} smoothness={4} position={[0, 0.02, 0]} receiveShadow>
      <meshStandardMaterial color="#e5ede6" roughness={0.84} />
    </RoundedBox>
    <mesh castShadow receiveShadow position={[0, 1.75, -3.75]}>
      <boxGeometry args={[8.2, 3.4, 0.2]} />
      <meshStandardMaterial color="#f2f7f2" roughness={0.75} />
    </mesh>
    {[-2.4, 2.4].map((z) => <mesh key={z} castShadow receiveShadow position={[-4, 1.75, z]}>
      <boxGeometry args={[0.2, 3.4, 2.7]} />
      <meshStandardMaterial color="#edf4ed" roughness={0.75} />
    </mesh>)}
    <mesh castShadow position={[-4, 3.18, 0]}>
      <boxGeometry args={[0.22, 0.54, 2.1]} />
      <meshStandardMaterial color="#dce9df" roughness={0.72} />
    </mesh>
    <mesh position={[0, 0.15, 3.7]}><boxGeometry args={[8, 0.13, 0.2]} /><meshStandardMaterial color="#35685e" /></mesh>
  </group>;
}

function EmbroideryStations({ active }: { active: boolean }) {
  return <group position={[-0.65, 0, -1.25]}>
    {[-1.25, 1.25].map((x, index) => <group key={x} position={[x, 0, 0]}>
      <RoundedBox args={[1.65, 0.82, 1.15]} radius={0.08} smoothness={4} position={[0, 0.42, 0]} castShadow>
        <meshStandardMaterial color="#d8ddd8" roughness={0.72} />
      </RoundedBox>
      <mesh position={[0, 0.94, -0.05]}><boxGeometry args={[0.85, 0.42, 0.1]} /><meshStandardMaterial color="#334945" emissive={active ? "#4da78f" : "#111c1a"} emissiveIntensity={active ? 0.35 : 0.05} /></mesh>
      <mesh position={[0, 0.38, 0.63]}><torusGeometry args={[0.28, 0.035, 10, 24]} /><meshStandardMaterial color={index ? "#c89145" : "#7b3037"} /></mesh>
    </group>)}
  </group>;
}

function IntercompanyPath() {
  return <group>
    <RoundedBox args={[5, 0.11, 1.65]} radius={0.28} smoothness={5} position={[2.25, 0.08, 0]} receiveShadow>
      <meshStandardMaterial color="#eee2d1" roughness={0.82} />
    </RoundedBox>
    {[-0.1, 0.8, 1.7, 2.6, 3.5, 4.4].map((x) => <mesh key={x} position={[x, 0.16, 0]}><boxGeometry args={[0.45, 0.02, 0.055]} /><meshStandardMaterial color="#b98b43" /></mesh>)}
    <Html position={[2.25, 0.34, 1.05]} center transform distanceFactor={18}><div className="scene-transit-label">TUYẾN SANG XƯỞNG</div></Html>
  </group>;
}

function TaskCourier({ phase }: { phase: VisualPhase }) {
  const group = useRef<THREE.Group>(null);
  const progress = useRef(0);
  const previousPhase = useRef(phase);
  const returningRoute = useMemo(() => [...TASK_ROUTE].reverse(), []);
  const moving = phase === "OUTBOUND" || phase === "RETURNING";

  useEffect(() => {
    if (phase !== previousPhase.current) {
      if (moving) progress.current = 0;
      previousPhase.current = phase;
    }
  }, [moving, phase]);

  useFrame((_, delta) => {
    if (!group.current) return;
    const route = phase === "RETURNING" ? returningRoute : TASK_ROUTE;
    if (moving) progress.current = Math.min(1, progress.current + delta / 7.4);
    else if (phase === "ARRIVAL" || phase === "PROCESSING" || phase === "HANDOFF") progress.current = 1;
    else progress.current = 0;
    const sample = sampleRoute(route, easeInOut(progress.current));
    group.current.position.set(...sample.position);
    group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, sample.rotation, 10, delta);
  });

  return <group ref={group} position={TASK_ROUTE[0]}>
    <OfficePerson
      name="Trợ lý Feline"
      role="Điều phối liên công ty"
      status={agentStatus("COURIER", phase)}
      variant="feline"
      activity={moving ? "walking" : phase === "ARRIVAL" || phase === "DELIVERY" ? "handoff" : phase === "HANDOFF" ? "receiving" : "idle"}
      document={phase === "HANDOFF" || phase === "RETURNING" || phase === "DELIVERY"}
      scale={0.95}
      labelOffset={[0.45, 2.2, 0]}
    />
  </group>;
}

function sampleRoute(route: Point[], progress: number) {
  const clamped = Math.min(0.9999, Math.max(0, progress));
  const segmentLengths = route.slice(0, -1).map((point, index) => {
    const next = route[index + 1];
    return Math.hypot(next[0] - point[0], next[1] - point[1], next[2] - point[2]);
  });
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  const targetDistance = clamped * totalLength;
  let traversed = 0;
  let index = 0;
  while (index < segmentLengths.length - 1 && traversed + segmentLengths[index] < targetDistance) {
    traversed += segmentLengths[index];
    index += 1;
  }
  const from = route[index];
  const to = route[index + 1];
  const local = segmentLengths[index] ? (targetDistance - traversed) / segmentLengths[index] : 0;
  return {
    position: [THREE.MathUtils.lerp(from[0], to[0], local), THREE.MathUtils.lerp(from[1], to[1], local), THREE.MathUtils.lerp(from[2], to[2], local)] as Point,
    rotation: Math.atan2(to[0] - from[0], to[2] - from[2])
  };
}

function easeInOut(value: number) { return value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2; }

function ExecutiveDesk({ position, gaming }: { position: Point; gaming: boolean }) {
  return <group position={position}>
    <RoundedBox args={[2.55, 0.16, 1.08]} radius={0.07} smoothness={4} castShadow><meshStandardMaterial color="#9a7251" roughness={0.5} /></RoundedBox>
    {[-1.05, 1.05].flatMap((x) => [-0.39, 0.39].map((z) => <group key={`${x}-${z}`} position={[x, -0.39, z]}>
      <mesh castShadow><boxGeometry args={[0.13, 0.62, 0.13]} /><meshStandardMaterial color="#4a3b34" roughness={0.58} /></mesh>
      <mesh position={[0, -0.32, 0]}><boxGeometry args={[0.2, 0.04, 0.2]} /><meshStandardMaterial color="#302923" roughness={0.72} /></mesh>
    </group>))}
    <RoundedBox args={[1.84, 0.5, 0.08]} radius={0.025} smoothness={3} position={[0, -0.34, 0.43]} castShadow><meshStandardMaterial color="#5c493e" roughness={0.68} /></RoundedBox>
    <RoundedBox args={[0.48, 0.55, 0.7]} radius={0.045} smoothness={3} position={[-0.91, -0.35, 0]} castShadow><meshStandardMaterial color="#7f6049" roughness={0.62} /></RoundedBox>
    {[-0.47, -0.29, -0.11].map((y) => <mesh key={y} position={[-0.91, y, -0.356]}><boxGeometry args={[0.3, 0.025, 0.015]} /><meshStandardMaterial color="#c2a071" metalness={0.4} roughness={0.42} /></mesh>)}
    <ExecutiveMonitor position={[0.28, 0.2, 0.05]} gaming={gaming} />
    <Keyboard position={[0.28, 0.12, -0.32]} />
    <DeskMug position={[-0.72, 0.18, 0.12]} color="#efe1ce" />
    <OfficeChair position={[0, -0.43, -0.82]} color="#4a403b" />
    <DeskLamp position={[0.92, 0.2, 0.12]} />
  </group>;
}

function TeamDesk({ position, accent }: { position: Point; accent: string }) {
  return <group position={position}>
    <RoundedBox args={[3.1, 0.15, 1.15]} radius={0.08} smoothness={4} castShadow><meshStandardMaterial color="#b2916e" roughness={0.63} /></RoundedBox>
    {[-0.85, 0.85].map((x) => <group key={x}><DesktopMonitor position={[x, 0.18, 0.02]} accent={accent} /><Keyboard position={[x, 0.1, -0.34]} /><OfficeChair position={[x, -0.43, -0.86]} color="#687578" /><DeskMug position={[x + 0.38, 0.16, -0.05]} color="#f2e6d3" /></group>)}
    {[-1.3, 1.3].flatMap((x) => [-0.4, 0.4].map((z) => <mesh key={`${x}-${z}`} position={[x, -0.42, z]}><boxGeometry args={[0.1, 0.78, 0.1]} /><meshStandardMaterial color="#5d5149" /></mesh>))}
    {[-0.85, 0.85].map((x) => <RoundedBox key={x} args={[0.48, 0.62, 0.5]} radius={0.045} smoothness={3} position={[x, -0.38, 0.25]} castShadow><meshStandardMaterial color="#e4ddd2" roughness={0.78} /></RoundedBox>)}
  </group>;
}

function CreatorDesk({ position }: { position: Point }) {
  return <group position={position}><TeamDesk position={[0, 0, 0]} accent="#4f8a86" /><mesh position={[1.35, 0.72, 0]}><torusGeometry args={[0.28, 0.035, 10, 24]} /><meshStandardMaterial color="#d7b469" emissive="#ffe2a3" emissiveIntensity={0.18} /></mesh></group>;
}

function StudioSet({ position }: { position: Point }) {
  return <group position={position}>
    <RoundedBox args={[1.55, 1.65, 0.12]} radius={0.08} smoothness={4} position={[0, 0.83, -0.5]}><meshStandardMaterial color="#d8cbc1" /></RoundedBox>
    {[-0.65, 0.65].map((x) => <group key={x} position={[x, 1, 0]}><mesh><cylinderGeometry args={[0.03, 0.03, 1.8, 10]} /><meshStandardMaterial color="#4c4b49" /></mesh><mesh position={[0, 0.82, 0]}><sphereGeometry args={[0.2, 12, 10]} /><meshStandardMaterial color="#f0d190" emissive="#ffe8b6" emissiveIntensity={0.2} /></mesh></group>)}
    <group position={[0, 0.72, 0.55]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.34, 0.035, 12, 30]} /><meshStandardMaterial color="#f0cf8c" emissive="#ffe2a3" emissiveIntensity={0.32} /></mesh>
      <mesh position={[0, -0.75, 0]}><cylinderGeometry args={[0.025, 0.035, 1.5, 10]} /><meshStandardMaterial color="#403e3c" /></mesh>
      <RoundedBox args={[0.28, 0.19, 0.18]} radius={0.04} smoothness={3} position={[0, 0, 0]}><meshStandardMaterial color="#353a3a" /></RoundedBox>
    </group>
  </group>;
}

function Lounge({ position }: { position: Point }) {
  return <group position={position}>
    <RoundedBox args={[2.65, 0.18, 0.92]} radius={0.12} smoothness={4} position={[0, -0.12, 0]} castShadow><meshStandardMaterial color="#744e4d" roughness={0.72} /></RoundedBox>
    {[-1.08, 1.08].flatMap((x) => [-0.3, 0.3].map((z) => <group key={`${x}-${z}`} position={[x, -0.39, z]}>
      <mesh castShadow><cylinderGeometry args={[0.055, 0.07, 0.36, 10]} /><meshStandardMaterial color="#493a32" roughness={0.68} /></mesh>
      <mesh position={[0, -0.19, 0]}><cylinderGeometry args={[0.085, 0.085, 0.035, 12]} /><meshStandardMaterial color="#2e2925" roughness={0.8} /></mesh>
    </group>))}
    <RoundedBox args={[2.32, 0.38, 0.78]} radius={0.13} smoothness={4} position={[0, 0.08, 0.02]} castShadow><meshStandardMaterial color="#a87370" roughness={0.78} /></RoundedBox>
    <RoundedBox args={[2.34, 0.68, 0.25]} radius={0.11} smoothness={4} position={[0, 0.43, -0.31]} castShadow><meshStandardMaterial color="#8c5c59" roughness={0.76} /></RoundedBox>
    {[-1.22, 1.22].map((x) => <RoundedBox key={x} args={[0.3, 0.58, 0.82]} radius={0.12} smoothness={4} position={[x, 0.18, 0.01]} castShadow><meshStandardMaterial color="#8f5f5c" roughness={0.78} /></RoundedBox>)}
    <RoundedBox args={[0.42, 0.16, 0.42]} radius={0.07} smoothness={4} position={[-0.78, 0.35, 0.25]} rotation={[0, 0.12, 0]}><meshStandardMaterial color="#d6b898" roughness={0.82} /></RoundedBox>
    <RoundedBox args={[0.42, 0.16, 0.42]} radius={0.07} smoothness={4} position={[0.78, 0.35, 0.25]} rotation={[0, -0.12, 0]}><meshStandardMaterial color="#c99771" roughness={0.82} /></RoundedBox>
  </group>;
}

function MeetingNook({ position }: { position: Point }) {
  return <group position={position}><RoundedBox args={[1.55, 0.12, 1.05]} radius={0.18} smoothness={4} castShadow><meshStandardMaterial color="#c19d72" /></RoundedBox><mesh position={[0, -0.34, 0]}><boxGeometry args={[0.25, 0.62, 0.4]} /><meshStandardMaterial color="#6d5543" /></mesh><OfficeChair position={[-0.72, -0.35, 0]} color="#83708f" rotation={Math.PI / 2} /><OfficeChair position={[0.72, -0.35, 0]} color="#83708f" rotation={-Math.PI / 2} /></group>;
}

function DesktopMonitor({ position, accent, wide = false }: { position: Point; accent: string; wide?: boolean }) {
  return <group position={position}>
    <RoundedBox args={[wide ? 1.05 : 0.82, 0.58, 0.08]} radius={0.045} smoothness={3} position={[0, 0.34, 0]} castShadow><meshStandardMaterial color="#263332" roughness={0.34} /></RoundedBox>
    <mesh position={[0, 0.34, -0.045]}><boxGeometry args={[wide ? 0.9 : 0.68, 0.43, 0.012]} /><meshStandardMaterial color="#172523" emissive={accent} emissiveIntensity={0.17} /></mesh>
    <mesh position={[0, 0.32, -0.052]}><boxGeometry args={[wide ? 0.54 : 0.36, 0.035, 0.008]} /><meshBasicMaterial color="#e8d6a8" /></mesh>
    <mesh position={[0, 0.11, 0]}><boxGeometry args={[0.09, 0.25, 0.08]} /><meshStandardMaterial color="#4c5654" /></mesh>
    <mesh position={[0, -0.015, 0]}><boxGeometry args={[0.38, 0.045, 0.22]} /><meshStandardMaterial color="#4c5654" /></mesh>
  </group>;
}

function ExecutiveMonitor({ position, gaming }: { position: Point; gaming: boolean }) {
  const texture = useMemo(() => createTftTexture(gaming), [gaming]);

  useEffect(() => () => texture.dispose(), [texture]);

  return <group position={position}>
    <RoundedBox args={[1.68, 0.86, 0.1]} radius={0.06} smoothness={4} position={[0, 0.47, 0]} castShadow>
      <meshStandardMaterial color="#202726" metalness={0.24} roughness={0.34} />
    </RoundedBox>
    <mesh position={[0, 0.47, -0.056]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[1.52, 0.7]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
    <mesh position={[0, 0.08, 0]} castShadow><boxGeometry args={[0.12, 0.3, 0.09]} /><meshStandardMaterial color="#454d4b" metalness={0.34} roughness={0.42} /></mesh>
    <RoundedBox args={[0.64, 0.055, 0.3]} radius={0.035} smoothness={3} position={[0, -0.07, 0]} castShadow><meshStandardMaterial color="#3f4745" metalness={0.3} roughness={0.48} /></RoundedBox>
    <mesh position={[0.72, 0.82, -0.061]}><sphereGeometry args={[0.018, 10, 8]} /><meshBasicMaterial color={gaming ? "#6dd6a0" : "#9b745d"} /></mesh>
  </group>;
}

function createTftTexture(gaming: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) return new THREE.CanvasTexture(canvas);

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, gaming ? "#111b2c" : "#111716");
  background.addColorStop(1, gaming ? "#342047" : "#202827");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (!gaming) {
    context.fillStyle = "#71817d";
    context.font = "600 24px Manrope, sans-serif";
    context.textAlign = "center";
    context.fillText("FELINE AI", 384, 174);
    context.fillStyle = "#41504d";
    context.font = "500 14px Manrope, sans-serif";
    context.fillText("Màn hình đang nghỉ", 384, 204);
  } else {
    drawTftInterface(context);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function drawTftInterface(context: CanvasRenderingContext2D) {
  context.fillStyle = "rgba(7, 12, 24, .82)";
  context.fillRect(0, 0, 768, 52);
  context.textAlign = "left";
  context.fillStyle = "#f4d58a";
  context.font = "700 18px Manrope, sans-serif";
  context.fillText("ĐẤU TRƯỜNG CHÂN LÝ", 22, 33);
  context.fillStyle = "#e9edf6";
  context.font = "700 15px Manrope, sans-serif";
  context.fillText("4-2", 555, 32);
  context.fillStyle = "#73d8a4";
  context.fillText("82 ♥", 620, 32);
  context.fillStyle = "#f3c85b";
  context.fillText("42", 708, 32);

  const board = context.createLinearGradient(110, 60, 650, 285);
  board.addColorStop(0, "#234a5b");
  board.addColorStop(1, "#3e2854");
  context.fillStyle = board;
  context.beginPath();
  context.moveTo(120, 64);
  context.lineTo(650, 64);
  context.lineTo(704, 270);
  context.lineTo(68, 270);
  context.closePath();
  context.fill();

  const hexRadius = 28;
  const startX = 151;
  const startY = 92;
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 7; column += 1) {
      const x = startX + column * 72 + (row % 2) * 36;
      const y = startY + row * 49;
      drawHex(context, x, y, hexRadius, "rgba(161, 204, 213, .13)", "rgba(205, 229, 231, .18)");
    }
  }

  const champions = [
    [259, 141, "#70c8c1", "2"],
    [403, 141, "#d38a70", "2"],
    [547, 141, "#9f83d5", "1"],
    [223, 190, "#e0bd64", "2"],
    [367, 190, "#6facd6", "3"],
    [511, 190, "#ca6684", "2"],
    [331, 239, "#72ba7e", "2"]
  ] as const;
  champions.forEach(([x, y, color, level]) => {
    context.shadowColor = color;
    context.shadowBlur = 14;
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, 16, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = "#f8e8a8";
    context.font = "700 10px Manrope, sans-serif";
    context.textAlign = "center";
    context.fillText("★".repeat(Number(level)), x, y - 21);
    context.fillStyle = "#17251f";
    context.fillRect(x - 17, y + 20, 34, 4);
    context.fillStyle = "#62d481";
    context.fillRect(x - 17, y + 20, 27, 4);
  });

  context.fillStyle = "rgba(6, 10, 19, .9)";
  context.fillRect(0, 286, 768, 74);
  ["#b86b75", "#5b99b8", "#8b72bd", "#c59d55", "#5c9b76"].forEach((color, index) => {
    const x = 165 + index * 92;
    context.fillStyle = "#202a3c";
    context.fillRect(x, 296, 78, 54);
    context.fillStyle = color;
    context.fillRect(x + 5, 301, 68, 32);
    context.fillStyle = "#f2d88d";
    context.font = "700 10px Manrope, sans-serif";
    context.textAlign = "left";
    context.fillText(String(index % 3 + 1), x + 7, 345);
  });
  context.fillStyle = "#f0d88e";
  context.font = "700 13px Manrope, sans-serif";
  context.textAlign = "left";
  context.fillText("Cấp 8", 22, 320);
  context.fillStyle = "#8ca0b8";
  context.font = "500 11px Manrope, sans-serif";
  context.fillText("Đội hình sếp", 22, 341);
}

function drawHex(context: CanvasRenderingContext2D, x: number, y: number, radius: number, fill: string, stroke: string) {
  context.beginPath();
  for (let side = 0; side < 6; side += 1) {
    const angle = Math.PI / 3 * side;
    const pointX = x + Math.cos(angle) * radius;
    const pointY = y + Math.sin(angle) * radius;
    if (side === 0) context.moveTo(pointX, pointY);
    else context.lineTo(pointX, pointY);
  }
  context.closePath();
  context.fillStyle = fill;
  context.fill();
  context.strokeStyle = stroke;
  context.lineWidth = 1;
  context.stroke();
}

function Keyboard({ position }: { position: Point }) {
  return <RoundedBox args={[0.58, 0.045, 0.22]} radius={0.025} smoothness={3} position={position}><meshStandardMaterial color="#d8d2c8" roughness={0.65} /></RoundedBox>;
}

function DeskMug({ position, color }: { position: Point; color: string }) {
  return <group position={position}><mesh><cylinderGeometry args={[0.09, 0.075, 0.2, 14]} /><meshStandardMaterial color={color} roughness={0.72} /></mesh><mesh position={[0.1, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.06, 0.018, 8, 14]} /><meshStandardMaterial color={color} /></mesh></group>;
}

function DeskLamp({ position }: { position: Point }) {
  return <group position={position}><mesh position={[0, 0.19, 0]} rotation={[0, 0, -0.35]}><cylinderGeometry args={[0.025, 0.025, 0.45, 8]} /><meshStandardMaterial color="#594d45" /></mesh><mesh position={[0.08, 0.39, 0]} rotation={[0, 0, -0.35]}><coneGeometry args={[0.16, 0.22, 16]} /><meshStandardMaterial color="#c99d55" emissive="#f3d99d" emissiveIntensity={0.15} /></mesh></group>;
}

function OfficeChair({ position, color, rotation = 0 }: { position: Point; color: string; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <RoundedBox args={[0.62, 0.16, 0.58]} radius={0.09} smoothness={4} position={[0, 0.38, 0]} castShadow><meshStandardMaterial color={color} roughness={0.78} /></RoundedBox>
    <RoundedBox args={[0.62, 0.74, 0.16]} radius={0.09} smoothness={4} position={[0, 0.76, -0.24]} castShadow><meshStandardMaterial color={color} roughness={0.78} /></RoundedBox>
    {[-0.38, 0.38].map((x) => <group key={x} position={[x, 0.52, 0]}>
      <mesh><boxGeometry args={[0.06, 0.08, 0.48]} /><meshStandardMaterial color="#454b4a" roughness={0.62} /></mesh>
      <RoundedBox args={[0.16, 0.07, 0.38]} radius={0.035} smoothness={3} position={[0, 0.18, -0.02]}><meshStandardMaterial color="#555d5b" roughness={0.7} /></RoundedBox>
    </group>)}
    <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.07, 0.09, 0.52, 12]} /><meshStandardMaterial color="#454b4a" metalness={0.25} roughness={0.5} /></mesh>
    <mesh position={[0, -0.17, 0]}><cylinderGeometry args={[0.12, 0.14, 0.08, 12]} /><meshStandardMaterial color="#343a39" metalness={0.22} roughness={0.54} /></mesh>
    {[0, 1.26, 2.51, 3.77, 5.03].map((angle) => <group key={angle} rotation={[0, -angle, 0]}>
      <mesh position={[0, -0.19, 0.3]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.035, 0.045, 0.5, 8]} /><meshStandardMaterial color="#454b4a" metalness={0.18} roughness={0.58} /></mesh>
      <mesh position={[0, -0.27, 0.56]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.065, 0.065, 0.08, 12]} /><meshStandardMaterial color="#252a29" roughness={0.82} /></mesh>
    </group>)}
  </group>;
}

function CorridorBench({ position }: { position: Point }) {
  return <group position={position}><RoundedBox args={[1.45, 0.18, 0.48]} radius={0.08} smoothness={4} castShadow><meshStandardMaterial color="#af8969" roughness={0.72} /></RoundedBox>{[-0.55, 0.55].map((x) => <mesh key={x} position={[x, -0.24, 0]}><boxGeometry args={[0.09, 0.42, 0.35]} /><meshStandardMaterial color="#5d5149" /></mesh>)}</group>;
}

function WaterStation({ position }: { position: Point }) {
  return <group position={position}><RoundedBox args={[0.65, 1.15, 0.55]} radius={0.08} smoothness={4} position={[0, 0.58, 0]} castShadow><meshStandardMaterial color="#ece7de" roughness={0.72} /></RoundedBox><mesh position={[0, 1.32, 0]}><cylinderGeometry args={[0.22, 0.16, 0.62, 16]} /><meshPhysicalMaterial color="#a9d6d5" transparent opacity={0.58} roughness={0.18} /></mesh><mesh position={[-0.12, 0.72, 0.29]}><boxGeometry args={[0.08, 0.08, 0.12]} /><meshStandardMaterial color="#5f8f98" /></mesh><mesh position={[0.12, 0.72, 0.29]}><boxGeometry args={[0.08, 0.08, 0.12]} /><meshStandardMaterial color="#b85f5f" /></mesh></group>;
}

function Library({ position }: { position: Point }) {
  return <group position={position}><RoundedBox args={[0.65, 1.75, 0.32]} radius={0.05} smoothness={3}><meshStandardMaterial color="#76553f" /></RoundedBox>{[-0.48, 0, 0.48].map((y) => <mesh key={y} position={[0, y, 0.18]}><boxGeometry args={[0.54, 0.04, 0.25]} /><meshStandardMaterial color="#48372f" /></mesh>)}</group>;
}

function ProductShelf({ position, accent }: { position: Point; accent: string }) {
  return <group position={position}>{[-0.55, 0.55].map((x) => <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[0.07, 1.75, 0.55]} /><meshStandardMaterial color="#65574d" /></mesh>)}{[-0.55, 0, 0.55].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[1.18, 0.06, 0.55]} /><meshStandardMaterial color="#75665a" /></mesh>)}{[-0.32, 0.3].map((x) => <RoundedBox key={x} args={[0.42, 0.36, 0.38]} radius={0.04} smoothness={3} position={[x, -0.27, 0]}><meshStandardMaterial color={accent} /></RoundedBox>)}</group>;
}

function Moodboard({ position, colors }: { position: Point; colors: string[] }) {
  return <group position={position}><RoundedBox args={[2.2, 1.05, 0.06]} radius={0.06} smoothness={3}><meshStandardMaterial color="#eadfce" /></RoundedBox>{colors.map((color, index) => <mesh key={color} position={[-0.65 + index * 0.65, 0, 0.04]}><boxGeometry args={[0.45, 0.65 - index * 0.08, 0.015]} /><meshStandardMaterial color={color} /></mesh>)}</group>;
}

function BrandStrategyWall({ position }: { position: Point }) {
  return <group position={position}>
    <RoundedBox args={[2.35, 1.02, 0.07]} radius={0.06} smoothness={3}><meshStandardMaterial color="#eee5d8" roughness={0.78} /></RoundedBox>
    {[-0.72, 0, 0.72].map((x, index) => <group key={x} position={[x, 0, 0.055]}>
      <RoundedBox args={[0.54, 0.7, 0.025]} radius={0.035} smoothness={3}><meshStandardMaterial color={["#7a687f", "#b89564", "#8f6670"][index]} roughness={0.72} /></RoundedBox>
      <mesh position={[0, -0.2, 0.018]}><boxGeometry args={[0.3, 0.025, 0.012]} /><meshStandardMaterial color="#f4eadc" /></mesh>
    </group>)}
  </group>;
}

function MetricsScreen({ position, color }: { position: Point; color: string }) {
  return <group position={position}><RoundedBox args={[3.1, 0.95, 0.07]} radius={0.06} smoothness={3}><meshStandardMaterial color="#293936" emissive="#17221f" emissiveIntensity={0.08} /></RoundedBox>{[-0.9, -0.3, 0.3, 0.9].map((x, index) => <mesh key={x} position={[x, -0.14 + index * 0.05, 0.05]}><boxGeometry args={[0.22, 0.28 + index * 0.1, 0.015]} /><meshStandardMaterial color={index === 2 ? "#d0a34f" : color} /></mesh>)}</group>;
}

function PackingLine({ position }: { position: Point }) {
  return <group position={position}><RoundedBox args={[4.1, 0.32, 0.82]} radius={0.09} smoothness={4} castShadow><meshStandardMaterial color="#687f79" /></RoundedBox>{[-1.4, -0.45, 0.5, 1.4].map((x, i) => <RoundedBox key={x} args={[0.55, 0.42, 0.52]} radius={0.05} smoothness={3} position={[x, 0.37, 0]}><meshStandardMaterial color={i % 2 ? "#d3a75f" : "#c8815c"} /></RoundedBox>)}</group>;
}

function StorageWall({ position }: { position: Point }) {
  return <group position={position}>{[-0.6, 0.6].map((x) => <mesh key={x} position={[x, 0, 0]}><boxGeometry args={[0.08, 2.25, 0.68]} /><meshStandardMaterial color="#4f625d" /></mesh>)}{[-0.75, 0, 0.75].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[1.28, 0.07, 0.68]} /><meshStandardMaterial color="#60736e" /></mesh>)}</group>;
}

function Planter({ position, compact = false }: { position: Point; compact?: boolean }) {
  const scale = compact ? 0.75 : 1;
  return <group position={position} scale={scale}><RoundedBox args={[0.52, 0.54, 0.52]} radius={0.11} smoothness={4} position={[0, 0.27, 0]}><meshStandardMaterial color="#dfd5c2" /></RoundedBox>{[-0.2, 0, 0.2].map((x, i) => <mesh key={x} position={[x, 0.86 + i * 0.06, 0]}><sphereGeometry args={[0.21, 12, 10]} /><meshStandardMaterial color={i === 1 ? "#4d6a52" : "#607a5e"} /></mesh>)}</group>;
}

function Tree({ position }: { position: Point }) {
  return <group position={position}><mesh position={[0, 0.48, 0]}><cylinderGeometry args={[0.08, 0.11, 0.95, 10]} /><meshStandardMaterial color="#5d5046" /></mesh><mesh position={[0, 1.12, 0]}><sphereGeometry args={[0.5, 14, 12]} /><meshStandardMaterial color="#61715e" roughness={0.95} /></mesh></group>;
}
