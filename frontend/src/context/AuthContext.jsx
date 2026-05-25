import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  const login = useCallback(async (email, password) => {
    const params = new URLSearchParams({ username: email, password })
    const { data } = await client.post('/users/token', params)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    const me = await client.get('/users/me')
    setUser(me.data)
    return me.data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
  }, [])

  const fetchMe = useCallback(async () => {
    if (!localStorage.getItem('access_token')) return
    setLoading(true)
    try {
      const { data } = await client.get('/users/me')
      setUser(data)
    } catch {
      logout()
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    fetchMe()
  }, [fetchMe])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchMe, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
