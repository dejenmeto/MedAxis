import api from "./api";

const BASE_URL = "/calendar";

const calendarService = {
  async getEvents(params = {}) {
    const response = await api.get(BASE_URL, { params });
    return response.data;
  },

  async createEvent(payload) {
    const response = await api.post(BASE_URL, payload);
    return response.data;
  },

  async updateEvent(id, payload) {
    const response = await api.patch(`${BASE_URL}/${id}`, payload);
    return response.data;
  },

  async cancelEvent(id) {
    const response = await api.delete(`${BASE_URL}/${id}`);
    return response.data;
  },
};

export default calendarService;
