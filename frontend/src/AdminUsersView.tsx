import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  Check,
  ChevronRight,
  Edit3,
  KeyRound,
  LockKeyhole,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { api } from "./api";
import type {
  AccessAction,
  AccessCatalog,
  ManagedAccessGrant,
  ManagedUser,
  UserRole
} from "./types";

const ACTION_LABELS: Record<AccessAction, string> = {
  view: "Xem dashboard và dữ liệu",
  run: "Chạy capability",
  export: "Xuất báo cáo",
  approve: "Phê duyệt hành động",
  manage_members: "Quản lý thành viên",
  manage_agent: "Quản lý Agent",
  manage_data_scope: "Quản lý Data Scope",
  manage_sources: "Quản lý nguồn dữ liệu",
  view_audit: "Xem audit Agent",
  view_cost: "Xem usage và chi phí",
  manage_platform: "Quản lý nền tảng"
};

const ROLE_ACTIONS: Record<"MANAGER" | "USER", AccessAction[]> = {
  MANAGER: ["view", "run", "export", "approve", "manage_members", "view_audit", "view_cost"],
  USER: ["view", "run", "export", "view_audit", "view_cost"]
};

function roleLabel(role: UserRole) {
  return { ADMIN: "Admin", MANAGER: "Manager", USER: "User" }[role];
}

function formatTime(value?: string | null) {
  if (!value) return "Chưa đăng nhập";
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(value));
}

export function AdminUsersView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [catalog, setCatalog] = useState<AccessCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [grantDraft, setGrantDraft] = useState<ManagedAccessGrant | null | undefined>(undefined);
  const selectedId = searchParams.get("user");
  const search = searchParams.get("q") || "";
  const roleFilter = ["ALL", "ADMIN", "MANAGER", "USER"].includes(searchParams.get("role") || "")
    ? searchParams.get("role")!
    : "ALL";
  const statusFilter = ["ALL", "ACTIVE", "LOCKED", "DISABLED"].includes(searchParams.get("status") || "")
    ? searchParams.get("status")!
    : "ALL";
  const createOpen = searchParams.get("dialog") === "create";

  function updateQuery(updates: Record<string, string | null>, replace = false) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries(updates).forEach(([key, value]) => {
        if (!value || value === "ALL") next.delete(key);
        else next.set(key, value);
      });
      return next;
    }, { replace });
  }

  async function load(preferredId?: string) {
    setLoading(true);
    setError(null);
    try {
      const [userList, accessCatalog] = await Promise.all([api.adminUsers(), api.accessCatalog()]);
      setUsers(userList);
      setCatalog(accessCatalog);
      if (preferredId) updateQuery({ user: preferredId });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải danh sách người dùng");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!loading && selectedId && !users.some((user) => user.id === selectedId)) {
      updateQuery({ user: null }, true);
    }
  }, [loading, selectedId, users]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesKeyword = !keyword
        || `${user.displayName} ${user.email} ${user.role} ${user.departmentCode || ""}`.toLowerCase().includes(keyword);
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesStatus = statusFilter === "ALL" || user.status === statusFilter;
      return matchesKeyword && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);
  const selected = users.find((user) => user.id === selectedId) || null;
  const activeCount = users.filter((user) => user.status === "ACTIVE").length;
  const managerCount = users.filter((user) => user.role === "MANAGER").length;
  const userCount = users.filter((user) => user.role === "USER").length;

  async function changed(message: string, preferredId?: string) {
    setNotice(message);
    await load(preferredId || selectedId || undefined);
  }

  return <>
    <section className="admin-hero">
      <div><span><ShieldCheck /> Identity & Access</span><h2>Người dùng và phân quyền</h2><p>Tạo Manager/User, giới hạn theo Agent, capability, Data Scope và action. Mọi thay đổi được ghi audit.</p></div>
      <button onClick={() => updateQuery({ dialog: "create" })}><UserPlus /> Tạo tài khoản</button>
    </section>
    <section className="iam-summary">
      <IamStat icon={<Users />} label="Tổng tài khoản" value={users.length} detail={`${activeCount} đang hoạt động`} tone="blue" />
      <IamStat icon={<ShieldCheck />} label="Manager" value={managerCount} detail="Quản lý theo Agent" tone="cyan" />
      <IamStat icon={<UserCheck />} label="User" value={userCount} detail="Theo Agent và dữ liệu" tone="orange" />
    </section>
    {error && <div className="error-banner"><AlertTriangle /><span>{error}</span><button onClick={() => setError(null)}><X /></button></div>}
    {notice && <div className="iam-notice"><Check />{notice}<button onClick={() => setNotice(null)}><X /></button></div>}
    <section className="white-card users-table-card">
      <div className="users-table-heading"><div><span>USER DIRECTORY</span><h3>Danh sách tài khoản</h3><p>Bấm vào một dòng để xem hồ sơ, quyền Agent hoặc chuyển sang chỉnh sửa.</p></div><button onClick={() => void load()}><RefreshCw className={loading ? "spin" : ""} /></button></div>
      <div className="users-table-tools">
        <div className="user-search"><Search /><input value={search} onChange={(event) => updateQuery({ q: event.target.value }, true)} placeholder="Tìm theo tên, email, role..." /></div>
        <select value={roleFilter} onChange={(event) => updateQuery({ role: event.target.value })}><option value="ALL">Tất cả role</option><option value="ADMIN">Admin</option><option value="MANAGER">Manager</option><option value="USER">User</option></select>
        <select value={statusFilter} onChange={(event) => updateQuery({ status: event.target.value })}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="LOCKED">Đang khóa</option><option value="DISABLED">Vô hiệu hóa</option></select>
        <span>{filteredUsers.length} tài khoản</span>
      </div>
      <UsersTable users={filteredUsers} onSelect={(user) => updateQuery({ user: user.id })} />
    </section>
    {createOpen && <CreateUserDialog onClose={() => updateQuery({ dialog: null })} onCreated={async (user) => { updateQuery({ dialog: null, user: user.id }); await changed("Đã tạo tài khoản mới", user.id); }} />}
    {selected && <UserDetailDrawer user={selected} catalog={catalog} onClose={() => updateQuery({ user: null })} onChanged={changed} onEditGrant={setGrantDraft} />}
    {grantDraft !== undefined && selected && catalog && <GrantDialog user={selected} catalog={catalog} grant={grantDraft} onClose={() => setGrantDraft(undefined)} onSaved={async () => { setGrantDraft(undefined); await changed("Đã cập nhật quyền truy cập", selected.id); }} />}
  </>;
}

