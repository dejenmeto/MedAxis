import api from "./api";

const communicationsService = {
  getTemplates: async () => {
    const response = await api.get("/communications/templates");
    return response.data;
  },

  saveTemplate: async (data) => {
    const response = await api.post("/communications/templates", data);
    return response.data;
  },

  deleteTemplate: async (id) => {
    const response = await api.delete(`/communications/templates/${id}`);
    return response.data;
  },

  sendMessage: async (data) => {
    const response = await api.post("/communications/send", data);
    return response.data;
  },

  getLogs: async (params = {}) => {
    const response = await api.get("/communications/logs", { params });
    return response.data;
  },

  retryMessage: async (id) => {
    const response = await api.post(`/communications/logs/${id}/retry`);
    return response.data;
  },
};

export default communicationsService;
