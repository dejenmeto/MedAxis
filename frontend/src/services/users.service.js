import api from "./api";

const usersService = {
  async list(params = {}) {
    const response = await api.get("/users", { params });
    return response.data;
  },

  async create(payload) {
    const response = await api.post("/users", payload);
    return response.data;
  },

  async update(id, payload) {
    const response = await api.patch(`/users/${id}`, payload);
    return response.data;
  },

  async deactivate(id) {
    const response = await api.patch(`/users/${id}/deactivate`);
    return response.data;
  },
};

export default usersService;
