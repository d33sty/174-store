import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import CDEKWidget from '@cdek-it/widget'
import Navbar from '../components/Navbar'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

function openCdekWidget(containerId, onChoose) {
  new CDEKWidget({
    from: 'Челябинск',
    defaultLocation: 'Челябинск',
    root: containerId,
    apiKey: import.meta.env.VITE_YANDEX_MAPS_API_KEY,
    servicePath: '/api/delivery/cdek/proxy',
    onChoose(delivery) {
      if (delivery.type === 'pickup' && delivery.point) {
        onChoose({
          code: delivery.point.code,
          address: delivery.point.address_full || delivery.point.address,
        })
      }
    },
  })
}

export default function CheckoutPage() {
  const { user, loading } = useAuth()
  const { setCartCount } = useCart()
  const navigate = useNavigate()

  const [cart, setCart] = useState(null)
  const [loadingCart, setLoadingCart] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const [form, setForm] = useState({ fullName: '', phone: '', comment: '' })
  const [errors, setErrors] = useState({})

  const [deliveryCdek, setDeliveryCdek] = useState(false)
  const [pvz, setPvz] = useState(null)
  const [widgetOpen, setWidgetOpen] = useState(false)
  const widgetContainerId = 'cdek-widget-container'

  useEffect(() => {
    if (!loading && !user) navigate('/login', { state: { from: '/checkout' } })
  }, [user, loading, navigate])

  const fetchCart = useCallback(async () => {
    setLoadingCart(true)
    try {
      const { data } = await client.get('/cart/')
      if (!data.items?.length) { navigate('/cart'); return }
      setCart(data)
    } finally {
      setLoadingCart(false)
    }
  }, [navigate])

  useEffect(() => {
    if (user) fetchCart()
  }, [user, fetchCart])

  function set(field) {
    return e => {
      setForm(prev => ({ ...prev, [field]: e.target.value }))
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  function validate() {
    const e = {}
    if (!form.fullName.trim()) e.fullName = 'Введите ФИО'
    if (!form.phone.trim()) e.phone = 'Введите номер телефона'
    else if (!/^[\d\s+\-()]{7,}$/.test(form.phone.trim())) e.phone = 'Некорректный номер'
    if (deliveryCdek && !pvz) e.pvz = 'Выберите пункт выдачи'
    return e
  }

  function handleOpenWidget() {
    setWidgetOpen(true)
    setTimeout(() => openCdekWidget(widgetContainerId, (selected) => {
      setPvz(selected)
      setWidgetOpen(false)
    }), 50)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const e_ = validate()
    if (Object.keys(e_).length) { setErrors(e_); return }

    setSubmitError('')
    setSubmitting(true)
    try {
      const body = deliveryCdek && pvz
        ? { delivery_type: 'cdek', delivery_pvz_code: pvz.code, delivery_address: pvz.address }
        : {}
      const { data } = await client.post('/orders/checkout', body)
      setCartCount(0)
      if (data.confirmation_url) {
        window.location.href = data.confirmation_url
      } else {
        navigate(`/orders/${data.order.id}`)
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      setSubmitError(typeof detail === 'string' ? detail : 'Не удалось оформить заказ. Попробуйте позже')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user) return null

  return (
    <div className="min-h-screen bg-gray-50 page-enter">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">

        <div className="flex items-center gap-3 mb-6">
          <Link to="/cart" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Корзина
          </Link>
          <span className="text-gray-200">/</span>
          <h1 className="text-xl font-bold text-gray-800">Оформление заказа</h1>
        </div>

        {loadingCart ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pulse">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
            </div>
            <div className="h-64 bg-white rounded-2xl border border-gray-100" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              <div className="lg:col-span-2 space-y-4">

                {/* Получатель */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Получатель</h2>
                  <div className="space-y-3">
                    <Field label="ФИО" required value={form.fullName} onChange={set('fullName')} placeholder="Иванов Иван Иванович" error={errors.fullName} />
                    <Field label="Телефон" required type="tel" value={form.phone} onChange={set('phone')} placeholder="+7 (900) 000-00-00" error={errors.phone} />
                  </div>
                </div>

                {/* Доставка */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-4">Способ доставки</h2>

                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deliveryCdek}
                      onChange={e => { setDeliveryCdek(e.target.checked); if (!e.target.checked) setPvz(null) }}
                      className="w-4 h-4 rounded accent-green-600"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">СДЭК</span>
                      <span className="text-xs text-gray-400">— доставка до пункта выдачи</span>
                    </div>
                  </label>

                  {deliveryCdek && (
                    <div className="mt-4 space-y-3">
                      {pvz ? (
                        <div className="flex items-start justify-between gap-3 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                          <div>
                            <p className="text-xs font-medium text-green-700">Выбран пункт выдачи</p>
                            <p className="text-sm text-gray-700 mt-0.5">{pvz.address}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Код: {pvz.code}</p>
                          </div>
                          <button type="button" onClick={handleOpenWidget} className="text-xs text-green-600 hover:text-green-700 shrink-0 transition-colors">
                            Изменить
                          </button>
                        </div>
                      ) : (
                        <div>
                          <button
                            type="button"
                            onClick={handleOpenWidget}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Выбрать пункт выдачи
                          </button>
                          {errors.pvz && <p className="text-xs text-red-500 mt-1">{errors.pvz}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Комментарий */}
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h2 className="text-sm font-semibold text-gray-700 mb-3">Комментарий к заказу</h2>
                  <textarea
                    value={form.comment}
                    onChange={set('comment')}
                    rows={3}
                    maxLength={500}
                    placeholder="Особые пожелания..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                </div>
              </div>

              {/* Сводка */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-24 space-y-4">
                  <h2 className="text-sm font-semibold text-gray-700">Ваш заказ</h2>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {cart?.items.map(item => (
                      <div key={item.product.id} className="flex items-center gap-3">
                        {item.product.image_url
                          ? <img src={`/api${item.product.image_url}`} alt={item.product.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" />
                          : <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 line-clamp-1">{item.product.name}</p>
                          <p className="text-xs text-gray-400">{item.quantity} шт. × {Number(item.product.price).toLocaleString('ru-RU')} ₽</p>
                        </div>
                        <p className="text-xs font-medium text-gray-800 shrink-0">
                          {(item.quantity * Number(item.product.price)).toLocaleString('ru-RU')} ₽
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 pt-3 space-y-1.5">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Товары ({cart?.total_quantity} шт.)</span>
                      <span>{Number(cart?.total_price).toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Доставка</span>
                      <span className="text-green-600">Бесплатно</span>
                    </div>
                  </div>
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex justify-between font-semibold text-gray-900">
                      <span>К оплате</span>
                      <span>{Number(cart?.total_price).toLocaleString('ru-RU')} ₽</span>
                    </div>
                  </div>
                  {submitError && (
                    <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{submitError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors"
                  >
                    {submitting ? 'Переход к оплате...' : 'Оплатить'}
                  </button>
                  <p className="text-[11px] text-gray-400 text-center">Нажимая «Оплатить», вы соглашаетесь с условиями оферты</p>
                </div>
              </div>

            </div>
          </form>
        )}
      </main>

      {/* CDEK виджет — модальное окно */}
      {widgetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Выбор пункта выдачи СДЭК</h3>
              <button
                onClick={() => setWidgetOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div id={widgetContainerId} className="flex-1 min-h-[500px]" />
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, required, error, ...inputProps }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        {...inputProps}
        className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors ${
          error ? 'border-red-300 bg-red-50' : 'border-gray-200'
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
