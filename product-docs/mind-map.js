(() => {
const { groups, docs } = window.productDocsData;

let stageSize = { width: 1800, height: 1120 };
let rootPoint = { x: 900, y: 555 };
const branchColors = ["#7f2028", "#9a6634", "#526a55", "#527083", "#85637c", "#9a7138", "#9a5b50", "#4f665d"];
const currentLayout = [
  { x: 310, y: 140, items: [{ x: 100, y: 58 }, { x: 310, y: 42 }, { x: 520, y: 72 }] },
  { x: 220, y: 460, items: [{ x: 55, y: 305 }, { x: 45, y: 410 }, { x: 50, y: 515 }, { x: 80, y: 620 }] },
  { x: 420, y: 900, items: [{ x: 185, y: 1030 }, { x: 420, y: 1060 }, { x: 650, y: 1030 }] },
  { x: 720, y: 190, items: [{ x: 650, y: 48 }, { x: 840, y: 42 }, { x: 1015, y: 105 }] },
  { x: 1120, y: 180, items: [{ x: 1090, y: 45 }, { x: 1290, y: 62 }, { x: 1470, y: 140 }] },
  { x: 1510, y: 760, items: [{ x: 1730, y: 635 }, { x: 1750, y: 735 }, { x: 1740, y: 835 }, { x: 1695, y: 935 }] },
  { x: 1080, y: 960, items: [{ x: 835, y: 1045 }, { x: 1050, y: 1070 }, { x: 1270, y: 1050 }, { x: 1490, y: 1010 }] }
];

const defaultPlan = [
  { id: "common", name: "Chức năng chung", items: [] },
  { id: "ceo", name: "CEO AI", items: [] },
  { id: "tiktok", name: "TikTok AI", items: [] },
  { id: "etsy", name: "Etsy AI", items: [] },
  { id: "accounting", name: "Kế toán AI", items: [
    { id: "accounting-overview", name: "Tổng quan tài chính", description: "Theo dõi dòng tiền, thu chi, công nợ và đề nghị mua hàng theo kỳ." },
    { id: "accounting-chat", name: "Hỏi đáp Kế toán", description: "Hỏi số liệu tài chính và quy trình nghiệp vụ trong phạm vi được cấp." },
    { id: "accounting-knowledge", name: "Kho tri thức Kế toán", description: "Quản lý quy trình, biểu mẫu, phiên bản và quyền đọc tài liệu Kế toán." }
  ] },
  { id: "lemiex", name: "Lemiex AI", items: [] },
  { id: "admin", name: "Quản trị", items: [] }
];

const planStorageKey = "feline-product-roadmap-v1";
const viewport = document.querySelector("#map-viewport");
const frame = document.querySelector("#map-frame");
const stage = document.querySelector("#map-stage");
const nodes = document.querySelector("#map-nodes");
const lines = document.querySelector("#map-lines");
const detailDialog = document.querySelector("#detail-dialog");
const detailContent = document.querySelector("#detail-content");
const plannedTools = document.querySelector("#planned-tools");
const planImport = document.querySelector("#plan-import");
const modeButtons = document.querySelectorAll("[data-mode]");
const focusControls = document.querySelector("#focus-controls");
const focusAction = document.querySelector("#focus-action");
let activeMode = location.hash === "#planned" ? "planned" : "current";
let plan = loadPlan();
let scale = 0.72;
let toastTimer;
let planLayoutCache = [];
let activeFocus = null;
let cameraFrame = 0;
let inertiaFrame = 0;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadPlan() {
  try {
    const saved = JSON.parse(localStorage.getItem(planStorageKey));
    if (!Array.isArray(saved)) return structuredClone(defaultPlan);
    const accounting = saved.find((branch) => branch.id === "accounting");
    const defaults = defaultPlan.find((branch) => branch.id === "accounting");
    if (accounting && defaults && !accounting.items.length) accounting.items = structuredClone(defaults.items);
    return saved;
  } catch {
    return structuredClone(defaultPlan);
  }
}

function savePlan(message) {
  localStorage.setItem(planStorageKey, JSON.stringify(plan));
  showToast(message || "Đã lưu kế hoạch trên thiết bị này");
}

function nodeMarkup({ type, x, y, label, meta, attrs = "", color = "", extraClass = "" }) {
  const style = `left:${x}px;top:${y}px;${color ? `--branch-color:${color};` : ""}`;
  return `<button class="map-node ${type}-node ${extraClass}" style="${style}" ${attrs}><strong>${escapeHtml(label)}</strong>${meta ? `<span>${escapeHtml(meta)}</span>` : ""}</button>`;
}

function connector(source, target, className = "", attrs = "") {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return `<path class="map-line ${className}" ${attrs} d="M ${source.x} ${source.y} C ${source.x + dx * .46} ${source.y}, ${target.x - dx * .46} ${target.y}, ${target.x} ${target.y}" />`;
  }
  return `<path class="map-line ${className}" ${attrs} d="M ${source.x} ${source.y} C ${source.x} ${source.y + dy * .46}, ${target.x} ${target.y - dy * .46}, ${target.x} ${target.y}" />`;
}

function renderCurrentMap() {
  updateStageBounds(1800, 1120);
  rootPoint = { x: 900, y: 555 };
  let nodeHtml = nodeMarkup({ type: "root", x: rootPoint.x, y: rootPoint.y, label: "Feline AI", meta: "Toàn cảnh hệ thống", attrs: 'data-doc="start"' });
  let lineHtml = "";

  groups.forEach((group, groupIndex) => {
    const layout = currentLayout[groupIndex];
    const color = branchColors[groupIndex];
    nodeHtml += nodeMarkup({
      type: "branch",
      x: layout.x,
      y: layout.y,
      label: group.title,
      meta: `${group.items.length} màn hình`,
      color,
      attrs: `data-group="${groupIndex}" data-focus-owner="current-${groupIndex}"`
    });
    lineHtml += connector(rootPoint, layout, "branch-line", `data-focus-owner="current-${groupIndex}"`);

    group.items.forEach(([id, label], itemIndex) => {
      const point = layout.items[itemIndex];
      const summary = docs[id]?.summary || "Xem chi tiết chức năng";
      nodeHtml += nodeMarkup({ type: "leaf", x: point.x, y: point.y, label, meta: shorten(summary, 46), attrs: `data-doc="${id}" data-focus-owner="current-${groupIndex}"` });
      lineHtml += connector(layout, point, "", `data-focus-owner="current-${groupIndex}"`);
    });
  });

  nodes.innerHTML = nodeHtml;
  lines.innerHTML = lineHtml;
  nodes.querySelectorAll("[data-doc]").forEach((button) => button.addEventListener("click", () => openDocument(button.dataset.doc)));
  nodes.querySelectorAll("[data-group]").forEach((button) => button.addEventListener("click", () => focusCurrentGroup(Number(button.dataset.group))));
}

function buildPlanLayout() {
  const sides = { left: [], right: [] };
  plan.forEach((branch, index) => {
    const entries = branch.items.length ? branch.items : [{ id: "empty", name: "Chưa có chức năng", description: "Bấm nhánh để thêm chức năng" }];
    const side = index % 2 === 0 ? "right" : "left";
    sides[side].push({ branch, entries, blockHeight: Math.max(190, entries.length * 76 + 80) });
  });

  const sideHeight = (entries) => entries.reduce((total, entry) => total + entry.blockHeight, 0);
  const height = Math.max(1120, sideHeight(sides.left) + 140, sideHeight(sides.right) + 140);
  updateStageBounds(1800, height);
  rootPoint = { x: 900, y: height / 2 };

  const positionSide = (sideName) => {
    const sideEntries = sides[sideName];
    let cursorY = (height - sideHeight(sideEntries)) / 2;
    return sideEntries.map(({ branch, entries, blockHeight }) => {
      const branchPoint = { x: sideName === "left" ? 570 : 1230, y: cursorY + blockHeight / 2 };
      const startY = branchPoint.y - ((entries.length - 1) * 76) / 2;
      const itemPoints = entries.map((item, itemIndex) => ({ item, x: sideName === "left" ? 285 : 1515, y: startY + itemIndex * 76 }));
      cursorY += blockHeight;
      return { branch, branchPoint, itemPoints };
    });
  };

  return [...positionSide("left"), ...positionSide("right")];
}

function updateStageBounds(width, height) {
  stageSize = { width, height };
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  lines.setAttribute("viewBox", `0 0 ${width} ${height}`);
}

function renderPlanMap() {
  planLayoutCache = buildPlanLayout();
  let nodeHtml = nodeMarkup({ type: "root", x: rootPoint.x, y: rootPoint.y, label: "Feline AI", meta: "Kế hoạch phát triển", attrs: 'data-add-branch="true"' });
  let lineHtml = "";

  planLayoutCache.forEach(({ branch, branchPoint, itemPoints }, branchIndex) => {
    const color = branchColors[branchIndex % branchColors.length];
    const owner = `plan-${branch.id}`;
    nodeHtml += nodeMarkup({
      type: "branch",
      x: branchPoint.x,
      y: branchPoint.y,
      label: branch.name,
      meta: branch.items.length ? `${branch.items.length} chức năng dự kiến` : "Chưa có chức năng",
      color,
      attrs: `data-plan-branch="${escapeHtml(branch.id)}" data-focus-owner="${escapeHtml(owner)}"`
    });
    lineHtml += connector(rootPoint, branchPoint, "branch-line plan-line", `data-focus-owner="${escapeHtml(owner)}"`);

    itemPoints.forEach(({ item, x, y }) => {
      const empty = item.id === "empty";
      nodeHtml += nodeMarkup({
        type: "leaf",
        extraClass: empty ? "plan-empty" : "",
        x,
        y,
        label: item.name,
        meta: shorten(item.description || "Chưa có mô tả", 44),
        attrs: `data-plan-item="${escapeHtml(branch.id)}" data-focus-owner="${escapeHtml(owner)}"`
      });
      lineHtml += connector(branchPoint, { x, y }, "plan-line", `data-focus-owner="${escapeHtml(owner)}"`);
    });
  });

  nodes.innerHTML = nodeHtml;
  lines.innerHTML = lineHtml;
  nodes.querySelectorAll("[data-plan-branch]").forEach((button) => button.addEventListener("click", () => focusPlanBranch(button.dataset.planBranch)));
  nodes.querySelectorAll("[data-plan-item]").forEach((button) => button.addEventListener("click", () => openPlanBranch(button.dataset.planItem)));
  nodes.querySelector("[data-add-branch]")?.addEventListener("click", openAddBranch);
  if (activeFocus?.owner.startsWith("plan-")) markFocusedElements(activeFocus.owner);
}

function renderMap({ fit = false } = {}) {
  clearFocus({ updateHeading: false });
  const planned = activeMode === "planned";
  updateHeading();
  plannedTools.hidden = !planned;
  document.querySelector(".map-legend span:last-child").lastChild.textContent = planned ? "Chức năng dự kiến" : "Màn hình";
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.mode === activeMode));
  if (planned) renderPlanMap();
  else renderCurrentMap();
  if (fit) requestAnimationFrame(fitMap);
}

