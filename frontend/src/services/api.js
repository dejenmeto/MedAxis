import axios from "axios";

const baseURL = (
  import.meta.env.VITE_API_URL || "http://localhost:3000/api"
).replace(/\/+$/, "");

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

const ACCESS_TOKEN_KEY = "medaxis_access_token";
const REFRESH_TOKEN_KEY = "medaxis_refresh_token";

let refreshPromise = null;

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url || "";

    const isAuthRequest =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/logout");

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthRequest
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

          if (!refreshToken) {
            throw new Error("No refresh token is available.");
          }

          const response = await refreshClient.post("/auth/refresh", {
            refreshToken,
          });

          const data = response.data?.data ?? response.data;
          const newAccessToken = data?.accessToken;
          const newRefreshToken = data?.refreshToken;

          if (!newAccessToken || !newRefreshToken) {
            throw new Error("Refresh response did not include both tokens.");
          }

          localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
          localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);

          if (data.activeHospitalId) {
            localStorage.setItem(
              "medaxis_hospital_id",
              String(data.activeHospitalId),
            );
          }

          return newAccessToken;
        })().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;

      return api(originalRequest);
    } catch (refreshError) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem("medaxis_user");
      localStorage.removeItem("medaxis_hospital_id");

      if (typeof window !== "undefined") {
        window.location.assign("/login");
      }

      return Promise.reject(refreshError);
    }
  },
);

// just for the upload document only

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

// just for the upload document only
export default api;
