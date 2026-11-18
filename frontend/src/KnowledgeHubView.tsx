import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Check,
  ChevronRight,
  FilePlus2,
  FileText,
  FlaskConical,
  History,
  Layers3,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X
} from "lucide-react";
import { api } from "./api";
import type {
  KnowledgeDocument,
  KnowledgeDocumentStatus,
  KnowledgeList,
  KnowledgeSearchResult
} from "./types";

const DEPARTMENTS = [
  { code: "ALL", name: "Toàn công ty" },
  { code: "MANAGEMENT", name: "Ban quản lý" },
  { code: "HR", name: "Nhân sự" },
  { code: "FINANCE", name: "Tài chính" },
  { code: "OPERATIONS", name: "Vận hành" },
  { code: "SELL_TIKTOK", name: "Sell TikTok" },
  { code: "ETSY", name: "Sell Etsy" }
];

const STATUS_LABEL: Record<KnowledgeDocumentStatus, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đang áp dụng",
  ARCHIVED: "Đã lưu trữ"
};

function formatDate(value?: string | null) {
  if (!value) return "Không giới hạn";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric"
  }).format(new Date(value));
}

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function KnowledgeHubView({ agentId = "ceo-ai" }: { agentId?: "ceo-ai" | "tiktok-ai" | "etsy-ai" }) {
  const agentName = agentId === "tiktok-ai" ? "TikTok AI" : agentId === "etsy-ai" ? "Etsy AI" : "CEO AI";
  const [data, setData] = useState<KnowledgeList | null>(null);
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<KnowledgeDocumentStatus | "ALL">("ALL");
  const [department, setDepartment] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  async function load(preferredId?: string) {
    setLoading(true);
    setError(null);
    try {
      const list = await api.knowledgeDocuments({ agentId, search, status, department });
      setData(list);
      const targetId = preferredId || selected?.id;
      if (targetId) {
        const row = list.items.find((item) => item.id === targetId);
        setSelected(row ? await api.knowledgeDocument(row.id) : null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải kho tri thức");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [agentId, status, department]);

  async function openDocument(id: string) {
    setError(null);
    try {
      setSelected(await api.knowledgeDocument(id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể mở tài liệu");
    }
  }

  async function removeMockData() {
    const count = data?.summary.mock || 0;
    if (!count || !window.confirm(`Xóa ${count} tài liệu dữ liệu mẫu khỏi Knowledge Hub?`)) return;
    try {
      const result = await api.removeMockKnowledge(agentId);
      setSelected(null);
      setNotice(`Đã xóa ${result.removed} tài liệu mẫu`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể xóa dữ liệu mẫu");
    }
  }

  const departments = useMemo(() => {
    const values = new Map(DEPARTMENTS.map((item) => [item.code, item.name]));
    data?.items.forEach((item) => values.set(item.ownerDepartmentCode, item.ownerDepartmentName));
    return [...values.entries()].map(([code, name]) => ({ code, name }));
  }, [data]);

  return <>
    <section className="knowledge-command">
      <div>
        <span><BookOpen /> {agentName} · Knowledge Hub</span>
        <h2>Tri thức nội bộ có kiểm soát</h2>
        <p>Quản lý tài liệu, phiên bản hiệu lực, chủ sở hữu và phạm vi phòng ban được phép đọc.</p>
      </div>
      <div className="knowledge-command-actions">
        <button className="secondary" onClick={() => setSearchOpen(true)}><Sparkles /> Kiểm tra tìm kiếm</button>
        <button onClick={() => setUploadOpen(true)}><Upload /> Tải tài liệu</button>
      </div>
    </section>

    {error && <div className="error-banner"><AlertTriangle /><span>{error}</span><button onClick={() => setError(null)}><X /></button></div>}
    {notice && <div className="knowledge-notice"><Check />{notice}<button onClick={() => setNotice(null)}><X /></button></div>}

    <section className="knowledge-summary" aria-label="Tổng quan kho tri thức">
      <KnowledgeStat icon={<FileText />} label="Tài liệu" value={data?.summary.total ?? 0} />
      <KnowledgeStat icon={<ShieldCheck />} label="Đang áp dụng" value={data?.summary.published ?? 0} tone="green" />
      <KnowledgeStat icon={<Layers3 />} label="Đoạn tri thức" value={data?.summary.chunks ?? 0} tone="blue" />
      <KnowledgeStat icon={<FlaskConical />} label="Dữ liệu mẫu" value={data?.summary.mock ?? 0} tone="amber" />
    </section>

    <section className="white-card knowledge-table-card">
      <header className="knowledge-table-header">
        <div><span>THƯ VIỆN TÀI LIỆU</span><h3>Danh sách tài liệu</h3></div>
        <div className="knowledge-table-actions">
          {Boolean(data?.summary.mock) && <button className="danger-quiet" onClick={() => void removeMockData()}><Trash2 /> Xóa dữ liệu mẫu</button>}
          <button className="icon-button" aria-label="Tải lại" onClick={() => void load()}><RefreshCw className={loading ? "spin" : ""} /></button>
        </div>
      </header>
      <div className="knowledge-filters">
        <form className="knowledge-search" onSubmit={(event) => { event.preventDefault(); void load(); }}>
          <Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, danh mục hoặc chủ sở hữu" />
          {search && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setSearch(""); setTimeout(() => void load(), 0); }}><X /></button>}
        </form>
        <select value={status} onChange={(event) => setStatus(event.target.value as KnowledgeDocumentStatus | "ALL")}>
          <option value="ALL">Tất cả trạng thái</option><option value="PUBLISHED">Đang áp dụng</option><option value="DRAFT">Bản nháp</option><option value="ARCHIVED">Đã lưu trữ</option>
        </select>
        <select value={department} onChange={(event) => setDepartment(event.target.value)}>
          <option value="">Tất cả phòng ban</option>{departments.filter((item) => item.code !== "ALL").map((item) => <option value={item.code} key={item.code}>{item.name}</option>)}
        </select>
        <span>{data?.items.length || 0} kết quả</span>
      </div>
      <div className="knowledge-table-wrap"><table className="knowledge-table">
        <thead><tr><th>Tài liệu</th><th>Chủ sở hữu</th><th>Quyền đọc</th><th>Phiên bản</th><th>Hiệu lực</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>{data?.items.map((document) => {
          const version = document.versions[0];
          return <tr key={document.id} tabIndex={0} onClick={() => void openDocument(document.id)} onKeyDown={(event) => { if (event.key === "Enter") void openDocument(document.id); }}>
            <td><div className="knowledge-doc-cell"><span><FileText /></span><div><strong>{document.title}</strong><small>{document.category}{document.isMock ? " · Dữ liệu mẫu" : ""}</small></div></div></td>
            <td><strong>{document.ownerDepartmentName}</strong><small>{document.ownerName}</small></td>
            <td><div className="knowledge-access-list">{document.accessRules.slice(0, 2).map((rule) => <em key={rule.id}>{rule.departmentName}</em>)}{document.accessRules.length > 2 && <b>+{document.accessRules.length - 2}</b>}</div></td>
            <td><strong>v{document.currentVersionNumber}</strong><small>{version?.chunkCount || 0} đoạn</small></td>
            <td><strong>{formatDate(version?.effectiveFrom)}</strong><small>đến {formatDate(version?.effectiveTo)}</small></td>
            <td><span className={`knowledge-status ${document.status.toLowerCase()}`}>{STATUS_LABEL[document.status]}</span></td>
            <td><button className="row-arrow" aria-label={`Mở ${document.title}`}><ChevronRight /></button></td>
          </tr>;
        })}</tbody>
      </table>{!loading && !data?.items.length && <div className="knowledge-empty"><BookOpen /><strong>Không có tài liệu phù hợp</strong><span>Thay đổi bộ lọc hoặc tải tài liệu mới.</span></div>}</div>
    </section>

    {selected && <KnowledgeDrawer document={selected} onClose={() => setSelected(null)} onChanged={async (message) => { setNotice(message); await load(selected.id); }} />}
    {uploadOpen && <UploadDocumentDialog agentId={agentId} onClose={() => setUploadOpen(false)} onUploaded={async (document) => { setUploadOpen(false); setNotice("Đã tải và lập chỉ mục tài liệu"); await load(document.id); }} />}
    {searchOpen && <KnowledgeSearchDialog agentId={agentId} onClose={() => setSearchOpen(false)} onOpenDocument={(id) => { setSearchOpen(false); void openDocument(id); }} />}
  </>;
}

function KnowledgeStat({ icon, label, value, tone = "slate" }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return <article><span className={tone}>{icon}</span><div><small>{label}</small><strong>{value.toLocaleString("vi-VN")}</strong></div></article>;
}

function KnowledgeDrawer({ document, onClose, onChanged }: { document: KnowledgeDocument; onClose: () => void; onChanged: (message: string) => Promise<void> }) {
  const latest = document.versions[0];
  const [editing, setEditing] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: document.title,
    category: document.category,
    description: document.description || "",
    ownerDepartmentCode: document.ownerDepartmentCode,
    ownerDepartmentName: document.ownerDepartmentName,
    ownerName: document.ownerName,
    status: document.status,
    allowedDepartments: document.accessRules.map((item) => item.departmentCode)
  });

  useEffect(() => {
    setForm({ title: document.title, category: document.category, description: document.description || "", ownerDepartmentCode: document.ownerDepartmentCode, ownerDepartmentName: document.ownerDepartmentName, ownerName: document.ownerName, status: document.status, allowedDepartments: document.accessRules.map((item) => item.departmentCode) });
  }, [document]);

  function toggleDepartment(code: string) {
    setForm((current) => ({ ...current, allowedDepartments: current.allowedDepartments.includes(code) ? current.allowedDepartments.filter((item) => item !== code) : [...current.allowedDepartments, code] }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.allowedDepartments.length) { setError("Chọn ít nhất một phòng ban được phép đọc"); return; }
    setSaving(true); setError(null);
    try {
      await api.updateKnowledgeDocument(document.id, form);
      setEditing(false);
      await onChanged("Đã cập nhật thông tin tài liệu");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể cập nhật tài liệu"); }
    finally { setSaving(false); }
  }

  async function reindex() {
    setSaving(true); setError(null);
    try { await api.reindexKnowledgeDocument(document.id); await onChanged("Đã lập chỉ mục lại phiên bản mới nhất"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể lập chỉ mục lại"); }
    finally { setSaving(false); }
  }

  return <div className="knowledge-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="knowledge-drawer"><form onSubmit={save}>
      <header><div><span>{document.isMock ? "DỮ LIỆU MẪU" : "TÀI LIỆU NỘI BỘ"}</span><h2>{document.title}</h2><p>Cập nhật {formatDateTime(document.updatedAt)}</p></div><button type="button" onClick={onClose}><X /></button></header>
      {error && <div className="knowledge-inline-error"><AlertTriangle />{error}</div>}
      <div className="knowledge-drawer-actions">
        <button type="button" className="secondary" onClick={() => setVersionOpen(true)}><FilePlus2 /> Thêm phiên bản</button>
        <button type="button" className="secondary" disabled={saving} onClick={() => void reindex()}><RefreshCw className={saving ? "spin" : ""} /> Lập chỉ mục lại</button>
        {!editing && <button type="button" onClick={() => setEditing(true)}>Chỉnh sửa</button>}
      </div>
      <div className="knowledge-drawer-body">
        <section className="knowledge-section">
          <div className="knowledge-section-title"><div><span>THÔNG TIN</span><h3>Quản lý tài liệu</h3></div><span className={`knowledge-status ${document.status.toLowerCase()}`}>{STATUS_LABEL[document.status]}</span></div>
          {editing ? <div className="knowledge-form-grid">
            <label className="wide"><span>Tên tài liệu</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label><span>Danh mục</span><input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
            <label><span>Trạng thái</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as KnowledgeDocumentStatus })}><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Đang áp dụng</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>
            <label><span>Mã phòng ban sở hữu</span><input required value={form.ownerDepartmentCode} onChange={(event) => setForm({ ...form, ownerDepartmentCode: event.target.value.toUpperCase() })} /></label>
            <label><span>Tên phòng ban</span><input required value={form.ownerDepartmentName} onChange={(event) => setForm({ ...form, ownerDepartmentName: event.target.value })} /></label>
            <label className="wide"><span>Người chịu trách nhiệm</span><input required value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} /></label>
            <label className="wide"><span>Mô tả</span><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          </div> : <div className="knowledge-detail-grid">
            <Detail label="Danh mục" value={document.category} /><Detail label="Phòng ban sở hữu" value={document.ownerDepartmentName} /><Detail label="Người chịu trách nhiệm" value={document.ownerName} /><Detail label="Phiên bản hiện tại" value={`v${document.currentVersionNumber}`} /><Detail label="Ngày hiệu lực" value={formatDate(latest?.effectiveFrom)} /><Detail label="Ngày hết hiệu lực" value={formatDate(latest?.effectiveTo)} />
            {document.description && <p>{document.description}</p>}
          </div>}
        </section>

        <section className="knowledge-section">
          <div className="knowledge-section-title"><div><span>PHẠM VI ĐỌC</span><h3>Phòng ban được truy cập</h3></div><Users /></div>
          <div className="department-permissions">{DEPARTMENTS.map((item) => {
            const checked = form.allowedDepartments.includes(item.code);
            return <label key={item.code} className={checked ? "selected" : ""}><input type="checkbox" disabled={!editing} checked={checked} onChange={() => toggleDepartment(item.code)} /><span><strong>{item.name}</strong><small>{item.code}</small></span><Check /></label>;
          })}</div>
        </section>

        <section className="knowledge-section">
          <div className="knowledge-section-title"><div><span>LỊCH SỬ</span><h3>Các phiên bản</h3></div><History /></div>
          <div className="knowledge-version-list">{document.versions.map((version) => <article key={version.id}>
            <span className="version-number">v{version.versionNumber}</span><div><strong>{version.originalFileName || "Nội dung khởi tạo"}</strong><small>{version.chunkCount} đoạn · {formatDateTime(version.indexedAt || version.createdAt)}</small></div><span className={`version-state ${version.status.toLowerCase()}`}>{version.status === "READY" ? "Sẵn sàng" : version.status === "FAILED" ? "Lỗi" : "Đang xử lý"}</span>
          </article>)}</div>
        </section>

        {latest?.chunks && latest.chunks.length > 0 && <section className="knowledge-section">
          <div className="knowledge-section-title"><div><span>NỘI DUNG ĐÃ CHIA</span><h3>Xem trước đoạn tri thức</h3></div><Layers3 /></div>
          <div className="knowledge-chunks">{latest.chunks.slice(0, 4).map((chunk) => <article key={chunk.id}><span>Đoạn {chunk.chunkIndex + 1}</span><p>{chunk.content}</p></article>)}</div>
        </section>}
      </div>
      {editing && <footer><button type="button" onClick={() => setEditing(false)}>Hủy</button><button disabled={saving}>{saving ? <RefreshCw className="spin" /> : <Check />}{saving ? "Đang lưu" : "Lưu thay đổi"}</button></footer>}
    </form></aside>
    {versionOpen && <UploadVersionDialog document={document} onClose={() => setVersionOpen(false)} onUploaded={async () => { setVersionOpen(false); await onChanged("Đã thêm và lập chỉ mục phiên bản mới"); }} />}
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><small>{label}</small><strong>{value}</strong></div>;
}

function UploadDocumentDialog({ agentId, onClose, onUploaded }: { agentId: "ceo-ai" | "tiktok-ai" | "etsy-ai"; onClose: () => void; onUploaded: (document: KnowledgeDocument) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    category: agentId === "tiktok-ai" ? "Quy trình TikTok" : "Chính sách",
    description: "",
    ownerDepartmentCode: agentId === "tiktok-ai" ? "SELL_TIKTOK" : "HR",
    ownerDepartmentName: agentId === "tiktok-ai" ? "Sell TikTok" : "Nhân sự",
    ownerName: "",
    allowedDepartments: agentId === "tiktok-ai" ? ["SELL_TIKTOK"] : ["ALL"],
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    status: "DRAFT" as KnowledgeDocumentStatus,
    sourceUrl: ""
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setError("Vui lòng chọn tài liệu"); return; }
    if (!form.allowedDepartments.length) { setError("Chọn ít nhất một phòng ban được đọc"); return; }
    setSaving(true); setError(null);
    try { await onUploaded(await api.uploadKnowledgeDocument({ ...form, agentId, file })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tải tài liệu"); }
    finally { setSaving(false); }
  }

  function selectOwner(code: string) {
    const option = DEPARTMENTS.find((item) => item.code === code);
    if (option) setForm({ ...form, ownerDepartmentCode: code, ownerDepartmentName: option.name });
  }

  return <div className="knowledge-dialog-backdrop"><form className="knowledge-dialog" onSubmit={submit}>
    <header><div><span>TÀI LIỆU MỚI</span><h2>Tải lên Knowledge Hub</h2><p>Hỗ trợ PDF, DOCX, TXT, Markdown, CSV và JSON; tối đa 15 MB.</p></div><button type="button" onClick={onClose}><X /></button></header>
    {error && <div className="knowledge-inline-error"><AlertTriangle />{error}</div>}
    <label className={`knowledge-dropzone ${file ? "has-file" : ""}`}><input type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={(event) => setFile(event.target.files?.[0] || null)} /><Upload /><strong>{file ? file.name : "Chọn tài liệu từ máy"}</strong><span>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "Bấm để chọn file"}</span></label>
    <div className="knowledge-form-grid">
      <label className="wide"><span>Tên tài liệu</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ví dụ: Chính sách nghỉ phép 2026" /></label>
      <label><span>Danh mục</span><input required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
      <label><span>Trạng thái ban đầu</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as KnowledgeDocumentStatus })}><option value="DRAFT">Bản nháp</option><option value="PUBLISHED">Áp dụng ngay</option></select></label>
      <label><span>Phòng ban sở hữu</span><select value={form.ownerDepartmentCode} onChange={(event) => selectOwner(event.target.value)}>{DEPARTMENTS.filter((item) => item.code !== "ALL").map((item) => <option value={item.code} key={item.code}>{item.name}</option>)}</select></label>
      <label><span>Người chịu trách nhiệm</span><input required value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} /></label>
      <label><span>Ngày hiệu lực</span><input type="date" required value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></label>
      <label><span>Ngày hết hiệu lực</span><input type="date" min={form.effectiveFrom} value={form.effectiveTo} onChange={(event) => setForm({ ...form, effectiveTo: event.target.value })} /></label>
      <label className="wide"><span>Mô tả</span><textarea rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
    </div>
    <fieldset className="knowledge-access-field"><legend>Phòng ban được đọc</legend><div>{DEPARTMENTS.map((item) => <label key={item.code}><input type="checkbox" checked={form.allowedDepartments.includes(item.code)} onChange={() => setForm((current) => ({ ...current, allowedDepartments: current.allowedDepartments.includes(item.code) ? current.allowedDepartments.filter((code) => code !== item.code) : [...current.allowedDepartments, item.code] }))} /><span>{item.name}</span></label>)}</div></fieldset>
    <footer><button type="button" onClick={onClose}>Hủy</button><button disabled={saving}>{saving ? <RefreshCw className="spin" /> : <Upload />}{saving ? "Đang xử lý" : "Tải lên và lập chỉ mục"}</button></footer>
  </form></div>;
}