function updateHeading() {
  const planned = activeMode === "planned";
  document.querySelector("#page-title").textContent = planned ? "Chức năng sẽ phát triển" : "Toàn cảnh hệ thống";
  document.querySelector("#page-description").textContent = planned
    ? "Mỗi nhánh là một khu vực có thể bổ sung chức năng dự kiến."
    : "Feline AI nằm ở trung tâm; các nhóm chức năng và màn hình tỏa ra xung quanh.";
}

function shorten(value, length) {
  return value.length > length ? `${value.slice(0, length - 1).trim()}…` : value;
}

function detailHeader(title, summary, planned = false) {
  return `<header class="detail-head"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(summary)}</p><div class="detail-status"><span>${planned ? "Kế hoạch tương lai" : "Đang sử dụng"}</span><span>${planned ? "Lưu trên thiết bị này" : "Cập nhật 19/11/2026"}</span></div></header>`;
}

function focusCurrentGroup(groupIndex) {
  const group = groups[groupIndex];
  const layout = currentLayout[groupIndex];
  focusBranch({
    owner: `current-${groupIndex}`,
    title: group.title,
    points: [layout, ...layout.items],
    actionLabel: "Xem mô tả nhóm",
    action: () => openGroup(groupIndex)
  });
}

function focusPlanBranch(branchId) {
  const entry = planLayoutCache.find(({ branch }) => branch.id === branchId);
  if (!entry) return;
  focusBranch({
    owner: `plan-${branchId}`,
    title: entry.branch.name,
    points: [entry.branchPoint, ...entry.itemPoints],
    actionLabel: "Chỉnh sửa nhánh",
    action: () => openPlanBranch(branchId)
  });
}

