import { api } from './api';

export type AppNotification = {
  id: string;
  userId: number;
  title: string;
  message: string;
  type: string;
  orderId: number | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  success: boolean;
  items: AppNotification[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
};

export async function getNotifications(params?: {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}): Promise<NotificationListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.unreadOnly) query.set('unreadOnly', 'true');
  const qs = query.toString();
  const res = await api.get<NotificationListResponse>(`/notifications${qs ? '?' + qs : ''}`);
  return res.data;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await api.get<{ success: boolean; unreadCount: number }>('/notifications/unread-count');
  return res.data.unreadCount;
}

export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  const res = await api.patch<{ success: boolean; notification: AppNotification }>(`/notifications/${id}/read`);
  return res.data.notification;
}

export async function markAllNotificationsAsRead(): Promise<{ updatedCount: number }> {
  const res = await api.post<{ success: boolean; updatedCount: number }>('/notifications/mark-all-read');
  return res.data;
}

export async function deleteNotification(id: string): Promise<boolean> {
  const res = await api.delete<{ success: boolean }>(`/notifications/${id}`);
  return res.data.success;
}
