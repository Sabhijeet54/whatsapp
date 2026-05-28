import axios from "axios";
import { API_BASE_URL } from "./constants";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

export const endpoints = {
  login: () => api.post("/login"),
  status: () => api.get("/status"),
  logout: () => api.post("/logout"),
  parseText: (text) => api.post("/parse-text", { text }),
  upload: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return api.post("/upload", formData);
  },
  send: (payload) => api.post("/send", payload, { headers: { "Content-Type": "multipart/form-data" } }),
  pauseQueue: () => api.post("/queue/pause"),
  resumeQueue: () => api.post("/queue/resume"),
  stopQueue: () => api.post("/queue/stop"),
  getHistory: () => api.get("/history"),
  exportHistory: () => `${API_BASE_URL}/history/export`,
  getContacts: (q = "") => api.get(`/contacts?q=${encodeURIComponent(q)}`),
  importContacts: (contacts) => api.post("/contacts/import", { contacts }),
  exportContacts: () => `${API_BASE_URL}/contacts/export`,
  getTemplates: () => api.get("/templates"),
  addTemplate: (payload) => api.post("/templates", payload),
  deleteTemplate: (id) => api.delete(`/templates/${id}`),
};