function focusBranch({ owner, title, points, actionLabel, action }) {
  activeFocus = { owner, title, action };
  markFocusedElements(owner);
  focusAction.textContent = actionLabel;
  focusControls.hidden = false;
  document.querySelector("#page-title").textContent = title;
  document.querySelector("#page-description").textContent = "Đang xem riêng nhánh này. Chọn một màn hình để mở nội dung chi tiết.";
  focusCameraToPoints(points);
}

function markFocusedElements(owner) {
  stage.classList.add("has-focus");
  [...nodes.querySelectorAll("[data-focus-owner]"), ...lines.querySelectorAll("[data-focus-owner]")].forEach((element) => {
    element.classList.toggle("is-focus-member", element.dataset.focusOwner === owner);
  });
}

function clearFocus({ updateHeading: shouldUpdateHeading = true } = {}) {
  activeFocus = null;
  stage.classList.remove("has-focus");
  [...nodes.querySelectorAll(".is-focus-member"), ...lines.querySelectorAll(".is-focus-member")].forEach((element) => element.classList.remove("is-focus-member"));
  focusControls.hidden = true;
  if (shouldUpdateHeading) updateHeading();
}

function focusCameraToPoints(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const bounds = {
    left: Math.min(...xs) - 105,
    right: Math.max(...xs) + 105,
    top: Math.min(...ys) - 65,
    bottom: Math.max(...ys) + 65
  };
  const width = Math.max(260, bounds.right - bounds.left);
  const height = Math.max(180, bounds.bottom - bounds.top);
  const targetScale = Math.min(1.16, Math.max(.62, Math.min((viewport.clientWidth - 34) / width, (viewport.clientHeight - 155) / height)));
  animateCamera(targetScale, { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 }, 680);
}