function UploadVersionDialog({ document, onClose, onUploaded }: { document: KnowledgeDocument; onClose: () => void; onUploaded: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!file) { setError("Vui lòng chọn file phiên bản mới"); return; }
    setSaving(true); setError(null);
    try { await api.uploadKnowledgeVersion(document.id, { file, effectiveFrom, effectiveTo }); await onUploaded(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể thêm phiên bản"); }
    finally { setSaving(false); }
  }
  return <div className="knowledge-dialog-backdrop nested"><form className="knowledge-dialog compact" onSubmit={submit}><header><div><span>PHIÊN BẢN v{document.currentVersionNumber + 1}</span><h2>Cập nhật tài liệu</h2><p>{document.title}</p></div><button type="button" onClick={onClose}><X /></button></header>{error && <div className="knowledge-inline-error"><AlertTriangle />{error}</div>}<label className={`knowledge-dropzone ${file ? "has-file" : ""}`}><input type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={(event) => setFile(event.target.files?.[0] || null)} /><FilePlus2 /><strong>{file?.name || "Chọn file phiên bản mới"}</strong><span>File cũ vẫn được giữ trong lịch sử</span></label><div className="knowledge-form-grid"><label><span>Ngày hiệu lực</span><input type="date" required value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></label><label><span>Ngày hết hiệu lực</span><input type="date" min={effectiveFrom} value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} /></label></div><footer><button type="button" onClick={onClose}>Hủy</button><button disabled={saving}>{saving ? <RefreshCw className="spin" /> : <Upload />}{saving ? "Đang xử lý" : "Tạo phiên bản"}</button></footer></form></div>;
}

