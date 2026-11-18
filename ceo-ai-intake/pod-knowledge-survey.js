(function () {
  const config = window.SURVEY_CONFIG;
  if (!config) throw new Error("Thiếu cấu hình khảo sát");

  const root = document.querySelector("#survey-root");
  const storageKey = `feline-pod-knowledge-${config.slug}-v1`;
  let step = 0;
  let saveTimer;

  const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  const slugify = (value) => String(value || "ket-qua").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");

  function saved() {
    try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); } catch { return {}; }
  }

  function icon() {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 8.5 12 4l5 4.5v7L12 20l-5-4.5v-7Z" stroke="currentColor" stroke-width="1.7"/><path d="m9.5 11 2.5 2 3-3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function shell() {
    root.innerHTML = `
      <main class="page">
        <header class="topbar"><div class="brand"><span class="brand-mark">${icon()}</span><span>Feline AI · Knowledge Intake</span></div><div class="save-state" id="save-state">Tự động lưu trên thiết bị này</div></header>
        <section class="hero"><div><h1>${esc(config.title)}</h1><p class="hero-copy">${esc(config.intro)}</p><details class="mobile-guide"><summary>Cách điền khảo sát</summary><p>${esc(config.intro)}</p><p>${config.meta.map((item) => `<strong>${esc(item.title)}:</strong> ${esc(item.copy)}`).join("<br><br>")}</p></details></div><div class="hero-meta">${config.meta.map((item) => `<div><strong>${esc(item.title)}</strong><span>${esc(item.copy)}</span></div>`).join("")}</div></section>
        <section class="workspace">
          <aside class="rail">
            <div><div class="progress-copy"><strong id="progress-value">0%</strong><span id="progress-detail"></span></div><div class="progress"><div class="progress-bar" id="progress-bar"></div></div></div>
            <nav class="section-nav" id="section-nav" aria-label="Các phần khảo sát"></nav>
            <select class="field mobile-section" id="mobile-section" aria-label="Chọn phần khảo sát"></select>
            <div class="rail-actions"><button class="button" id="export-json" type="button">Xuất bản nháp JSON</button><button class="button" id="reset" type="button">Làm mới</button></div>
          </aside>
          <form class="form-shell" id="survey-form" novalidate>
            <header class="form-head"><div><h2 id="section-title"></h2><p id="section-description"></p></div><span class="step-chip" id="step-chip"></span></header>
            <div class="form-body" id="form-body"></div>
            <footer class="form-actions"><button class="button" id="back" type="button">Quay lại</button><button class="button primary" id="next" type="button">Tiếp tục</button></footer>
          </form>
        </section>
      </main><div class="toast" id="toast" role="status" aria-live="polite"></div>`;
  }

  function fieldMarkup(field, data) {
    const required = field.required ? `<span class="required"> *</span>` : "";
    const hint = field.hint ? `<p class="hint">${esc(field.hint)}</p>` : "";
    const value = data[field.id];
    let control = "";
    if (field.type === "textarea") {
      control = `<textarea class="field" id="${field.id}" name="${field.id}" placeholder="${esc(field.placeholder || "")}" ${field.required ? "required" : ""}>${esc(value || "")}</textarea><span class="error">Vui lòng nhập nội dung cần thiết.</span>`;
    } else if (field.type === "select") {
      control = `<select class="field" id="${field.id}" name="${field.id}" ${field.required ? "required" : ""}><option value="">Chọn câu trả lời</option>${field.options.map((option) => `<option value="${esc(option)}" ${value === option ? "selected" : ""}>${esc(option)}</option>`).join("")}</select><span class="error">Vui lòng chọn một phương án.</span>`;
    } else if (field.type === "radio" || field.type === "checkbox") {
      const selected = Array.isArray(value) ? value : value ? [value] : [];
      const hasOther = field.options.some((option) => isOtherOption(typeof option === "string" ? option : option.label));
      const otherSelected = field.options.some((option) => {
        const item = typeof option === "string" ? { label: option, value: option } : option;
        return isOtherOption(item.label) && selected.includes(item.value || item.label);
      });
      control = `<div class="options" ${field.required ? `data-required-group="${field.id}"` : ""}>${field.options.map((option, index) => {
        const item = typeof option === "string" ? { label: option, value: option } : option;
        const id = `${field.id}-${index}`;
        return `<div class="option"><input id="${id}" name="${field.id}" type="${field.type}" value="${esc(item.value || item.label)}" data-other-option="${isOtherOption(item.label) ? "true" : "false"}" ${selected.includes(item.value || item.label) ? "checked" : ""}><label for="${id}"><span class="option-copy"><strong>${esc(item.label)}</strong>${item.copy ? `<span>${esc(item.copy)}</span>` : ""}</span></label></div>`;
      }).join("")}${hasOther ? `<div class="other-field ${otherSelected ? "is-visible" : ""}" data-other-field="${field.id}"><label for="${field.id}Other">Vui lòng ghi rõ lựa chọn khác <span class="required">*</span></label><input class="field" id="${field.id}Other" name="${field.id}Other" value="${esc(data[`${field.id}Other`] || "")}" placeholder="Nhập nội dung cụ thể"><span class="error">Vui lòng ghi rõ lựa chọn khác.</span></div>` : ""}</div>${field.required ? '<span class="error">Vui lòng chọn một phương án.</span>' : ""}`;
    } else {
      control = `<input class="field" id="${field.id}" name="${field.id}" type="${field.type || "text"}" value="${esc(value || "")}" placeholder="${esc(field.placeholder || "")}" ${field.required ? "required" : ""}><span class="error">Vui lòng nhập thông tin cần thiết.</span>`;
    }
    if (field.type === "radio" || field.type === "checkbox") {
      return `<fieldset class="field-group"><legend class="question">${esc(field.label)}${required}</legend>${hint}${control}</fieldset>`;
    }
    return `<section class="field-group"><label class="question" for="${field.id}">${esc(field.label)}${required}</label>${hint}${control}</section>`;
  }

  function isOtherOption(label) {
    return /(^|\s)khác($|\s)/i.test(String(label || ""));
  }

  function render(shouldScroll = false) {
    const data = saved();
    const section = config.sections[step];
    document.title = `${section.title} · ${config.title}`;
    document.querySelector("#section-title").textContent = section.title;
    document.querySelector("#section-description").textContent = section.description;
    document.querySelector("#step-chip").textContent = `${step + 1}/${config.sections.length}`;
    document.querySelector("#form-body").innerHTML = section.fields.map((field) => fieldMarkup(field, data)).join("");
    bindOtherOptions();
    document.querySelector("#back").disabled = step === 0;
    document.querySelector("#next").textContent = step === config.sections.length - 1 ? "Hoàn tất & tải Markdown" : "Lưu và tiếp tục";
    renderNav();
    updateProgress();
    if (shouldScroll) document.querySelector("#form-shell")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  function renderNav() {
    const data = values();
    const nav = document.querySelector("#section-nav");
    nav.innerHTML = config.sections.map((section, index) => {
      const answered = section.fields.filter((field) => fieldHasAnswer(field, data)).length;
      const done = answered === section.fields.length;
      const started = answered > 0;
      return `<button class="nav-button ${done ? "is-done" : started ? "is-started" : ""}" type="button" data-step="${index}" ${index === step ? 'aria-current="step"' : ""}><span class="nav-index">${index + 1}</span><span class="nav-label">${esc(section.shortTitle || section.title)}</span></button>`;
    }).join("");
    nav.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => go(Number(button.dataset.step))));
    const mobile = document.querySelector("#mobile-section");
    mobile.innerHTML = config.sections.map((section, index) => `<option value="${index}" ${index === step ? "selected" : ""}>${index + 1}. ${esc(section.shortTitle || section.title)}</option>`).join("");
  }

  function values() {
    const result = { ...saved() };
    const form = document.querySelector("#survey-form");
    if (!form) return result;
    const current = new FormData(form);
    const section = config.sections[step];
    section.fields.forEach((field) => {
      if (field.type === "checkbox") result[field.id] = current.getAll(field.id);
      else if (current.has(field.id)) result[field.id] = current.get(field.id);
      const otherName = `${field.id}Other`;
      if (current.has(otherName)) result[otherName] = current.get(otherName);
    });
    return result;
  }

  function hasValue(value) { return Array.isArray(value) ? value.length > 0 : String(value || "").trim().length > 0; }

  function fieldHasAnswer(field, data) {
    if (!hasValue(data[field.id])) return false;
    const choices = field.options || [];
    const selected = Array.isArray(data[field.id]) ? data[field.id] : [data[field.id]];
    const choseOther = choices.some((option) => {
      const item = typeof option === "string" ? { label: option, value: option } : option;
      return isOtherOption(item.label) && selected.includes(item.value || item.label);
    });
    return !choseOther || hasValue(data[`${field.id}Other`]);
  }

  function persist(silent = false) {
    localStorage.setItem(storageKey, JSON.stringify(values()));
    document.querySelector("#save-state").textContent = `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
    if (!silent) toast("Đã lưu tiến độ");
    updateProgress();
  }

  function updateProgress() {
    const data = values();
    const all = config.sections.flatMap((section) => section.fields);
    const answered = all.filter((field) => fieldHasAnswer(field, data)).length;
    const percent = Math.round(answered / all.length * 100);
    document.querySelector("#progress-value").textContent = `${percent}%`;
    document.querySelector("#progress-detail").textContent = `${answered}/${all.length} câu đã điền`;
    document.querySelector("#progress-bar").style.width = `${percent}%`;
  }

  function validate() {
    let valid = true;
    document.querySelectorAll(".field[required]").forEach((field) => {
      field.classList.toggle("is-invalid", !field.value.trim());
      if (!field.value.trim()) valid = false;
    });
    document.querySelectorAll("[data-required-group]").forEach((group) => {
      const checked = group.querySelector("input:checked");
      group.classList.toggle("is-invalid", !checked);
      if (!checked) valid = false;
    });
    document.querySelectorAll("[data-other-field].is-visible .field").forEach((field) => {
      const missing = !field.value.trim();
      field.classList.toggle("is-invalid", missing);
      if (missing) valid = false;
    });
    if (!valid) {
      document.querySelector(".is-invalid")?.focus();
      toast("Còn câu bắt buộc chưa được điền");
    }
    return valid;
  }

  function bindOtherOptions() {
    document.querySelectorAll('input[data-other-option="true"]').forEach((input) => {
      const update = () => {
        const container = document.querySelector(`[data-other-field="${CSS.escape(input.name)}"]`);
        if (!container) return;
        const selected = [...document.querySelectorAll(`input[name="${CSS.escape(input.name)}"][data-other-option="true"]`)].some((item) => item.checked);
        container.classList.toggle("is-visible", selected);
        const field = container.querySelector(".field");
        if (!selected) field?.classList.remove("is-invalid");
        if (selected) setTimeout(() => field?.focus(), 0);
      };
      input.addEventListener("change", update);
      if (input.type === "radio") {
        document.querySelectorAll(`input[name="${CSS.escape(input.name)}"]`).forEach((item) => item.addEventListener("change", update));
      }
    });
  }

  function validateAllRequired() {
    persist(true);
    const data = saved();
    for (let sectionIndex = 0; sectionIndex < config.sections.length; sectionIndex += 1) {
      const missing = config.sections[sectionIndex].fields.find((field) =>
        (field.required && !hasValue(data[field.id])) || (hasValue(data[field.id]) && !fieldHasAnswer(field, data))
      );
      if (!missing) continue;
      step = sectionIndex;
      render(true);
      setTimeout(() => {
        const otherTarget = document.querySelector(`#${CSS.escape(`${missing.id}Other`)}`);
        const target = otherTarget || document.querySelector(`#${CSS.escape(missing.id)}`) || document.querySelector(`[name="${CSS.escape(missing.id)}"]`);
        target?.focus();
        target?.classList.add("is-invalid");
      }, 0);
      toast(`Còn thiếu thông tin: ${missing.label}`);
      return false;
    }
    return true;
  }

  function go(nextStep, shouldValidate = false) {
    if (shouldValidate && !validate()) return;
    persist(true);
    step = Math.max(0, Math.min(config.sections.length - 1, nextStep));
    render(true);
  }

  function markdown() {
    const data = values();
    const lines = [`# ${config.exportTitle}`, "", `- Trạng thái: Hoàn tất các trường bắt buộc`, `- Ngày xuất: ${new Date().toLocaleString("vi-VN")}`, `- Loại khảo sát: ${config.title}`, ""];
    config.sections.forEach((section) => {
      lines.push(`## ${section.title}`, "");
      section.fields.forEach((field) => {
        const raw = data[field.id];
        const baseAnswer = Array.isArray(raw) ? raw.join("; ") : String(raw || "").trim();
        const other = String(data[`${field.id}Other`] || "").trim();
        const answer = other ? `${baseAnswer}${baseAnswer ? "; " : ""}Chi tiết lựa chọn khác: ${other}` : baseAnswer;
        lines.push(`### ${field.label}`, "", answer || "_Chưa trả lời_", "");
      });
    });
    return lines.join("\n");
  }

  function download(kind) {
    persist(true);
    const data = values();
    const name = slugify(data.respondentName || data.teamName || config.slug);
    const status = kind === "json" ? "DRAFT" : "REQUIRED_FIELDS_COMPLETED";
    const content = kind === "json" ? JSON.stringify({ survey: config.slug, status, exportedAt: new Date().toISOString(), answers: data }, null, 2) : markdown();
    const blob = new Blob([content], { type: kind === "json" ? "application/json;charset=utf-8" : "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${kind === "json" ? "BAN_NHAP_" : ""}${config.filePrefix}_${name}.${kind === "json" ? "json" : "md"}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast(kind === "json" ? "Đã tải dữ liệu JSON" : "Đã tải tài liệu Markdown");
  }

  function toast(message) {
    const element = document.querySelector("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(element.timer);
    element.timer = setTimeout(() => element.classList.remove("show"), 2600);
  }

  shell();
  document.querySelector("#survey-form").addEventListener("input", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(true), 350);
  });
  document.querySelector("#survey-form").addEventListener("submit", (event) => event.preventDefault());
  document.querySelector("#back").addEventListener("click", () => go(step - 1));
  document.querySelector("#next").addEventListener("click", () => step === config.sections.length - 1 ? (validate() && validateAllRequired() && download("md")) : go(step + 1, true));
  document.querySelector("#export-json").addEventListener("click", () => download("json"));
  document.querySelector("#mobile-section").addEventListener("change", (event) => {
    const nextStep = Number(event.target.value);
    setTimeout(() => go(nextStep), 100);
  });
  document.querySelector("#reset").addEventListener("click", () => {
    if (!confirm("Xóa toàn bộ câu trả lời đã lưu trên thiết bị này?")) return;
    localStorage.removeItem(storageKey);
    step = 0;
    render();
    toast("Đã làm mới khảo sát");
  });
  render();
})();