function IamStat({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: number; detail: string; tone: string }) {
  return <article className="iam-stat"><span className={tone}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{detail}</em></div></article>;
}

function UsersTable({ users, onSelect }: { users: ManagedUser[]; onSelect: (user: ManagedUser) => void }) {
  return <div className="users-table-wrap"><table className="users-table"><thead><tr><th>Người dùng</th><th>Role</th><th>Trạng thái</th><th>Quyền Agent</th><th>Đăng nhập cuối</th><th>Ngày tạo</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id} tabIndex={0} onClick={() => onSelect(user)} onKeyDown={(event) => { if (event.key === "Enter") onSelect(user); }}><td><div className="table-user"><span className={`user-avatar role-${user.role.toLowerCase()}`}>{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{user.email}</small></span></div></td><td><em className={`role-tag ${user.role.toLowerCase()}`}>{roleLabel(user.role)}</em></td><td><span className={`table-status ${user.status.toLowerCase()}`}><i />{user.status === "ACTIVE" ? "Hoạt động" : user.status === "LOCKED" ? "Đang khóa" : "Vô hiệu hóa"}</span></td><td><span className="grant-count"><ShieldCheck />{user.role === "ADMIN" ? "Toàn nền tảng" : `${user.grants.length} Agent`}</span></td><td>{formatTime(user.lastLoginAt)}</td><td>{formatTime(user.createdAt)}</td><td><button aria-label={`Xem ${user.displayName}`}><ChevronRight /></button></td></tr>)}</tbody></table>{!users.length && <div className="directory-empty"><Users /><span>Không tìm thấy tài khoản phù hợp</span></div>}</div>;
}

