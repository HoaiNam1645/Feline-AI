import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { ArrowCounterClockwise, ArrowsOutCardinal, Buildings, CheckCircle, ChatCircle, Compass, Copy, MagnifyingGlassMinus, MagnifyingGlassPlus, PaperPlaneTilt, Stop, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type ElementRef, type ReactNode, type RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MOUSE, TOUCH } from "three";
import * as THREE from "three";
import { api } from "./api";
import { OfficeWorld } from "./office3d/OfficeWorld";
import {
  agentStatus,
  CEO_IDLE_LABELS,
  PHASE_LABELS,
  WORKFLOW_STEPS,
  workflowStep,
  type CeoIdleState,
  type VisualPhase
} from "./office3d/office-status";
import type { ChatConversation, ChatMessage, ChatSource, OfficeDelegationResult, OfficeDelegationStage } from "./types";

const QUICK_QUESTIONS = [
  "Hôm nay Lemiex có bao nhiêu đơn?",
  "Hôm qua xưởng Lemiex có bao nhiêu đơn?"
];

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function dataTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

function stableStreamingMarkdown(content: string) {
  let stable = content;
  if ((stable.match(/\*\*/g)?.length || 0) % 2 === 1) {
    const marker = stable.lastIndexOf("**");
    stable = `${stable.slice(0, marker)}${stable.slice(marker + 2)}`;
  }
  if ((stable.match(/(?<!`)`(?!`)/g)?.length || 0) % 2 === 1) {
    const marker = stable.lastIndexOf("`");
    stable = `${stable.slice(0, marker)}${stable.slice(marker + 1)}`;
  }
  return stable;
}

function sceneSpeechText(content: string) {
  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= 280) return plain;
  return `…${plain.slice(-279)}`;
}

export function AiOfficeView({
  displayName,
  scope = "all",
  canRunLemiexChat = false,
  onOpenLemiexChat
}: {
  displayName: string;
  scope?: "all" | "lemiex";
  canRunLemiexChat?: boolean;
  onOpenLemiexChat?: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<VisualPhase>("IDLE");
  const [serverStage, setServerStage] = useState<OfficeDelegationStage | null>(null);
  const [status, setStatus] = useState(PHASE_LABELS.IDLE);
  const [result, setResult] = useState<OfficeDelegationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [cameraMode, setCameraMode] = useState<"rotate" | "pan">("rotate");
  const [ceoIdleState, setCeoIdleState] = useState<CeoIdleState>(() => {
    const saved = window.localStorage.getItem("feline-ceo-idle-state");
    return saved === "DESK" || saved === "SMOKING" ? saved : "RESTING";
  });
  const [selectedAgent, setSelectedAgent] = useState<"tiktok" | null>(null);
  const [tiktokConversation, setTiktokConversation] = useState<ChatConversation | null>(null);
  const [tiktokMessages, setTiktokMessages] = useState<ChatMessage[]>([]);
  const [tiktokQuestion, setTiktokQuestion] = useState("");
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [tiktokSending, setTiktokSending] = useState(false);
  const [tiktokStatus, setTiktokStatus] = useState("");
  const [tiktokError, setTiktokError] = useState<string | null>(null);
  const [tiktokSceneSpeech, setTiktokSceneSpeech] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const tiktokAbortRef = useRef<AbortController | null>(null);
  const tiktokSpeechTimerRef = useRef<number | null>(null);
  const tiktokSpeechBufferRef = useRef("");
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const savedCameraRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const cameraAnimationRef = useRef<number | null>(null);
  const tiktokMessagesRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useMemo(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    []
  );
  const currentStep = workflowStep(phase);
  const lemiexWorkspace = scope === "lemiex";

  function clearTiktokSpeechTimer() {
    if (tiktokSpeechTimerRef.current !== null) {
      window.clearTimeout(tiktokSpeechTimerRef.current);
      tiktokSpeechTimerRef.current = null;
    }
  }

  function hideTiktokSpeechAfter(ms: number) {
    clearTiktokSpeechTimer();
    tiktokSpeechTimerRef.current = window.setTimeout(() => {
      setTiktokSceneSpeech(null);
      tiktokSpeechTimerRef.current = null;
    }, ms);
  }

  useEffect(() => {
    window.localStorage.setItem("feline-ceo-idle-state", ceoIdleState);
  }, [ceoIdleState]);

  function syncCameraState() {
    const camera = controlsRef.current?.object;
    if (!camera || !sceneRef.current) return;
    sceneRef.current.dataset.cameraPosition = camera.position.toArray().map((value) => value.toFixed(3)).join(",");
  }

  function zoomCamera(multiplier: number) {
    const controls = controlsRef.current;
    if (!controls) return;
    const offset = controls.object.position.clone().sub(controls.target);
    const distance = Math.min(55, Math.max(8, offset.length() * multiplier));
    controls.object.position.copy(controls.target).add(offset.setLength(distance));
    controls.update();
    syncCameraState();
  }

  function resetCamera() {
    controlsRef.current?.reset();
    controlsRef.current?.update();
    window.requestAnimationFrame(syncCameraState);
  }

  function animateCamera(position: THREE.Vector3, target: THREE.Vector3, onComplete?: () => void) {
    const controls = controlsRef.current;
    if (!controls) return;
    if (cameraAnimationRef.current !== null) window.cancelAnimationFrame(cameraAnimationRef.current);
    const fromPosition = controls.object.position.clone();
    const fromTarget = controls.target.clone();
    const startedAt = performance.now();
    controls.enabled = false;
    const frame = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / (reduceMotion ? 120 : 980));
      const eased = 1 - Math.pow(1 - progress, 4);
      controls.object.position.lerpVectors(fromPosition, position, eased);
      controls.target.lerpVectors(fromTarget, target, eased);
      controls.update();
      if (progress < 1) cameraAnimationRef.current = window.requestAnimationFrame(frame);
      else {
        cameraAnimationRef.current = null;
        controls.enabled = true;
        syncCameraState();
        onComplete?.();
      }
    };
    cameraAnimationRef.current = window.requestAnimationFrame(frame);
  }

  async function openTiktokInteraction() {
    const controls = controlsRef.current;
    if (!controls || selectedAgent === "tiktok") return;
    savedCameraRef.current = { position: controls.object.position.clone(), target: controls.target.clone() };
    setSelectedAgent("tiktok");
    setTiktokError(null);
    setTiktokSceneSpeech("Xin chào, tôi là TikTok AI. Tôi có thể hỗ trợ bạn về công việc Sell TikTok.");
    hideTiktokSpeechAfter(reduceMotion ? 1800 : 4200);
    animateCamera(
      new THREE.Vector3(-10.25, 2.35, 4.75),
      new THREE.Vector3(-10.05, 1.1, 1.72)
    );
    setTiktokLoading(true);
    try {
      const conversations = await api.tiktokChatConversations();
      const conversation = conversations[0] || await api.createTiktokChatConversation();
      const detail = await api.tiktokChatConversation(conversation.id);
      setTiktokConversation(detail);
      setTiktokMessages(detail.messages || []);
    } catch (cause) {
      setTiktokError(cause instanceof Error ? cause.message : "Không thể mở cuộc trò chuyện với TikTok AI");
    } finally {
      setTiktokLoading(false);
    }
  }

  function closeTiktokInteraction() {
    tiktokAbortRef.current?.abort();
    clearTiktokSpeechTimer();
    setSelectedAgent(null);
    setTiktokSceneSpeech(null);
    setTiktokStatus("");
    setTiktokError(null);
    const saved = savedCameraRef.current;
    savedCameraRef.current = null;
    if (saved) animateCamera(saved.position, saved.target);
  }

  async function sendTiktokMessage(input?: string, retryAssistantMessageId?: string) {
    const content = (input || tiktokQuestion).trim();
    if (!content || tiktokSending || !tiktokConversation) return;
    const now = new Date().toISOString();
    const assistantId = `office-tiktok-assistant-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: `office-tiktok-user-${Date.now()}`,
      conversationId: tiktokConversation.id,
      role: "USER",
      status: "COMPLETED",
      content,
      reportDate: null,
      agentRunId: null,
      sources: null,
      suggestions: null,
      error: null,
      createdAt: now,
      updatedAt: now
    };
    const assistantMessage: ChatMessage = { ...userMessage, id: assistantId, role: "ASSISTANT", status: "PENDING", content: "" };
    setTiktokMessages((current) => retryAssistantMessageId
      ? current.map((message) => message.id === retryAssistantMessageId ? assistantMessage : message)
      : [...current, userMessage, assistantMessage]);
    setTiktokQuestion("");
    setTiktokSending(true);
    setTiktokError(null);
    clearTiktokSpeechTimer();
    setTiktokSceneSpeech(null);
    tiktokSpeechBufferRef.current = "";
    setTiktokStatus("Đang đối chiếu tài liệu...");
    const controller = new AbortController();
    tiktokAbortRef.current = controller;
    let sources: ChatSource[] = [];
    try {
      await api.streamTiktokChatMessage(tiktokConversation.id, content, {
        onStatus: setTiktokStatus,
        onMeta: (meta) => { sources = meta.sources; },
        onDelta: (text) => {
          setTiktokStatus("");
          tiktokSpeechBufferRef.current += text;
          setTiktokSceneSpeech(sceneSpeechText(tiktokSpeechBufferRef.current));
          setTiktokMessages((current) => current.map((message) => message.id === assistantId
            ? { ...message, content: message.content + text, sources }
            : message));
        },
        onDone: (message) => {
          setTiktokMessages((current) => current.map((item) => item.id === assistantId ? message : item));
          tiktokSpeechBufferRef.current = message.content;
          setTiktokSceneSpeech(sceneSpeechText(message.content));
          hideTiktokSpeechAfter(reduceMotion ? 2400 : 7200);
        }
      }, controller.signal, retryAssistantMessageId);
    } catch (cause) {
      const stopped = cause instanceof DOMException && cause.name === "AbortError";
      const message = stopped ? "Đã dừng câu trả lời." : cause instanceof Error ? cause.message : "Không thể hoàn tất câu trả lời";
      setTiktokMessages((current) => current.map((item) => item.id === assistantId
        ? { ...item, status: stopped ? "CANCELED" : "FAILED", content: stopped ? message : "", error: stopped ? null : message }
        : item));
      if (!stopped) setTiktokError(message);
      setTiktokSceneSpeech(stopped ? null : sceneSpeechText(message));
      if (!stopped) hideTiktokSpeechAfter(reduceMotion ? 2400 : 5200);
    } finally {
      tiktokAbortRef.current = null;
      setTiktokSending(false);
      setTiktokStatus("");
    }
  }

  function retryTiktokAnswer(assistantMessageId: string) {
    const assistantIndex = tiktokMessages.findIndex((message) => message.id === assistantMessageId);
    const userMessage = [...tiktokMessages.slice(0, assistantIndex)].reverse().find((message) => message.role === "USER");
    if (userMessage) void sendTiktokMessage(userMessage.content, assistantMessageId);
  }

  useEffect(() => {
    const panel = tiktokMessagesRef.current;
    if (panel) window.requestAnimationFrame(() => panel.scrollTo({ top: panel.scrollHeight, behavior: tiktokSending ? "smooth" : "auto" }));
  }, [tiktokMessages, tiktokStatus, tiktokSending]);

  useEffect(() => () => {
    if (cameraAnimationRef.current !== null) window.cancelAnimationFrame(cameraAnimationRef.current);
    clearTiktokSpeechTimer();
    document.body.style.cursor = "";
  }, []);

  async function run(input?: string) {
    const content = (input || question).trim();
    if (!content || running) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setQuestion("");
    setResult(null);
    setError(null);
    setServerStage(null);
    setPhase("OUTBOUND");
    setStatus("CEO AI đã tiếp nhận và chuyển yêu cầu sang Lemiex");
    let receivedResult: OfficeDelegationResult | null = null;

    const request = api.streamOfficeDelegation(content, undefined, {
      onStage: (stage, message) => {
        setServerStage(stage);
        setStatus(message);
      },
      onResult: (next) => { receivedResult = next; }
    }, controller.signal)
      .then(() => ({ ok: true as const }))
      .catch((cause) => ({ ok: false as const, cause }));

    try {
      await delay(reduceMotion ? 80 : 7600, controller.signal);
      setPhase("ARRIVAL");
      setStatus("Trợ lý Feline đang bàn giao yêu cầu cho Lemiex AI");
      await delay(reduceMotion ? 80 : 1800, controller.signal);
      setPhase("PROCESSING");
      setStatus("Lemiex AI đã tiếp nhận và đang đối chiếu số liệu vận hành");
      const settled = await request;
      if (!settled.ok) throw settled.cause;
      if (!receivedResult) throw new Error("Lemiex AI chưa trả về kết quả hợp lệ");
      setPhase("HANDOFF");
      setStatus("Lemiex AI đã hoàn tất và bàn giao báo cáo");
      await delay(reduceMotion ? 80 : 2400, controller.signal);
      setPhase("RETURNING");
      setStatus("Trợ lý Feline đang mang kết quả về Phòng Giám đốc");
      await delay(reduceMotion ? 80 : 7600, controller.signal);
      setPhase("DELIVERY");
      setStatus("Trợ lý Feline đang trình báo cáo cho CEO AI");
      await delay(reduceMotion ? 80 : 1800, controller.signal);
      setResult(receivedResult);
      setPhase("COMPLETE");
      setStatus("CEO AI đã nhận và đang xem báo cáo");
    } catch (cause) {
      const stopped = cause instanceof DOMException && cause.name === "AbortError";
      setError(stopped ? "Đã dừng yêu cầu." : cause instanceof Error ? cause.message : "Không thể hoàn tất yêu cầu");
      setPhase("ERROR");
      setStatus(stopped ? "Đã dừng theo yêu cầu" : PHASE_LABELS.ERROR);
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setPhase("IDLE");
    setStatus(PHASE_LABELS.IDLE);
    setServerStage(null);
  }

  return <section className="ai-office-shell">
    <div className={`office-scene-panel ${selectedAgent ? "agent-focus" : ""}`} ref={sceneRef} data-camera-mode={cameraMode}>
      <div className="office-scene-topbar">
        <div className="office-world-title">
          <Buildings weight="duotone" />
          <span><strong>{lemiexWorkspace ? "Xưởng Lemiex" : "Văn phòng AI"}</strong><small>{lemiexWorkspace ? "Không gian vận hành" : "Feline ↔ Xưởng Lemiex"}</small></span>
        </div>
        <div className={`office-live-state phase-${phase.toLowerCase()}`}><i />{lemiexWorkspace ? "Xưởng đang hoạt động" : selectedAgent === "tiktok" ? "Đang trò chuyện với TikTok AI" : PHASE_LABELS[phase]}</div>
      </div>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: lemiexWorkspace ? [10.5, 8.5, 12.5] : [17.5, 15.5, 20.5], fov: 38, near: 0.1, far: 110 }}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#e9e3d9"]} />
        <fog attach="fog" args={["#e9e3d9", 31, 54]} />
        <hemisphereLight args={["#fff8ea", "#817d72", 1.55]} />
        <directionalLight position={[5, 18, 10]} intensity={2.25} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} />
        <directionalLight position={[-12, 10, 5]} intensity={0.7} color="#f1d7c0" />
        <OfficeWorld phase={phase} ceoIdleState={ceoIdleState} scope={scope} selectedAgent={selectedAgent} selectedAgentSpeech={tiktokSceneSpeech} onAgentInteract={(agent) => { if (agent === "tiktok") void openTiktokInteraction(); else if (agent === "lemiex" && canRunLemiexChat) onOpenLemiexChat?.(); }} />
        <ContactShadows position={[0, -0.01, 0]} opacity={0.28} scale={34} blur={2.6} far={15} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan
          screenSpacePanning
          enableDamping
          dampingFactor={0.08}
          minDistance={8}
          maxDistance={55}
          minPolarAngle={0.08}
          maxPolarAngle={1.5}
          rotateSpeed={0.9}
          panSpeed={1.05}
          zoomSpeed={1.1}
          mouseButtons={{ LEFT: cameraMode === "rotate" ? MOUSE.ROTATE : MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: cameraMode === "rotate" ? MOUSE.PAN : MOUSE.ROTATE }}
          touches={{ ONE: cameraMode === "rotate" ? TOUCH.ROTATE : TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
          target={lemiexWorkspace ? [0, 0.9, 0] : [0, 0.8, 0]}
          onChange={syncCameraState}
        />
      </Canvas>
      <div className="office-camera-controls" aria-label="Điều khiển góc nhìn">
        <div className="office-camera-modes">
          <button className={cameraMode === "rotate" ? "active" : ""} onClick={() => setCameraMode("rotate")} aria-pressed={cameraMode === "rotate"} title="Kéo để xoay góc nhìn"><Compass weight="bold" /><span>Xoay</span></button>
          <button className={cameraMode === "pan" ? "active" : ""} onClick={() => setCameraMode("pan")} aria-pressed={cameraMode === "pan"} title="Kéo để di chuyển góc nhìn"><ArrowsOutCardinal weight="bold" /><span>Di chuyển</span></button>
        </div>
        <button onClick={() => zoomCamera(0.82)} aria-label="Phóng to" title="Phóng to"><MagnifyingGlassPlus weight="bold" /></button>
        <button onClick={() => zoomCamera(1.22)} aria-label="Thu nhỏ" title="Thu nhỏ"><MagnifyingGlassMinus weight="bold" /></button>
        <button onClick={resetCamera} aria-label="Đặt lại góc nhìn" title="Đặt lại góc nhìn"><ArrowCounterClockwise weight="bold" /></button>
      </div>
      <div className="office-company-legend" aria-hidden="true">
        {!lemiexWorkspace && <><span className="feline"><i />Feline AI · 4 phòng ban</span><span className="director"><i />CEO AI · Phòng Giám đốc</span></>}
        <span className="lemiex"><i />Lemiex · Xưởng fulfillment thêu</span>
      </div>
      {!selectedAgent && <div className="office-interaction-hint"><ChatCircle weight="duotone" /><span>{lemiexWorkspace ? (canRunLemiexChat ? "Bấm vào Lemiex AI để trò chuyện" : "Theo dõi hoạt động trong xưởng") : "Bấm vào TikTok AI để trò chuyện"}</span></div>}
    </div>

    <aside className="office-command-panel">
      {lemiexWorkspace ? <LemiexWorkspacePanel displayName={displayName} canRunChat={canRunLemiexChat} onOpenChat={onOpenLemiexChat} /> : selectedAgent === "tiktok" ? <TiktokInteractionPanel
        displayName={displayName}
        conversation={tiktokConversation}
        messages={tiktokMessages}
        question={tiktokQuestion}
        loading={tiktokLoading}
        sending={tiktokSending}
        status={tiktokStatus}
        error={tiktokError}
        messagesRef={tiktokMessagesRef}
        onQuestionChange={setTiktokQuestion}
        onSend={(value) => void sendTiktokMessage(value)}
        onRetry={retryTiktokAnswer}
        onStop={() => tiktokAbortRef.current?.abort()}
        onClose={closeTiktokInteraction}
      /> : <>
      <div className="office-command-heading">
        <span>VĂN PHÒNG ĐIỀU HÀNH FELINE</span>
        <h2>Chào {displayName.split(" ").slice(-2).join(" ")}</h2>
        <p>Giao việc liên công ty và theo dõi từng bước xử lý trong văn phòng.</p>
      </div>

      <div className="office-agent-roster" aria-live="polite">
        <AgentRow
          name="CEO AI Feline"
          status={phase === "IDLE" ? CEO_IDLE_LABELS[ceoIdleState] : agentStatus("CEO", phase)}
          tone="feline"
          active={phase !== "IDLE" || ceoIdleState !== "RESTING"}
          control={phase === "IDLE" ? <select
            className="office-agent-state-select"
            aria-label="Trạng thái CEO AI Feline"
            value={ceoIdleState}
            disabled={phase !== "IDLE"}
            onChange={(event) => setCeoIdleState(event.target.value as CeoIdleState)}
          >
            {Object.entries(CEO_IDLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select> : undefined}
        />
        <AgentRow name="Trợ lý Feline" status={agentStatus("COURIER", phase)} tone="courier" active={phase === "OUTBOUND" || phase === "ARRIVAL" || phase === "HANDOFF" || phase === "RETURNING" || phase === "DELIVERY"} />
        <AgentRow name="Lemiex AI" status={agentStatus("LEMIEX", phase)} tone="lemiex" active={phase === "ARRIVAL" || phase === "PROCESSING" || phase === "HANDOFF" || Boolean(serverStage)} />
      </div>

      <div className="office-workflow-track" aria-label="Tiến trình nhiệm vụ">
        {WORKFLOW_STEPS.map((step, index) => <div key={step} className={`${index === currentStep ? "active" : ""} ${index < currentStep || phase === "COMPLETE" ? "done" : ""}`}>
          <i aria-hidden="true" /><span>{step}</span>
        </div>)}
      </div>

      {!result && <div className="office-ask-area">
        <label htmlFor="office-question">Giao việc cho CEO AI</label>
        <textarea
          id="office-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void run();
            }
          }}
          placeholder="Ví dụ: Hôm nay Lemiex có bao nhiêu đơn?"
          rows={3}
          disabled={running}
        />
        <div className="office-quick-questions">{QUICK_QUESTIONS.map((item) => <button key={item} disabled={running} onClick={() => void run(item)}>{item}</button>)}</div>
        {running
          ? <button className="office-stop" onClick={() => abortRef.current?.abort()}><Stop weight="fill" /> Dừng yêu cầu</button>
          : <button className="office-submit" disabled={!question.trim()} onClick={() => void run()}><PaperPlaneTilt weight="fill" /> Gửi sang Lemiex</button>}
      </div>}

      {running && <div className="office-progress-card"><span className="office-progress-orbit"><i /><i /><i /></span><div><strong>{status}</strong></div></div>}
      {error && <div className="office-error-card"><WarningCircle weight="fill" /><div><strong>Chưa hoàn tất</strong><span>{error}</span><button onClick={reset}>Thử yêu cầu khác</button></div></div>}

      {result && <article className="office-result-board">
        <header><span><CheckCircle weight="fill" /> ĐÃ NHẬN BÁO CÁO</span><small>{dataTime(result.source.dataUpdatedAtUtc)}</small></header>
        <div className="office-result-metric"><strong>{result.metric.value.toLocaleString("vi-VN")}</strong><span>{result.metric.unit}</span></div>
        <div className="office-result-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.answerMarkdown}</ReactMarkdown></div>
        <footer><span>Nguồn: shop-test · chỉ đọc</span><button onClick={reset}>Giao việc mới</button></footer>
      </article>}
      </>}
    </aside>
  </section>;
}

function LemiexWorkspacePanel({ displayName, canRunChat, onOpenChat }: { displayName: string; canRunChat: boolean; onOpenChat?: () => void }) {
  return <section className="office-lemiex-panel">
    <div className="office-command-heading">
      <span>XƯỞNG LEMIEX</span>
      <h2>Chào {displayName.trim()}</h2>
      <p>Theo dõi không gian vận hành và làm việc trực tiếp với Lemiex AI.</p>
    </div>
    <div className="office-agent-roster">
      <AgentRow name="Lemiex AI" status="Sẵn sàng hỗ trợ" tone="lemiex" active />
      <AgentRow name="Điều phối xưởng" status="Đang vận hành" tone="courier" active />
    </div>
    <div className="office-lemiex-access">
      <Buildings weight="duotone" />
      <div><strong>Không gian của bạn</strong><span>Tài khoản chỉ hiển thị dữ liệu, chức năng và mô hình thuộc Lemiex.</span></div>
    </div>
    {canRunChat && <button className="office-submit" onClick={onOpenChat}><ChatCircle weight="fill" /> Trò chuyện với Lemiex AI</button>}
  </section>;
}

function TiktokInteractionPanel({
  displayName,
  conversation,
  messages,
  question,
  loading,
  sending,
  status,
  error,
  messagesRef,
  onQuestionChange,
  onSend,
  onRetry,
  onStop,
  onClose
}: {
  displayName: string;
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  question: string;
  loading: boolean;
  sending: boolean;
  status: string;
  error: string | null;
  messagesRef: RefObject<HTMLDivElement | null>;
  onQuestionChange: (value: string) => void;
  onSend: (value?: string) => void;
  onRetry: (assistantMessageId: string) => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const firstName = displayName.trim().split(/\s+/).slice(-2).join(" ");
  const suggestions = [
    "Quy trình duyệt nội dung TikTok như thế nào?",
    "Ai phụ trách xử lý vấn đề của đơn TikTok?"
  ];

  return <section className="office-character-chat" aria-label="Trò chuyện với TikTok AI">
    <header className="office-character-chat-head">
      <div className="office-character-portrait"><span /><ChatCircle weight="duotone" /></div>
      <div><strong>TikTok AI</strong><small><i /> Sẵn sàng hỗ trợ</small></div>
      <button onClick={onClose} aria-label="Đóng cuộc trò chuyện"><X /></button>
    </header>

    <div className="office-character-intro">
      <h2>Xin chào {firstName}, tôi là TikTok AI.</h2>
      <p>Tôi hỗ trợ tra cứu quy trình và tri thức của phòng Sell TikTok trong phạm vi bạn được phép xem.</p>
    </div>

    <div className="office-character-messages" ref={messagesRef} aria-live="polite">
      {loading && <div className="office-character-loading"><span /><span /><span /></div>}
      {!loading && !messages.length && <div className="office-character-starters">
        {suggestions.map((item) => <button key={item} disabled={!conversation || sending} onClick={() => onSend(item)}>{item}</button>)}
      </div>}
      {messages.map((message) => <article key={message.id} className={`office-character-message ${message.role.toLowerCase()} ${message.status.toLowerCase()}`}>
        {message.role === "ASSISTANT" && <span className="office-character-message-name">TikTok AI</span>}
        {message.status === "FAILED"
          ? <p>{message.error || "Chưa thể hoàn tất câu trả lời."}</p>
          : <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.status === "PENDING" ? stableStreamingMarkdown(message.content) : message.content}</ReactMarkdown>}
        {message.role === "ASSISTANT" && message.status === "PENDING" && <i className="office-character-caret" />}
        {message.role === "ASSISTANT" && message.status !== "PENDING" && <div className="office-character-actions">
          {message.status === "COMPLETED" && message.content && <button onClick={() => void navigator.clipboard.writeText(message.content)}><Copy /> Sao chép</button>}
          <button disabled={sending} onClick={() => onRetry(message.id)}><ArrowCounterClockwise /> Thử lại</button>
        </div>}
        {message.sources?.length ? <div className="office-character-sources">{message.sources.slice(0, 3).map((source, index) => <span key={source.chunkId || index}>{source.title || source.label}</span>)}</div> : null}
      </article>)}
      {status && <div className="office-character-thinking"><span><i /><i /><i /></span>{status}</div>}
    </div>

    {error && <div className="office-character-error"><WarningCircle />{error}</div>}
    <form className="office-character-composer" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <textarea
        value={question}
        onChange={(event) => onQuestionChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSend();
          }
        }}
        placeholder="Nhập câu hỏi cho TikTok AI..."
        rows={2}
        disabled={!conversation || loading || sending}
      />
      {sending
        ? <button type="button" className="stop" onClick={onStop} aria-label="Dừng câu trả lời"><Stop weight="fill" /></button>
        : <button disabled={!conversation || loading || !question.trim()} aria-label="Gửi câu hỏi"><PaperPlaneTilt weight="fill" /></button>}
    </form>
  </section>;
}

function AgentRow({ name, status, tone, active, control }: { name: string; status: string; tone: string; active: boolean; control?: ReactNode }) {
  return <div className={`office-agent-row ${tone} ${active ? "active" : ""}`}>
    <i /><span><strong>{name}</strong>{control ?? <small>{status}</small>}</span>
  </div>;
}