function openDocument(id) {
  const doc = docs[id] || docs.start;
  detailContent.innerHTML = `${detailHeader(doc.title, doc.summary)}
    ${doc.roles ? `<section class="detail-section"><h3>Ai sử dụng?</h3><div class="role-row">${doc.roles.map(([name, copy]) => `<div class="role-chip"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(copy)}</span></div>`).join("")}</div></section>` : ""}
    <section class="detail-section"><h3>Chức năng chính</h3><ul class="detail-list">${doc.features.map(([name, copy]) => `<li><strong>${escapeHtml(name)}</strong><span>${escapeHtml(copy)}</span></li>`).join("")}</ul></section>
    ${doc.flow ? `<section class="detail-section"><h3>Cách sử dụng nhanh</h3><div class="flow-row">${doc.flow.map(([name, copy]) => `<div class="flow-step"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(copy)}</span></div>`).join("")}</div></section>` : ""}`;
  openDialog();
}

function openGroup(groupIndex) {
  const group = groups[groupIndex];
  detailContent.innerHTML = `${detailHeader(group.title, `Nhóm gồm ${group.items.length} màn hình. Chọn một màn hình để xem mục đích và chức năng chính.`)}
    <div class="branch-overview">${group.items.map(([id, label]) => `<button data-open-doc="${id}"><strong>${escapeHtml(label)}</strong><span>Xem chi tiết</span></button>`).join("")}</div>`;
  detailContent.querySelectorAll("[data-open-doc]").forEach((button) => button.addEventListener("click", () => openDocument(button.dataset.openDoc)));
  openDialog();
}

