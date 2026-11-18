export type NotificationTone = "success" | "error" | "info";

export interface AppNotification {
  id: string;
  tone: NotificationTone;
  title: string;
  message: string;
  duration: number;
}

const EVENT_NAME = "feline:notification";

function emit(tone: NotificationTone, message: string, title: string, duration = 4500) {
  window.dispatchEvent(new CustomEvent<AppNotification>(EVENT_NAME, {
    detail: {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tone,
      title,
      message,
      duration
    }
  }));
}

export function notifySuccess(message: string, title = "Thành công") {
  emit("success", message, title);
}

export function notifyError(message: string, title = "Không thể thực hiện") {
  emit("error", message, title, 6000);
}

export function notifyInfo(message: string, title = "Thông báo") {
  emit("info", message, title);
}

export const notificationEventName = EVENT_NAME;
