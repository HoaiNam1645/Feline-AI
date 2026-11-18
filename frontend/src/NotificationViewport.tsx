import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { notificationEventName, type AppNotification } from "./notifications";
import "./notifications.css";

export function NotificationViewport() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const recent = useRef(new Map<string, number>());

  useEffect(() => {
    const receive = (event: Event) => {
      const notification = (event as CustomEvent<AppNotification>).detail;
      const key = `${notification.tone}:${notification.message}`;
      const now = Date.now();
      if (now - (recent.current.get(key) || 0) < 1500) return;
      recent.current.set(key, now);
      setItems((current) => [...current.slice(-3), notification]);
      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== notification.id));
      }, notification.duration);
    };
    window.addEventListener(notificationEventName, receive);
    return () => window.removeEventListener(notificationEventName, receive);
  }, []);

  function dismiss(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return <div className="notification-viewport" aria-live="polite" aria-atomic="false">
    {items.map((item) => {
      const Icon = item.tone === "success" ? CheckCircle2 : item.tone === "error" ? AlertTriangle : Info;
      return <article key={item.id} className={`app-notification ${item.tone}`} role={item.tone === "error" ? "alert" : "status"}>
        <span className="notification-symbol"><Icon /></span>
        <div><strong>{item.title}</strong><p>{item.message}</p></div>
        <button type="button" aria-label="Đóng thông báo" onClick={() => dismiss(item.id)}><X /></button>
        <i style={{ animationDuration: `${item.duration}ms` }} />
      </article>;
    })}
  </div>;
}
