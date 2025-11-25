import axios from 'axios';

const API_BASE_URL = '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  login: (username, password) => apiClient.post('/auth/login', { username, password }),
  getAthletes: () => apiClient.post('/athletes'),
  createReport: (data) => apiClient.post('/reports', data),
  getReport: (id) => apiClient.get(`/reports/${id}`),
  generatePDF: async (data) => {
    const res = await apiClient.post('/pdf/generate', data, { responseType: 'blob' });
    return res.data;
  },
};
