import api from "./api";

const BASE_URL = "/nursing";

function createResource(resourcePath) {
  return {
    list(params = {}) {
      return api.get(`${BASE_URL}/${resourcePath}`, { params });
    },

    getById(id) {
      return api.get(`${BASE_URL}/${resourcePath}/${id}`);
    },

    create(data) {
      return api.post(`${BASE_URL}/${resourcePath}`, data);
    },

    update(id, data) {
      return api.put(`${BASE_URL}/${resourcePath}/${id}`, data);
    },

    remove(id) {
      return api.delete(`${BASE_URL}/${resourcePath}/${id}`);
    },
  };
}

const nursingService = {
  assessments: createResource("assessments"),
  carePlans: createResource("care-plans"),
  observations: createResource("observations"),
};

export default nursingService;
