import api from "./api";

const settingsService = {
  get: () => api.get("/settings"),

  update: (settings) => api.put("/settings", { settings }),
};

export default settingsService;