function openPlanBranch(branchId) {
  const branch = plan.find((entry) => entry.id === branchId);
  if (!branch) return;
  detailContent.innerHTML = `${detailHeader(branch.name, "Quản lý các chức năng dự kiến thuộc nhánh này.", true)}
    <form class="plan-form two-columns" id="add-plan-item">
      <label>Tên chức năng<input name="name" maxlength="100" placeholder="Ví dụ: Phân tích chiến dịch" required></label>
      <label>Mô tả ngắn<input name="description" maxlength="240" placeholder="Chức năng này sẽ làm gì?"></label>
      <button>Thêm chức năng</button>
    </form>
    ${branch.items.length ? `<div class="plan-items">${branch.items.map((item) => `<div class="plan-item"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.description || "Chưa có mô tả")}</span><button data-remove-item="${escapeHtml(item.id)}">Xóa</button></div>`).join("")}</div>` : `<p class="plan-empty-copy">Nhánh này chưa có chức năng dự kiến. Bạn có thể thêm chức năng đầu tiên ngay phía trên.</p>`}
    <button class="plan-danger" id="remove-plan-branch">Xóa toàn bộ nhánh này</button>`;

  detailContent.querySelector("#add-plan-item").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    if (!name) return showToast("Vui lòng nhập tên chức năng");
    if (branch.items.length >= 12) return showToast("Mỗi nhánh tối đa 12 chức năng");
    branch.items.push({ id: makeId("feature"), name, description: String(data.get("description")).trim() });
    savePlan("Đã thêm chức năng dự kiến");
    renderPlanMap();
    openPlanBranch(branch.id);
  });
  detailContent.querySelectorAll("[data-remove-item]").forEach((button) => button.addEventListener("click", () => {
    const item = branch.items.find((entry) => entry.id === button.dataset.removeItem);
    if (!item || !confirm(`Xóa chức năng “${item.name}” khỏi kế hoạch?`)) return;
    branch.items = branch.items.filter((entry) => entry.id !== item.id);
    savePlan("Đã xóa chức năng dự kiến");
    renderPlanMap();
    openPlanBranch(branch.id);
  }));
  detailContent.querySelector("#remove-plan-branch").addEventListener("click", () => {
    if (!confirm(`Xóa nhánh “${branch.name}” cùng ${branch.items.length} chức năng dự kiến?`)) return;
    plan = plan.filter((entry) => entry.id !== branch.id);
    savePlan("Đã xóa nhánh phát triển");
    detailDialog.close();
    clearFocus();
    renderPlanMap();
    fitMap();
  });
  openDialog();
}

function openAddBranch() {
  detailContent.innerHTML = `${detailHeader("Thêm nhánh phát triển", "Tạo một nhánh mới trên sơ đồ để ghi lại nhóm chức năng dự kiến.", true)}
    <form class="plan-form" id="add-plan-branch"><label>Tên nhánh mới<input name="name" maxlength="80" placeholder="Ví dụ: Finance AI" required></label><button>Thêm vào sơ đồ</button></form>`;
  detailContent.querySelector("#add-plan-branch").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name")).trim();
    if (!name) return showToast("Vui lòng nhập tên nhánh");
    if (plan.length >= 16) return showToast("Kế hoạch tối đa 16 nhánh");
    const branch = { id: makeId("branch"), name, items: [] };
    plan.push(branch);
    savePlan("Đã thêm nhánh phát triển");
    renderPlanMap();
    openPlanBranch(branch.id);
  });
  openDialog();
}

