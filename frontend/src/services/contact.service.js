import api from "./api";

const contactService = {
  // Public contact form submission
  async createMessage(payload) {
    const response = await api.post("/contact", payload);
    return response.data;
  },

  // Retrieve messages for authorized administrators
  async getMessages(params = {}) {
    const response = await api.get("/contact/admin", { params });
    return response.data;
  },

  // Retrieve message summary counts
  async getSummary(params = {}) {
    const response = await api.get("/contact/admin/summary", { params });
    return response.data;
  },

  // Update message status or internal notes
  async updateMessage(id, payload) {
    const response = await api.patch(`/contact/admin/${id}`, payload);

    return response.data;
  },
};

export default contactService;
