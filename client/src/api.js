import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api", // change to your backend URL
});

// Attach token automatically
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token"); // or however you store it
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

export default API;