function openDialog() {
  if (!detailDialog.open) detailDialog.showModal();
  detailDialog.querySelector(".dialog-shell").scrollTop = 0;
}

function setMode(mode) {
  activeMode = mode;
  history.replaceState(null, "", mode === "planned" ? "#planned" : location.pathname);
  renderMap({ fit: true });
}

function applyStageTransform(nextScale) {
  scale = Math.min(1.28, Math.max(.34, nextScale));
  stage.style.transform = `scale(${scale})`;
}

function updateFrameSize() {
  frame.style.width = `${stageSize.width * scale}px`;
  frame.style.height = `${stageSize.height * scale}px`;
}

function applyScale(nextScale) {
  applyStageTransform(nextScale);
  updateFrameSize();
}

function setScale(nextScale, center = true) {
  const centerPoint = {
    x: (viewport.scrollLeft - frame.offsetLeft + viewport.clientWidth / 2) / scale,
    y: (viewport.scrollTop - frame.offsetTop + viewport.clientHeight / 2) / scale
  };
  applyScale(nextScale);
  if (center) centerCameraOn(centerPoint);
}

function centerCameraOn(point) {
  viewport.scrollLeft = frame.offsetLeft + point.x * scale - viewport.clientWidth / 2;
  viewport.scrollTop = frame.offsetTop + point.y * scale - viewport.clientHeight / 2;
}

function getCameraCenter() {
  return {
    x: (viewport.scrollLeft - frame.offsetLeft + viewport.clientWidth / 2) / scale,
    y: (viewport.scrollTop - frame.offsetTop + viewport.clientHeight / 2) / scale
  };
}

function zoomAt(nextScale, clientX, clientY) {
  const rect = viewport.getBoundingClientRect();
  const offsetX = clientX - rect.left;
  const offsetY = clientY - rect.top;
  const stagePoint = {
    x: (viewport.scrollLeft + offsetX - frame.offsetLeft) / scale,
    y: (viewport.scrollTop + offsetY - frame.offsetTop) / scale
  };
  applyScale(nextScale);
  viewport.scrollLeft = frame.offsetLeft + stagePoint.x * scale - offsetX;
  viewport.scrollTop = frame.offsetTop + stagePoint.y * scale - offsetY;
}

function animateCamera(targetScale, point, duration = 520) {
  cancelAnimationFrame(cameraFrame);
  cancelAnimationFrame(inertiaFrame);
  const startScale = scale;
  const startLeft = viewport.scrollLeft;
  const startTop = viewport.scrollTop;
  const finalScale = Math.min(1.28, Math.max(.34, targetScale));
  const startFrameWidth = stageSize.width * startScale;
  const startFrameHeight = stageSize.height * startScale;
  const targetFrameWidth = stageSize.width * finalScale;
  const targetFrameHeight = stageSize.height * finalScale;
  frame.style.width = `${Math.max(startFrameWidth, targetFrameWidth)}px`;
  frame.style.height = `${Math.max(startFrameHeight, targetFrameHeight)}px`;
  const targetLeft = Math.max(0, frame.offsetLeft + point.x * finalScale - viewport.clientWidth / 2);
  const targetTop = Math.max(0, frame.offsetTop + point.y * finalScale - viewport.clientHeight / 2);
  const startedAt = performance.now();
  const effectiveDuration = reduceMotion.matches ? 0 : duration;
  stage.classList.add("camera-moving");

  const tick = (now) => {
    const progress = effectiveDuration ? Math.min(1, (now - startedAt) / effectiveDuration) : 1;
    const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    applyStageTransform(startScale + (finalScale - startScale) * eased);
    viewport.scrollLeft = startLeft + (targetLeft - startLeft) * eased;
    viewport.scrollTop = startTop + (targetTop - startTop) * eased;
    if (progress < 1) cameraFrame = requestAnimationFrame(tick);
    else {
      updateFrameSize();
      stage.classList.remove("camera-moving");
    }
  };
  cameraFrame = requestAnimationFrame(tick);
}

