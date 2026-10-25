import api from "./api";

const BASE_URL = "/slot-availability";

const slotAvailabilityService = {
  async getSlots(params = {}) {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  async createSlot(payload) {
    const response = await api.post(BASE_URL, payload);
    return response.data;
  },

  async updateSlot(id, payload) {
    const response = await api.patch(`${BASE_URL}/${id}`, payload);
    return response.data;
  },

  async bookSlot(id, patientId) {
    const response = await api.post(`${BASE_URL}/${id}/book`, {
      patient_id: patientId,
    });

    return response.data;
  },

  async cancelSlot(id) {
    const response = await api.patch(`${BASE_URL}/${id}/cancel`);
    return response.data;
  },
};

export default slotAvailabilityService;
