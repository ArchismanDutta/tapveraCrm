import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000"||"http://crm-be.eba-nt49vbgx.ap-south-1.elasticbeanstalk.com" , // change to your backend URL
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