function fitMap() {
  clearFocus();
  const availableWidth = Math.max(320, viewport.clientWidth - 120);
  const availableHeight = Math.max(320, viewport.clientHeight - 140);
  const mobile = viewport.clientWidth < 600;
  const targetScale = mobile ? .85 : Math.min(availableWidth / stageSize.width, availableHeight / stageSize.height, .86);
  animateCamera(targetScale, rootPoint, 540);
}

function exportPlan() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), branches: plan }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "Ke_hoach_phat_trien_Feline_AI.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showToast("Đã tải bản kế hoạch");
}

function normalizeImportedPlan(imported) {
  if (!imported || !Array.isArray(imported.branches) || imported.branches.length > 16) throw new Error("Kế hoạch cần có từ 1 đến 16 nhánh.");
  return imported.branches.map((branch, branchIndex) => {
    if (!branch || typeof branch.name !== "string" || !branch.name.trim() || branch.name.length > 80 || !Array.isArray(branch.items) || branch.items.length > 12) {
      throw new Error(`Nhánh số ${branchIndex + 1} không hợp lệ hoặc có quá 12 chức năng.`);
    }
    return {
      id: makeId(`imported-branch-${branchIndex}`),
      name: branch.name.trim(),
      items: branch.items.map((item, itemIndex) => {
        if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 100 || (item.description != null && (typeof item.description !== "string" || item.description.length > 240))) {
          throw new Error(`Chức năng số ${itemIndex + 1} trong nhánh “${branch.name}” không hợp lệ.`);
        }
        return { id: makeId(`imported-item-${branchIndex}-${itemIndex}`), name: item.name.trim(), description: (item.description || "").trim() };
      })
    };
  });
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));
document.querySelector("#close-detail").addEventListener("click", () => detailDialog.close());
detailDialog.addEventListener("click", (event) => { if (event.target === detailDialog) detailDialog.close(); });
document.querySelector("#zoom-in").addEventListener("click", () => animateCamera(scale + .12, getCameraCenter(), 260));
document.querySelector("#zoom-out").addEventListener("click", () => animateCamera(scale - .12, getCameraCenter(), 260));
document.querySelector("#fit-map").addEventListener("click", fitMap);
focusAction.addEventListener("click", () => activeFocus?.action());
document.querySelector("#exit-focus").addEventListener("click", fitMap);
document.querySelector("#add-branch").addEventListener("click", openAddBranch);
document.querySelector("#export-plan").addEventListener("click", exportPlan);
document.querySelector("#import-plan").addEventListener("click", () => planImport.click());
document.querySelector("#reset-plan").addEventListener("click", () => {
  if (!confirm("Khôi phục kế hoạch mặc định? Toàn bộ chức năng đã nhập trên thiết bị này sẽ bị xóa.")) return;
  plan = structuredClone(defaultPlan);
  savePlan("Đã khôi phục kế hoạch mặc định");
  renderPlanMap();
  fitMap();
});
planImport.addEventListener("change", async () => {
  const file = planImport.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("File lớn hơn 1 MB.");
    plan = normalizeImportedPlan(JSON.parse(await file.text()));
    savePlan("Đã nhập bản kế hoạch");
    renderPlanMap();
    fitMap();
  } catch (error) {
    alert(`Không thể nhập bản kế hoạch. ${error instanceof Error ? error.message : "Vui lòng chọn đúng file đã xuất từ trang này."}`);
  }
  planImport.value = "";
});

const activePointers = new Map();
let gestureState = null;
let panVelocity = { x: 0, y: 0 };