function UserDetailDrawer({ user, catalog, onClose, onChanged, onEditGrant }: { user: ManagedUser; catalog: AccessCatalog | null; onClose: () => void; onChanged: (message: string, preferredId?: string) => Promise<void>; onEditGrant: (grant: ManagedAccessGrant | null) => void }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [departmentCode, setDepartmentCode] = useState(user.departmentCode || "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [status, setStatus] = useState(user.status);
  const [password, setPassword] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(user.displayName);
    setDepartmentCode(user.departmentCode || "");
    setRole(user.role);
    setStatus(user.status);
    setPassword("");
    setEditing(false);
    setError(null);
  }, [user.id, user.displayName, user.departmentCode, user.role, user.status]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateUser(user.id, {
        displayName,
        departmentCode,
        role,
        status,
        ...(password ? { password } : {})
      });
      setPassword("");
      await onChanged("Đã cập nhật tài khoản", user.id);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật tài khoản");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(grant: ManagedAccessGrant) {
    if (!window.confirm(`Thu hồi quyền ${grant.agentId} của ${user.displayName}?`)) return;
    try {
      await api.revokeGrant(grant.id);
      await onChanged("Đã thu hồi quyền truy cập", user.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể thu hồi quyền");
    }
  }

  return <div className="user-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="user-drawer"><form onSubmit={save}><header className="drawer-header"><div><span>{editing ? "CHỈNH SỬA TÀI KHOẢN" : "CHI TIẾT TÀI KHOẢN"}</span><h2>{editing ? "Cập nhật người dùng" : user.displayName}</h2><p>{user.email}</p></div><button type="button" onClick={onClose}><X /></button></header><div className="drawer-profile"><span className={`user-avatar large role-${user.role.toLowerCase()}`}>{user.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{user.displayName}</strong><small>{roleLabel(user.role)} · {user.grants.length} Agent Grant</small></div><span className={`account-state ${user.status.toLowerCase()}`}>{user.status === "ACTIVE" ? "Đang hoạt động" : user.status === "LOCKED" ? "Đang khóa" : "Đã vô hiệu hóa"}</span></div><div className="drawer-body">{error && <div className="login-error"><AlertTriangle />{error}</div>}<section className="drawer-section"><div className="drawer-section-title"><div><span>ACCOUNT PROFILE</span><h3>Thông tin tài khoản</h3></div>{user.role !== "ADMIN" && !editing && <button type="button" onClick={() => setEditing(true)}><Edit3 /> Chỉnh sửa</button>}</div>{editing ? <div className="settings-grid"><label><span>Tên hiển thị</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label><label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="MANAGER">Manager</option><option value="USER">User</option></select></label><label><span>Trạng thái</span><select value={status} onChange={(event) => setStatus(event.target.value as ManagedUser["status"])}><option value="ACTIVE">Hoạt động</option><option value="DISABLED">Vô hiệu hóa</option></select></label><label><span>Đặt mật khẩu mới</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Bỏ trống nếu không đổi" /></label></div> : <div className="detail-fields"><DetailField label="Tên hiển thị" value={user.displayName} /><DetailField label="Email" value={user.email} /><DetailField label="Role" value={roleLabel(user.role)} /><DetailField label="Trạng thái" value={user.status === "ACTIVE" ? "Đang hoạt động" : user.status === "LOCKED" ? "Đang khóa" : "Đã vô hiệu hóa"} /><DetailField label="Lần đăng nhập cuối" value={formatTime(user.lastLoginAt)} /><DetailField label="Ngày tạo" value={formatTime(user.createdAt)} /></div>}</section>{user.role === "ADMIN" ? <div className="admin-protected"><LockKeyhole /><div><strong>Admin được bảo vệ</strong><p>Tài khoản Admin không chỉnh sửa hoặc cấp Agent Grant tại màn hình này.</p></div></div> : <section className="drawer-section grant-section"><div className="drawer-section-title"><div><span>AGENT ACCESS</span><h3>Quyền theo Agent</h3></div>{editing && <button type="button" onClick={() => onEditGrant(null)} disabled={!catalog}><Plus /> Cấp quyền</button>}</div><div className="grant-list">{user.grants.map((grant) => { const agent = catalog?.agents.find((item) => item.id === grant.agentId); return <article key={grant.id} className="grant-card"><div className="grant-agent"><span><Bot /></span><div><strong>{agent?.name || grant.agentId}</strong><small>{agent?.domain || "Agent access"}</small></div><em>{grant.expiresAt ? `Hết hạn ${formatTime(grant.expiresAt)}` : "Không hết hạn"}</em></div><div className="grant-facts"><span><small>Actions</small><strong>{grant.actions.length}</strong></span><span><small>Capabilities</small><strong>{grant.capabilityIds.length}</strong></span><span><small>Data scopes</small><strong>{grant.dataScopeIds.length}</strong></span></div>{editing && <div className="grant-actions"><button type="button" onClick={() => onEditGrant(grant)}>Chỉnh quyền</button><button type="button" className="danger" onClick={() => void revoke(grant)}><Trash2 /> Thu hồi</button></div>}</article>; })}{!user.grants.length && <div className="grant-empty"><ShieldCheck /><strong>Chưa được cấp Agent</strong><p>Tài khoản chỉ đăng nhập được, chưa thể xem hoặc chạy AI nào.</p>{editing && <button type="button" onClick={() => onEditGrant(null)}><Plus /> Cấp quyền đầu tiên</button>}</div>}</div></section>}</div>{editing && <footer className="drawer-footer"><button type="button" onClick={() => { setEditing(false); setDisplayName(user.displayName); setRole(user.role); setStatus(user.status); setPassword(""); }}>Hủy thay đổi</button><button type="submit" disabled={saving}>{saving ? <RefreshCw className="spin" /> : <Check />}{saving ? "Đang lưu..." : "Lưu thay đổi"}</button></footer>}</form></aside></div>;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div className="detail-field"><small>{label}</small><strong>{value}</strong></div>;
}

function CreateUserDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (user: ManagedUser) => Promise<void> }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentCode, setDepartmentCode] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onCreated(await api.createUser({ displayName, email, departmentCode, role, password }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo tài khoản");
    } finally {
      setSaving(false);
    }
  }

  return <div className="dialog-backdrop"><form className="iam-dialog" onSubmit={submit}><DialogHead eyebrow="NEW IDENTITY" title="Tạo Manager hoặc User" onClose={onClose} />{error && <div className="login-error"><AlertTriangle />{error}</div>}<div className="dialog-grid"><label><span>Tên hiển thị</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required autoFocus /></label><label><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label><span>Mã phòng ban</span><input value={departmentCode} onChange={(event) => setDepartmentCode(event.target.value.toUpperCase())} placeholder="HR, FINANCE, OPERATIONS..." /></label><label><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="USER">User — theo Agent và Data Scope</option><option value="MANAGER">Manager — quản lý theo Agent</option></select></label><label><span>Mật khẩu ban đầu</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required /><small>Tối thiểu 12 ký tự, có chữ hoa, chữ thường và số.</small></label></div><div className="dialog-actions"><button type="button" onClick={onClose}>Hủy</button><button className="login-submit" disabled={saving}>{saving ? <RefreshCw className="spin" /> : <UserPlus />}{saving ? "Đang tạo..." : "Tạo tài khoản"}</button></div></form></div>;
}

