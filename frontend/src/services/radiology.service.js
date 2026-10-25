import api from "./api";

const radiologyService = {
  // =========================================
  // IMAGING SERVICES
  // =========================================

  // Get imaging services with optional search and filters
  getServices: (params = {}) => api.get("/radiology/services", { params }),

  // Create a new imaging service
  createService: (serviceData) => api.post("/radiology/services", serviceData),

  // Update an existing imaging service
  updateService: (id, serviceData) =>
    api.put(`/radiology/services/${id}`, serviceData),

  // Activate or deactivate an imaging service
  setServiceActive: (id, is_active) =>
    api.patch(`/radiology/services/${id}/active`, { is_active }),

  // =========================================
  // IMAGING ORDERS
  // =========================================

  // Get imaging orders with optional filters
  getOrders: (params = {}) => api.get("/radiology/orders", { params }),

  // Get a single imaging order and its report
  getOrder: (id) => api.get(`/radiology/orders/${id}`),

  // Create a new imaging order
  createOrder: (orderData) => api.post("/radiology/orders", orderData),

  // Update an imaging order's status, schedule, or radiologist
  updateOrderStatus: (id, statusData) =>
    api.patch(`/radiology/orders/${id}/status`, statusData),

  // =========================================
  // IMAGING REPORTS
  // =========================================

  // Create or update an imaging report
  saveReport: (orderId, reportData) =>
    api.put(`/radiology/orders/${orderId}/report`, reportData),
};

export default radiologyService;
