import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Navbar from '../components/Navbar'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

const SORT_OPTIONS = [
  { value: 'rating_desc', label: 'Сначала популярные' },
  { value: 'price_asc', label: 'Цена: по возрастанию' },
  { value: 'price_desc', label: 'Цена: по убыванию' },
  { value: 'created_at_desc', label: 'Новинки' },
]

function parseSortValue(value) {
  if (!value) return {}
  const lastUnderscore = value.lastIndexOf('_')
  return {
    sort_by: value.substring(0, lastUnderscore),
    order: value.substring(lastUnderscore + 1),
  }
}

function ProductCard({ product }) {
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const { user } = useAuth()
  const { addToCount } = useCart()
  const navigate = useNavigate()

  async function handleAddToCart() {
    if (!user) { navigate('/login'); return }
    setAdding(true)
    try {
      await client.post('/cart/items', { product_id: product.id, quantity: qty })
      addToCount(qty)
      setAdded(true)
      setTimeout(() => setAdded(false), 1500)
    } finally {
      setAdding(false)
    }
  }

  const rating = Math.round(Number(product.rating))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col">

      {/* Кликабельная часть — фото и название */}
      <Link to={`/products/${product.id}`} className="flex flex-col flex-1">
        <div className="aspect-square bg-gray-50 overflow-hidden">
          {product.image_url ? (
            <img
              src={`/api${product.image_url}`}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        <div className="px-4 pt-4 pb-2 flex-1">
          <p className="text-sm text-gray-700 leading-snug line-clamp-2 min-h-[2.5rem]">{product.name}</p>
        </div>
      </Link>

      {/* Нижний блок — рейтинг, цена, корзина */}
      <div className="px-4 pb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-yellow-400 text-xs">
            {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
            <span className="text-gray-400 ml-1">{Number(product.rating).toFixed(1)}</span>
          </div>
          <span className="text-base font-semibold text-gray-900">
            {Number(product.price).toLocaleString('ru-RU')} ₽
          </span>
        </div>

        {product.stock === 0 ? (
          <p className="text-xs text-red-400 text-center">Нет в наличии</p>
        ) : (
          <div className="flex items-center gap-2">
            {/* Счётчик количества */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-sm">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
              >−</button>
              <span className="px-2 py-1.5 min-w-[2rem] text-center text-gray-700">{qty}</span>
              <button
                onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                className="px-2.5 py-1.5 text-gray-500 hover:bg-gray-50 transition-colors"
              >+</button>
            </div>
            {/* Кнопка добавления */}
            <button
              onClick={handleAddToCart}
              disabled={adding}
              className={`flex-1 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                added
                  ? 'bg-green-100 text-green-700'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {added ? 'Добавлено ✓' : adding ? '...' : 'В корзину'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CatalogPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sort, setSort] = useState('rating_desc')
  const [page, setPage] = useState(1)
  const initialLoadDone = useRef(false)

  useEffect(() => {
    if (location.state?.reset) {
      setSearchInput('')
      setSearch('')
      setCategoryId('')
      setSort('rating_desc')
      setPage(1)
      navigate('/', { replace: true, state: {} })
    }
  }, [location.state, navigate])

  const PAGE_SIZE = 8

  useEffect(() => {
    client.get('/categories/').then(r => setCategories(r.data))
  }, [])

  const fetchProducts = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true)
    else setFetching(true)
    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
        ...(categoryId && { category_id: categoryId }),
        ...(search && { search }),
        ...parseSortValue(sort),
      }
      const { data } = await client.get('/products/', { params })
      setProducts(data.items)
      setTotal(data.total)
    } finally {
      initialLoadDone.current = true
      setLoading(false)
      setFetching(false)
    }
  }, [page, categoryId, search, sort])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  function handleSearch(e) {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  function handleCategory(id) {
    setCategoryId(id)
    setPage(1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50 page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">

        {/* Поиск + сортировка */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Поиск товаров..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            />
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl text-sm transition-colors"
            >
              Найти
            </button>
          </form>
          <label className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2.5 bg-white focus-within:ring-2 focus-within:ring-green-500">
            <span className="text-xs text-gray-400 whitespace-nowrap">Сортировка</span>
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1) }}
              className="text-sm bg-transparent focus:outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex gap-6">

          {/* Сайдбар категорий */}
          <aside className="hidden md:block w-52 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Категории</p>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => handleCategory('')}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      categoryId === '' ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    Все товары
                  </button>
                </li>
                {categories
                  .filter(c => !c.parent_id)
                  .map(parent => {
                    const children = categories.filter(c => c.parent_id === parent.id)
                    return (
                      <li key={parent.id}>
                        <button
                          onClick={() => handleCategory(String(parent.id))}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                            categoryId === String(parent.id) ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {parent.name}
                        </button>
                        {children.length > 0 && (
                          <ul className="mt-0.5 space-y-0.5">
                            {children.map(child => (
                              <li key={child.id}>
                                <button
                                  onClick={() => handleCategory(String(child.id))}
                                  className={`w-full text-left pl-6 pr-3 py-1.5 rounded-lg text-sm transition-colors ${
                                    categoryId === String(child.id) ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  {child.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
              </ul>
            </div>
          </aside>

          {/* Сетка товаров */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                    <div className="aspect-square bg-gray-100" />
                    <div className="p-4 space-y-2">
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 && !fetching ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg">Товары не найдены</p>
                {search && <p className="text-sm mt-1">Попробуйте изменить запрос</p>}
              </div>
            ) : (
              <div className={`transition-opacity duration-150 ${fetching ? 'opacity-50' : 'opacity-100'}`}>
                <p className="text-sm text-gray-400 mb-4">{total} {total === 1 ? 'товар' : 'товаров'}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {products.map(p => <ProductCard key={p.id} product={p} />)}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-1 mt-8">
                    <button
                      onClick={() => setPage(p => p - 1)}
                      disabled={page === 1}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      ←
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .reduce((acc, p, i, arr) => {
                        if (i > 0 && p - arr[i - 1] > 1) acc.push('...')
                        acc.push(p)
                        return acc
                      }, [])
                      .map((p, i) =>
                        p === '...'
                          ? <span key={`dots-${i}`} className="px-2 py-2 text-sm text-gray-400">…</span>
                          : <button
                              key={p}
                              onClick={() => setPage(p)}
                              className={`w-9 h-9 rounded-xl text-sm transition-colors ${
                                p === page
                                  ? 'bg-green-600 text-white font-medium'
                                  : 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                              }`}
                            >
                              {p}
                            </button>
                      )}
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page === totalPages}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white hover:bg-gray-50 disabled:opacity-40 transition-colors"
                    >
                      →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