function pointerDistance([first, second]) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointerMidpoint([first, second]) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function startInertia() {
  cancelAnimationFrame(inertiaFrame);
  if (reduceMotion.matches || Math.hypot(panVelocity.x, panVelocity.y) < .08) return;
  let lastTime = performance.now();
  const tick = (now) => {
    const elapsed = Math.min(32, now - lastTime);
    lastTime = now;
    viewport.scrollLeft += panVelocity.x * elapsed;
    viewport.scrollTop += panVelocity.y * elapsed;
    const decay = Math.pow(.935, elapsed / 16);
    panVelocity.x *= decay;
    panVelocity.y *= decay;
    if (Math.hypot(panVelocity.x, panVelocity.y) > .025) inertiaFrame = requestAnimationFrame(tick);
  };
  inertiaFrame = requestAnimationFrame(tick);
}

function interruptMotion() {
  cancelAnimationFrame(cameraFrame);
  cancelAnimationFrame(inertiaFrame);
  updateFrameSize();
  stage.classList.remove("camera-moving");
}

viewport.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target.closest("button")) return;
  interruptMotion();
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const points = [...activePointers.values()];
  if (points.length === 1) {
    gestureState = { mode: "pan", lastX: event.clientX, lastY: event.clientY, lastTime: performance.now() };
    panVelocity = { x: 0, y: 0 };
  } else if (points.length === 2) {
    gestureState = { mode: "pinch", distance: pointerDistance(points), scale };
  }
  viewport.classList.add("dragging");
  viewport.setPointerCapture(event.pointerId);
});
viewport.addEventListener("pointermove", (event) => {
  if (!activePointers.has(event.pointerId)) return;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const points = [...activePointers.values()];
  if (points.length === 2) {
    if (gestureState?.mode !== "pinch") gestureState = { mode: "pinch", distance: pointerDistance(points), scale };
    const distance = pointerDistance(points);
    const midpoint = pointerMidpoint(points);
    const targetScale = gestureState.scale * (distance / Math.max(1, gestureState.distance));
    zoomAt(scale + (targetScale - scale) * .42, midpoint.x, midpoint.y);
    return;
  }
  if (points.length === 1 && gestureState?.mode === "pan") {
    const now = performance.now();
    const elapsed = Math.max(1, now - gestureState.lastTime);
    const dx = event.clientX - gestureState.lastX;
    const dy = event.clientY - gestureState.lastY;
    viewport.scrollLeft -= dx;
    viewport.scrollTop -= dy;
    const nextVelocity = { x: -dx / elapsed, y: -dy / elapsed };
    panVelocity = {
      x: Math.max(-1.8, Math.min(1.8, panVelocity.x * .62 + nextVelocity.x * .38)),
      y: Math.max(-1.8, Math.min(1.8, panVelocity.y * .62 + nextVelocity.y * .38))
    };
    gestureState.lastX = event.clientX;
    gestureState.lastY = event.clientY;
    gestureState.lastTime = now;
  }
});
function finishPointer(event) {
  activePointers.delete(event.pointerId);
  const points = [...activePointers.values()];
  if (points.length === 1) {
    gestureState = { mode: "pan", lastX: points[0].x, lastY: points[0].y, lastTime: performance.now() };
  } else if (!points.length) {
    viewport.classList.remove("dragging");
    const wasPan = gestureState?.mode === "pan";
    gestureState = null;
    if (wasPan) startInertia();
  }
}
viewport.addEventListener("pointerup", finishPointer);
viewport.addEventListener("pointercancel", finishPointer);
viewport.addEventListener("wheel", (event) => {
  interruptMotion();
  if (!event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  zoomAt(scale * Math.exp(-event.deltaY * .0022), event.clientX, event.clientY);
}, { passive: false });
viewport.addEventListener("dblclick", (event) => { if (!event.target.closest("button")) fitMap(); });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeFocus && !detailDialog.open) fitMap();
});

renderMap({ fit: true });
})();
