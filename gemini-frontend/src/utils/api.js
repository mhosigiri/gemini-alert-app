import axios from 'axios';
import { auth } from '../firebase';
// Base API URL
const BASE_URL = process.env.VUE_APP_API_BASE_URL || 'http://localhost:5001';
// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});
// Interceptor to add auth token to requests
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  } catch (error) {
    return config;
  }
});
export const askGemini = async (question) => {
  try {
    const response = await api.post('/ask', { question });
    return response.data.response;
  } catch (error) {
    throw error;
  }
};
export const getUserProfile = async () => {
  try {
    const response = await api.get('/user/profile');
    return response.data.profile;
  } catch (error) {
    throw error;
  }
};
export default api; 