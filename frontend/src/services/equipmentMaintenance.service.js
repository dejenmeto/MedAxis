import api from "./api";

const base = "/equipment-maintenance";

const getData = (response) => response.data;

const equipmentMaintenanceService = {
  getEquipment: (params = {}) =>
    api.get(`${base}/equipment`, { params }).then(getData),

  createEquipment: (payload) =>
    api.post(`${base}/equipment`, payload).then(getData),

  updateEquipment: (id, payload) =>
    api.patch(`${base}/equipment/${id}`, payload).then(getData),

  deactivateEquipment: (id) =>
    api.patch(`${base}/equipment/${id}/deactivate`).then(getData),

  getOrders: (params = {}) =>
    api.get(`${base}/orders`, { params }).then(getData),

  createOrder: (payload) => api.post(`${base}/orders`, payload).then(getData),

  updateOrder: (id, payload) =>
    api.patch(`${base}/orders/${id}`, payload).then(getData),
};

export default equipmentMaintenanceService;