function KnowledgeSearchDialog({ agentId, onClose, onOpenDocument }: { agentId: "ceo-ai" | "tiktok-ai" | "etsy-ai"; onClose: () => void; onOpenDocument: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!query.trim()) return;
    setLoading(true); setError(null);
    try { setResults(await api.knowledgeSearch(query.trim(), 8, agentId)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể tìm kiếm tri thức"); }
    finally { setLoading(false); }
  }
  return <div className="knowledge-dialog-backdrop"><section className="knowledge-dialog search-dialog"><header><div><span>KIỂM TRA TRUY XUẤT</span><h2>Tìm trong kho tri thức</h2><p>Kiểm tra tài liệu nào sẽ được dùng làm căn cứ trả lời.</p></div><button onClick={onClose}><X /></button></header><form className="knowledge-semantic-search" onSubmit={submit}><Search /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ví dụ: quy trình tạm ứng cần giấy tờ gì?" /><button disabled={loading}>{loading ? <RefreshCw className="spin" /> : "Tìm"}</button></form>{error && <div className="knowledge-inline-error"><AlertTriangle />{error}</div>}<div className="knowledge-search-results">{results.map((result, index) => <button key={result.chunkId} onClick={() => onOpenDocument(result.document.id)}><span className="result-rank">{index + 1}</span><div><header><strong>{result.document.title}</strong><em>{Math.round(result.score * 100)}% phù hợp</em></header><p>{result.content}</p><small>{result.document.ownerDepartmentName} · v{result.document.versionNumber} · hiệu lực {formatDate(result.document.effectiveFrom)}</small></div><ChevronRight /></button>)}{!loading && query && !results.length && <div className="knowledge-empty"><Search /><strong>Chưa tìm thấy nội dung phù hợp</strong><span>Thử diễn đạt câu hỏi theo cách khác.</span></div>}</div></section></div>;
}
