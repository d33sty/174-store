import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'


export default function ProfilePage() {
  const { user, loading, setUser, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && !user) navigate('/login', { state: { from: '/profile' } })
  }, [user, loading, navigate])

  // Display name form
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState('')
  const [nameError, setNameError] = useState('')

  // Email form
  const [email, setEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailError, setEmailError] = useState('')

  // Password form
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setDisplayName(user.display_name ?? '')
    }
  }, [user])

  async function handleNameSave(e) {
    e.preventDefault()
    setNameError('')
    setNameSuccess('')
    setSavingName(true)
    try {
      const updated = await client.put('/users/me', { display_name: displayName.trim() || null })
      setUser(updated.data)
      setNameSuccess('Имя сохранено')
    } catch {
      setNameError('Не удалось сохранить имя')
    } finally {
      setSavingName(false)
    }
  }

  async function handleEmailSave(e) {
    e.preventDefault()
    setEmailError('')
    setEmailSuccess('')
    if (email.trim() === user.email) {
      setEmailError('Новый email совпадает с текущим')
      return
    }
    setSavingEmail(true)
    try {
      await client.put('/users/me', { email: email.trim() })
      // Токен привязан к старому email — после смены он становится недействительным
      logout()
      navigate('/login', { state: { message: 'Email изменён. Войдите с новым адресом.' } })
    } catch (err) {
      if (err.response?.status === 409) setEmailError('Этот email уже используется')
      else if (err.response?.status === 422) setEmailError('Некорректный email')
      else setEmailError('Не удалось сохранить изменения')
    } finally {
      setSavingEmail(false)
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    if (password !== confirmPassword) {
      setPasswordError('Пароли не совпадают')
      return
    }
    setSavingPassword(true)
    try {
      const updated = await client.put('/users/me', { password })
      setUser(updated.data)
      setPassword('')
      setConfirmPassword('')
      setPasswordSuccess('Пароль успешно изменён')
    } catch (err) {
      if (err.response?.status === 422) setPasswordError('Пароль должен содержать минимум 8 символов')
      else setPasswordError('Не удалось сохранить изменения')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50 page-enter">
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-8">

        <h1 className="text-xl font-bold text-gray-800 mb-6">Профиль</h1>

        {/* Информация об аккаунте */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-lg shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">{user.email}</p>
              <p className="text-xs text-gray-400 mt-0.5">Номер профиля: #{user.id}</p>
            </div>
          </div>
        </div>

        {/* Отображаемое имя */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Отображаемое имя</h2>
          <p className="text-xs text-gray-400 mb-4">Показывается в отзывах и ответах вместо номера профиля.</p>
          <form onSubmit={handleNameSave} className="flex flex-col gap-3">
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={50}
              placeholder="Например: Алексей"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {nameError && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{nameError}</p>
            )}
            {nameSuccess && (
              <p className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{nameSuccess}</p>
            )}
            <button
              type="submit"
              disabled={savingName}
              className="self-end bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {savingName ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>
        </div>

        {/* Смена email */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Изменить email</h2>
          <form onSubmit={handleEmailSave} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {emailError && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{emailError}</p>
            )}
            {emailSuccess && (
              <p className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{emailSuccess}</p>
            )}
            <p className="text-xs text-gray-400">После смены email потребуется войти заново.</p>
            <button
              type="submit"
              disabled={savingEmail}
              className="self-end bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {savingEmail ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>
        </div>

        {/* Смена пароля */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Изменить пароль</h2>
          <form onSubmit={handlePasswordSave} className="flex flex-col gap-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Новый пароль (минимум 8 символов)"
              autoComplete="new-password"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="Повторите новый пароль"
              autoComplete="new-password"
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            {passwordError && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-xs text-green-600 bg-green-50 border border-green-100 rounded-lg px-3 py-2">{passwordSuccess}</p>
            )}
            <button
              type="submit"
              disabled={savingPassword}
              className="self-end bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {savingPassword ? 'Сохранение...' : 'Сохранить'}
            </button>
          </form>
        </div>

      </main>
    </div>
  )
}
