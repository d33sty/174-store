import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

function CartItemRow({ item, onQuantityChange, onRemove }) {
  const [qty, setQty] = useState(item.quantity)
  const [updating, setUpdating] = useState(false)
  const debounceRef = useRef(null)
  const { addToCount } = useCart()

  async function applyQty(newQty) {
    setUpdating(true)
    try {
      await client.put(`/cart/items/${item.product.id}`, { quantity: newQty })
      onQuantityChange(item.product.id, newQty)
    } catch {
      addToCount(item.quantity - newQty)
      setQty(item.quantity)
    } finally {
      setUpdating(false)
    }
  }

  function changeQty(delta) {
    const newQty = Math.min(item.product.stock, Math.max(1, qty + delta))
    if (newQty === qty) return
    setQty(newQty)
    addToCount(delta)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => applyQty(newQty), 350)
  }

  const lineTotal = Number(item.product.price) * qty

  return (
    <div className={`flex items-center gap-4 py-4 transition-opacity ${updating ? 'opacity-60' : ''}`}>

      {/* Фото */}
      <Link to={`/products/${item.product.id}`} className="shrink-0">
        {item.product.image_url
          ? <img src={`/api${item.product.image_url}`} alt={item.product.name} className="w-16 h-16 object-cover rounded-xl bg-gray-100" />
          : <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
              </svg>
            </div>
        }
      </Link>

      {/* Название + цена */}
      <div className="flex-1 min-w-0">
        <Link to={`/products/${item.product.id}`} className="text-sm font-medium text-gray-800 hover:text-green-600 transition-colors line-clamp-2">
          {item.product.name}
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">{Number(item.product.price).toLocaleString('ru-RU')} ₽ / шт.</p>
      </div>

      {/* Счётчик */}
      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-sm shrink-0">
        <button
          onClick={() => changeQty(-1)}
          disabled={qty <= 1 || updating}
          className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >−</button>
        <span className="px-3 py-1.5 min-w-[2.5rem] text-center text-gray-700">{qty}</span>
        <button
          onClick={() => changeQty(1)}
          disabled={qty >= item.product.stock || updating}
          className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
        >+</button>
      </div>

      {/* Итого по строке */}
      <p className="text-sm font-semibold text-gray-900 w-24 text-right shrink-0">
        {lineTotal.toLocaleString('ru-RU')} ₽
      </p>

      {/* Удалить */}
      <button
        onClick={() => onRemove(item.product.id)}
        className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        title="Удалить"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function CartPage() {
  const { user, loading } = useAuth()
  const { setCartCount } = useCart()
  const navigate = useNavigate()

  const [cart, setCart] = useState(null)
  const [loadingCart, setLoadingCart] = useState(true)

  useEffect(() => {
    if (!loading && !user) navigate('/login', { state: { from: '/cart' } })
  }, [user, loading, navigate])

  const fetchCart = useCallback(async () => {
    setLoadingCart(true)
    try {
      const { data } = await client.get('/cart/')
      setCart(data)
      setCartCount(data.total_quantity)
    } finally {
      setLoadingCart(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchCart()
  }, [user, fetchCart])

  function handleQuantityChange(productId, newQty) {
    const items = cart.items.map(i =>
      i.product.id === productId ? { ...i, quantity: newQty } : i
    )
    const totalQty = items.reduce((s, i) => s + i.quantity, 0)
    const totalPrice = items.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0)
    setCart(prev => prev ? { ...prev, items, total_quantity: totalQty, total_price: totalPrice } : prev)
    setCartCount(totalQty)
  }

  async function handleRemove(productId) {
    try {
      await client.delete(`/cart/items/${productId}`)
      const newItems = cart.items.filter(i => i.product.id !== productId)
      const totalQty = newItems.reduce((s, i) => s + i.quantity, 0)
      const totalPrice = newItems.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0)
      setCart(prev => prev ? { ...prev, items: newItems, total_quantity: totalQty, total_price: totalPrice } : prev)
      setCartCount(totalQty)
    } catch {
      fetchCart()
    }
  }


  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">

        <h1 className="text-xl font-bold text-gray-800 mb-6">Корзина</h1>

        {loadingCart ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 space-y-4 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-48 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          </div>
        ) : !cart || cart.items.length === 0 ? (
          <div className="text-center py-24">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-gray-400 mb-4">Корзина пуста</p>
            <Link to="/" className="text-green-600 hover:underline text-sm font-medium">Перейти в каталог →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Список товаров */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 px-5 divide-y divide-gray-50">
              {cart.items.map(item => (
                <CartItemRow
                  key={item.product.id}
                  item={item}
                  onQuantityChange={handleQuantityChange}
                  onRemove={handleRemove}
                />
              ))}
            </div>

            {/* Итог */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-24">
                <p className="text-sm font-semibold text-gray-700 mb-4">Итого</p>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Товары ({cart.total_quantity} шт.)</span>
                    <span>{Number(cart.total_price).toLocaleString('ru-RU')} ₽</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Доставка</span>
                    <span className="text-green-600">Бесплатно</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-3 mb-5">
                  <div className="flex justify-between font-semibold text-gray-900">
                    <span>К оплате</span>
                    <span>{Number(cart.total_price).toLocaleString('ru-RU')} ₽</span>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl text-sm font-medium transition-colors"
                >
                  Оформить заказ
                </button>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  )
}
