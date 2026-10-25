import api from "./api";

const ROOT = "/inventory";

const inventoryProcurementService = {
  getSummary: () => api.get(`${ROOT}/summary`),

  getCategories: () => api.get(`${ROOT}/categories`),
  createCategory: (data) => api.post(`${ROOT}/categories`, data),
  updateCategory: (id, data) => api.put(`${ROOT}/categories/${id}`, data),

  getItems: (params = {}) => api.get(`${ROOT}/items`, { params }),
  createItem: (data) => api.post(`${ROOT}/items`, data),
  updateItem: (id, data) => api.put(`${ROOT}/items/${id}`, data),
  deactivateItem: (id) => api.delete(`${ROOT}/items/${id}`),

  getSuppliers: (params = {}) => api.get(`${ROOT}/suppliers`, { params }),
  createSupplier: (data) => api.post(`${ROOT}/suppliers`, data),
  updateSupplier: (id, data) => api.put(`${ROOT}/suppliers/${id}`, data),

  getTransactions: () => api.get(`${ROOT}/transactions`),
  createTransaction: (data) => api.post(`${ROOT}/transactions`, data),

  getPurchaseOrders: (params = {}) =>
    api.get(`${ROOT}/procurement/orders`, { params }),
  createPurchaseOrder: (data) => api.post(`${ROOT}/procurement/orders`, data),
  updatePurchaseOrderStatus: (id, status) =>
    api.patch(`${ROOT}/procurement/orders/${id}/status`, { status }),

  receivePurchaseOrder: (id, data) =>
    api.post(`${ROOT}/procurement/orders/${id}/receipts`, data),

  getLowStock: () => api.get(`${ROOT}/reports/low-stock`),
  getExpiringItems: () => api.get(`${ROOT}/reports/expiring`),
};

export default inventoryProcurementService;
