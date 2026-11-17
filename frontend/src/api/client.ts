import axios from 'axios'

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || '') + '/api/v1',
  timeout: 30_000,
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.response?.data?.message || err.message
    return Promise.reject(new Error(msg))
  },
)

export default api
