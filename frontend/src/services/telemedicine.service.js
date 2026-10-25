import api from "./api";

const telemedicineService = {
  getDashboard: async () => {
    const response = await api.get("/telemedicine/dashboard");
    return response.data;
  },

  getConsultations: async (params = {}) => {
    const response = await api.get("/telemedicine/consultations", {
      params,
    });
    return response.data;
  },

  createConsultation: async (payload) => {
    const response = await api.post("/telemedicine/consultations", payload);
    return response.data;
  },

  updateConsultation: async (id, payload) => {
    const response = await api.put(
      `/telemedicine/consultations/${id}`,
      payload,
    );
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await api.patch(
      `/telemedicine/consultations/${id}/status`,
      { status },
    );
    return response.data;
  },
};

export default telemedicineService;
