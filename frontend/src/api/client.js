import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
})

// Перед каждым запросом подставляем токен из localStorage, если он есть
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Если сервер вернул 401 — токен протух, чистим хранилище
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
    return Promise.reject(error)
  }
)

export default client
