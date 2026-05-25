import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function pluralItems(n) {
  if (n === 1) return '1 товар'
  if (n >= 2 && n <= 4) return `${n} товара`
  return `${n} товаров`
}

const PAGE_SIZE = 10

export default function OrdersPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    if (!loading && !user) navigate('/login', { state: { from: '/orders' } })
  }, [user, loading, navigate])

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true)
    try {
      const { data } = await client.get('/orders/', { params: { page, page_size: PAGE_SIZE } })
      setOrders(data.items)
      setTotal(data.total)
    } finally {
      setLoadingOrders(false)
    }
  }, [page])

  useEffect(() => {
    if (user) fetchOrders()
  }, [user, fetchOrders])

  if (loading || !user) return null

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">

        <h1 className="text-xl font-bold text-gray-800 mb-6">Мои заказы</h1>

        {loadingOrders ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="h-4 bg-gray-100 rounded w-28" />
                  <div className="h-4 bg-gray-100 rounded w-20" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-40" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400 mb-4">Заказов пока нет</p>
            <Link to="/" className="text-green-600 hover:underline text-sm font-medium">Перейти в каталог →</Link>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {orders.map(order => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="block bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-sm hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-semibold text-gray-800 shrink-0">Заказ #{order.id}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">
                      {Number(order.total_amount).toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                    <span>
                      {new Date(order.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                    <span>{pluralItems(order.items.length)}</span>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <button
                  onClick={() => setPage(p => p - 1)}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >←</button>
                <span className="px-4 py-2 text-sm text-gray-600">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page === totalPages}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors"
                >→</button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
