import api from "./api";

const ambulanceService = {
  getDashboard: () => api.get("/ambulance/dashboard"),

  getVehicles: () => api.get("/ambulance/vehicles"),

  createVehicle: (payload) => api.post("/ambulance/vehicles", payload),

  updateVehicle: (id, payload) => api.put(`/ambulance/vehicles/${id}`, payload),

  getDispatches: (params = {}) => api.get("/ambulance/dispatches", { params }),

  createDispatch: (payload) => api.post("/ambulance/dispatches", payload),

  updateDispatchStatus: (id, status) =>
    api.patch(`/ambulance/dispatches/${id}/status`, { status }),
};

export default ambulanceService;
