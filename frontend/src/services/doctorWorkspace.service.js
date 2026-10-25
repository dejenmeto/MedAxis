import api from "./api";

const doctorWorkspaceService = {
  getWorkspace: async () => {
    const response = await api.get("/doctor-workspace");
    return response.data;
  },

  createTask: async (data) => {
    const response = await api.post("/doctor-workspace/tasks", data);
    return response.data;
  },

  updateTaskStatus: async (id, status) => {
    const response = await api.patch(`/doctor-workspace/tasks/${id}/status`, {
      status,
    });
    return response.data;
  },

  createClinicalNote: async (data) => {
    const response = await api.post("/doctor-workspace/notes", data);
    return response.data;
  },
};

export default doctorWorkspaceService;
