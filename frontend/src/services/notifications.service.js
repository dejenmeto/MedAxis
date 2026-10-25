import api from "./api";

const notificationsService = {
  getAll: (params = {}) => api.get("/notifications", { params }),

  getUnreadCount: () => api.get("/notifications/unread-count"),

  create: (payload) => api.post("/notifications", payload),

  markAsRead: (id) => api.patch(`/notifications/${id}/read`),

  markAllAsRead: () => api.patch("/notifications/read-all"),

  archive: (id) => api.patch(`/notifications/${id}/archive`),

  remove: (id) => api.delete(`/notifications/${id}`),
};

export default notificationsService;