function GrantDialog({ user, catalog, grant, onClose, onSaved }: { user: ManagedUser; catalog: AccessCatalog; grant: ManagedAccessGrant | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const initialAgent = catalog.agents.find((item) => item.id === grant?.agentId) || catalog.agents[0];
  const [agentId, setAgentId] = useState(initialAgent?.id || "");
  const [capabilityIds, setCapabilityIds] = useState<string[]>(grant?.capabilityIds || initialAgent?.capabilities.filter((item) => item.status === "available").map((item) => item.id) || []);
  const [dataScopeIds, setDataScopeIds] = useState<string[]>(grant?.dataScopeIds || initialAgent?.dataScopes.filter((item) => !item.id.endsWith(".audit")).map((item) => item.id) || []);
  const [actions, setActions] = useState<AccessAction[]>(grant?.actions || ["view", "run"]);
  const [expiresAt, setExpiresAt] = useState(grant?.expiresAt?.slice(0, 10) || "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const agent = catalog.agents.find((item) => item.id === agentId) || initialAgent;
  const allowedActions = ROLE_ACTIONS[user.role as "MANAGER" | "USER"];

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function selectAgent(nextAgentId: string) {
    const nextAgent = catalog.agents.find((item) => item.id === nextAgentId);
    setAgentId(nextAgentId);
    setCapabilityIds(nextAgent?.capabilities.filter((item) => item.status === "available").map((item) => item.id) || []);
    setDataScopeIds(nextAgent?.dataScopes.filter((item) => !item.id.endsWith(".audit")).map((item) => item.id) || []);
    setActions(["view", "run"]);
  }

  function applyLemiexPreset() {
    const lemiex = catalog.agents.find((item) => item.id === "lemiex-ai");
    if (!lemiex) return;
    setAgentId(lemiex.id);
    setCapabilityIds(lemiex.capabilities.filter((item) => item.status === "available").map((item) => item.id));
    setDataScopeIds(lemiex.dataScopes.filter((item) => user.role === "MANAGER" || !item.id.endsWith(".audit")).map((item) => item.id));
    setActions(user.role === "MANAGER"
      ? ["view", "run", "export", "manage_members", "view_audit"]
      : ["view", "run", "export"]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (actions.includes("run") && !capabilityIds.length) {
      setError("Quyền chạy cần ít nhất một capability");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = {
        agentId,
        capabilityIds,
        dataScopeIds,
        actions,
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59+07:00`).toISOString() : null
      };
      if (grant) await api.updateGrant(grant.id, input);
      else await api.createGrant({ ...input, userId: user.id });
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể lưu quyền truy cập");
    } finally {
      setSaving(false);
    }
  }

  return <div className="dialog-backdrop"><form className="iam-dialog grant-dialog" onSubmit={submit}><DialogHead eyebrow="AGENT ACCESS GRANT" title={`${grant ? "Chỉnh quyền" : "Cấp quyền"} cho ${user.displayName}`} onClose={onClose} />{error && <div className="login-error"><AlertTriangle />{error}</div>}<div className="grant-agent-picker"><label className="dialog-select"><span>Agent</span><select value={agentId} onChange={(event) => selectAgent(event.target.value)}>{catalog.agents.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.domain}</option>)}</select></label><button type="button" onClick={applyLemiexPreset}><Bot /> Thiết lập quyền Lemiex</button></div><PermissionGroup icon={<ShieldCheck />} title="Actions" description={`Các thao tác ${roleLabel(user.role)} được phép thực hiện.`}>{allowedActions.map((action) => <CheckOption key={action} checked={actions.includes(action)} label={ACTION_LABELS[action]} detail={action} onChange={() => toggle(actions, action, (next) => setActions(next as AccessAction[]))} />)}</PermissionGroup><PermissionGroup icon={<Bot />} title="Capabilities" description="Năng lực AI tài khoản được quyền chạy.">{agent?.capabilities.map((capability) => <CheckOption key={capability.id} checked={capabilityIds.includes(capability.id)} label={capability.name} detail={`${capability.riskLevel} · ${capability.status === "available" ? "Khả dụng" : "Đang lên kế hoạch"}`} onChange={() => toggle(capabilityIds, capability.id, setCapabilityIds)} />)}</PermissionGroup><PermissionGroup icon={<LockKeyhole />} title="Data Scopes" description="Giới hạn dữ liệu có thể xem hoặc dùng trong Agent.">{agent?.dataScopes.map((scope) => <CheckOption key={scope.id} checked={dataScopeIds.includes(scope.id)} label={scope.name} detail={scope.description || scope.id} onChange={() => toggle(dataScopeIds, scope.id, setDataScopeIds)} />)}</PermissionGroup><label className="dialog-select expiration"><span><CalendarClock /> Ngày hết hạn tùy chọn</span><input type="date" value={expiresAt} min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} onChange={(event) => setExpiresAt(event.target.value)} /></label><div className="dialog-actions"><button type="button" onClick={onClose}>Hủy</button><button className="login-submit" disabled={saving}>{saving ? <RefreshCw className="spin" /> : <ShieldCheck />}{saving ? "Đang lưu..." : "Lưu quyền truy cập"}</button></div></form></div>;
}

function PermissionGroup({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <section className="permission-group"><header><span>{icon}</span><div><strong>{title}</strong><small>{description}</small></div></header><div className="permission-options">{children}</div></section>;
}

function CheckOption({ checked, label, detail, onChange }: { checked: boolean; label: string; detail: string; onChange: () => void }) {
  return <button type="button" className={checked ? "check-option checked" : "check-option"} onClick={onChange}><span>{checked && <Check />}</span><div><strong>{label}</strong><small>{detail}</small></div></button>;
}

function DialogHead({ eyebrow, title, onClose }: { eyebrow: string; title: string; onClose: () => void }) {
  return <div className="dialog-heading"><div><span>{eyebrow}</span><h2>{title}</h2></div><button type="button" onClick={onClose}><X /></button></div>;
}
