import { useState, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

const STATUS_CONFIG = {
  pending:   { label: 'Ожидает оплаты', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  paid:      { label: 'Оплачен',         cls: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Отменён',         cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  failed:    { label: 'Не оплачен',      cls: 'bg-red-50 text-red-500 border-red-200' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200' }
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

export default function OrderDetailPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()

  const [order, setOrder] = useState(null)
  const [loadingOrder, setLoadingOrder] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  useEffect(() => {
    if (!loading && !user) navigate('/login', { state: { from: `/orders/${id}` } })
  }, [user, loading, navigate, id])

  useEffect(() => {
    if (!user) return
    setLoadingOrder(true)
    client.get(`/orders/${id}`)
      .then(({ data }) => setOrder(data))
      .catch(err => {
        if (err.response?.status === 404) setNotFound(true)
        else navigate('/orders')
      })
      .finally(() => setLoadingOrder(false))
  }, [user, id, navigate])

  async function handleCancel() {
    if (!confirm('Отменить заказ?')) return
    setCancelError('')
    setCancelling(true)
    try {
      const { data } = await client.post(`/orders/${id}/cancel`)
      setOrder(data)
    } catch (err) {
      const detail = err.response?.data?.detail
      setCancelError(typeof detail === 'string' ? detail : 'Не удалось отменить заказ')
    } finally {
      setCancelling(false)
    }
  }

  if (loading || !user) return null

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-24 text-center">
          <p className="text-gray-400 mb-4">Заказ не найден</p>
          <Link to="/orders" className="text-green-600 hover:underline text-sm font-medium">← Все заказы</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">

        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Все заказы
        </Link>

        {loadingOrder ? (
          <div className="space-y-4 animate-pulse">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex justify-between mb-4">
                <div className="h-5 bg-gray-100 rounded w-32" />
                <div className="h-5 bg-gray-100 rounded w-24" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : order && (
          <div className="space-y-4">

            {/* Шапка */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold text-gray-800">Заказ #{order.id}</h1>
                  <StatusBadge status={order.status} />
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(order.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            {/* Позиции заказа */}
            <div className="bg-white rounded-2xl border border-gray-100 px-5 divide-y divide-gray-50">
              {order.items.map(item => (
                <div key={item.id} className="flex items-center gap-4 py-4">
                  <Link to={`/products/${item.product_id}`} className="shrink-0">
                    {item.product?.image_url
                      ? <img
                          src={`/api${item.product.image_url}`}
                          alt={item.product?.name}
                          className="w-12 h-12 object-cover rounded-xl bg-gray-100"
                        />
                      : <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-300">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                          </svg>
                        </div>
                    }
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/products/${item.product_id}`}
                      className="text-sm font-medium text-gray-800 hover:text-green-600 transition-colors line-clamp-2"
                    >
                      {item.product?.name ?? `Товар #${item.product_id}`}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {Number(item.unit_price).toLocaleString('ru-RU')} ₽ × {item.quantity} шт.
                    </p>
                  </div>

                  <p className="text-sm font-semibold text-gray-900 shrink-0">
                    {Number(item.total_price).toLocaleString('ru-RU')} ₽
                  </p>
                </div>
              ))}
            </div>

            {/* Итог + кнопка отмены */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex justify-between items-center font-semibold text-gray-900 text-sm mb-4">
                <span>Итого</span>
                <span>{Number(order.total_amount).toLocaleString('ru-RU')} ₽</span>
              </div>

              {cancelError && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3">
                  {cancelError}
                </p>
              )}

              {order.status === 'pending' && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="w-full border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-60 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  {cancelling ? 'Отмена...' : 'Отменить заказ'}
                </button>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  )
}
