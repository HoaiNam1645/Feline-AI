import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, ClipboardList, FileText, RefreshCw, X } from "lucide-react";
import { api } from "./api";
import type { AppInboxNotification, NotificationCategory } from "./types";

type Filter = "ALL" | NotificationCategory;

export function NotificationBell({ onNavigate }: { onNavigate: (route: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppInboxNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCount() {
    try {
      const result = await api.notificationUnreadCount();
      setUnread(result.unread);
    } catch {
      // The bell stays unobtrusive when a background refresh fails.
    }
  }

  async function loadList() {
    setLoading(true);
    setError("");
    try {
      const result = await api.notifications(40);
      setItems(result.items);
      setUnread(result.unread);
    } catch {
      setError("Không thể tải thông báo. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCount();
    const timer = window.setInterval(() => void loadCount(), 30_000);
    const refresh = () => void loadCount();
    window.addEventListener("feline:notifications-refresh", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("feline:notifications-refresh", refresh);
    };
  }, []);

  useEffect(() => {
    if (open) void loadList();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const visible = useMemo(() => filter === "ALL" ? items : items.filter((item) => item.category === filter), [filter, items]);

  function togglePanel() {
    if (!open && !items.length) setLoading(true);
    setOpen((value) => !value);
  }

  async function openNotification(item: AppInboxNotification) {
    if (!item.readAt) {
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnread((value) => Math.max(0, value - 1));
      try { await api.readNotification(item.id); } catch { void loadCount(); }
    }
    setOpen(false);
    onNavigate(item.route);
  }

  async function readAll() {
    if (!unread) return;
    const previousItems = items;
    const previousUnread = unread;
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || readAt })));
    setUnread(0);
    try {
      await api.readAllNotifications();
    } catch {
      setItems(previousItems);
      setUnread(previousUnread);
      setError("Chưa thể đánh dấu tất cả đã đọc.");
    }
  }

  return <div className="notification-center" ref={rootRef}>
    <button
      type="button"
      className={`notification-trigger ${open ? "active" : ""}`}
      aria-label={unread ? `${unread} thông báo chưa đọc` : "Thông báo"}
      aria-expanded={open}
      onClick={togglePanel}
    >
      <Bell />
      {unread > 0 && <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>}
    </button>

    {open && <>
      <button className="notification-mobile-backdrop" aria-label="Đóng thông báo" onClick={() => setOpen(false)} />
      <section className="notification-panel" aria-label="Trung tâm thông báo">
        <header className="notification-panel-header">
          <div><h2>Thông báo</h2><span>{unread ? `${unread} chưa đọc` : "Bạn đã xem hết"}</span></div>
          <div className="notification-panel-actions">
            <button type="button" className="notification-read-all" onClick={() => void readAll()} disabled={!unread}><CheckCheck /><span>Đọc tất cả</span></button>
            <button type="button" className="notification-close" onClick={() => setOpen(false)} aria-label="Đóng"><X /></button>
          </div>
        </header>

        <nav className="notification-filters" aria-label="Lọc thông báo">
          {([{"id":"ALL","label":"Tất cả"},{"id":"TASK","label":"Công việc"},{"id":"REPORT","label":"Báo cáo"}] as Array<{ id: Filter; label: string }>).map((tab) =>
            <button type="button" key={tab.id} className={filter === tab.id ? "active" : ""} onClick={() => setFilter(tab.id)}>{tab.label}</button>)}
        </nav>

        <div className="notification-list">
          {loading && !items.length && <div className="notification-state"><RefreshCw className="spin" /><span>Đang tải thông báo...</span></div>}
          {error && <div className="notification-state error"><span>{error}</span><button type="button" onClick={() => void loadList()}>Thử lại</button></div>}
          {!loading && !error && !visible.length && <div className="notification-state"><Bell /><strong>Chưa có thông báo</strong><span>Cập nhật liên quan đến công việc và báo cáo sẽ xuất hiện tại đây.</span></div>}
          {visible.map((item) => <button type="button" className={`notification-item ${item.readAt ? "" : "unread"}`} key={item.id} onClick={() => void openNotification(item)}>
            <span className={`notification-symbol ${item.category.toLowerCase()}`}>{item.category === "TASK" ? <ClipboardList /> : <FileText />}</span>
            <span className="notification-copy"><span className="notification-item-heading"><strong>{item.title}</strong>{!item.readAt && <i aria-label="Chưa đọc" />}</span><span>{item.message}</span><small>{relativeTime(item.createdAt)}</small></span>
          </button>)}
        </div>
      </section>
    </>}
  </div>;
}

function relativeTime(value: string) {
  const diff = new Date(value).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });
  const minutes = Math.round(diff / 60_000);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(diff / 3_600_000);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  const days = Math.round(diff / 86_400_000);
  if (Math.abs(days) < 7) return formatter.format(days, "day");
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}
