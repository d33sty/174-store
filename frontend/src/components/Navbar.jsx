import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

export default function Navbar() {
  const { user, logout } = useAuth()
  const { cartCount, setCartCount, refreshCart } = useCart()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) refreshCart()
    else setCartCount(0)
  }, [user])

  function handleLogout() {
    logout()
    setCartCount(0)
    navigate('/')
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Логотип */}
        <button onClick={() => navigate('/', { state: { reset: true } })} className="text-xl font-bold text-green-600 shrink-0 cursor-pointer">
          174 Store
        </button>

        {/* Навигация */}
        <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
          <button onClick={() => navigate('/', { state: { reset: true } })} className="hover:text-green-600 transition-colors cursor-pointer">Каталог</button>
          {user && (
            <Link to="/orders" className="hover:text-green-600 transition-colors">Мои заказы</Link>
          )}
          {user?.role === 'admin' && (
            <Link to="/admin" className="hover:text-green-600 transition-colors">Управление</Link>
          )}
        </nav>

        {/* Правая часть */}
        <div className="flex items-center gap-3">

          {/* Корзина */}
          <Link
            to="/cart"
            className="flex items-center gap-1.5 text-gray-600 hover:text-green-600 transition-colors text-sm"
          >
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {user && cartCount > 0 && (
                <span className="absolute -top-0 -left-5.5 min-w-[1.1rem] h-[1.1rem] bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none pointer-events-none">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline">Корзина</span>
          </Link>

          {/* Разделитель */}
          <div className="w-px h-5 bg-gray-200" />

          {/* Пользователь */}
          {user ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="text-sm text-gray-700 hover:text-green-600 transition-colors hidden sm:block"
              >
                {user.email}
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Выйти
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm text-gray-600 hover:text-green-600 transition-colors"
              >
                Войти
              </Link>
              <Link
                to="/register"
                className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Регистрация
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
