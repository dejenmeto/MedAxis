import api from "./api";

const documentsService = {
  getDocuments: async (params = {}) => {
    const response = await api.get("/documents", { params });
    return response.data;
  },

  uploadDocument(formData) {
    return api.post("/documents", formData);
  },

  updateDocument: async (id, payload) => {
    const response = await api.patch(`/documents/${id}`, payload);
    return response.data;
  },

  archiveDocument: async (id) => {
    const response = await api.patch(`/documents/${id}/archive`);
    return response.data;
  },

  downloadDocument: async (id, filename) => {
    const response = await api.get(`/documents/${id}/download`, {
      responseType: "blob",
    });

    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename || "medical-document";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  },
};

export default documentsService;
