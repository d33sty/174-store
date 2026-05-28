import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'

const PAGE_SIZE = 20

const EMPTY_PRODUCT = { name: '', description: '', price: '', stock: '', category_id: '' }
const EMPTY_CATEGORY = { name: '', parent_id: '' }

// ─── Иконки ────────────────────────────────────────────────────────────────
function IconEdit() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m-7 0a1 1 0 011-1h4a1 1 0 011 1H9z" />
    </svg>
  )
}

// ─── Форма товара ───────────────────────────────────────────────────────────
function ProductForm({ initial, categories, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, description: initial.description || '', price: String(initial.price), stock: String(initial.stock), category_id: String(initial.category_id) }
      : EMPTY_PRODUCT
  )
  const [image, setImage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [gallery, setGallery] = useState(initial?.images || [])
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploadingGallery, setUploadingGallery] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const data = new FormData()
      data.append('name', form.name.trim())
      data.append('price', form.price)
      data.append('stock', form.stock)
      data.append('category_id', form.category_id)
      if (form.description.trim()) data.append('description', form.description.trim())
      if (image) data.append('image', image)

      const res = initial
        ? await client.put(`/products/${initial.id}`, data)
        : await client.post('/products/', data)

      const productId = res.data.id
      let uploadedImages = [...gallery]
      for (const file of pendingFiles) {
        const fd = new FormData()
        fd.append('image', file)
        const imgRes = await client.post(`/products/${productId}/images`, fd)
        uploadedImages = [...uploadedImages, imgRes.data]
      }
      onSave({ ...res.data, images: uploadedImages })
    } catch (err) {
      if (err.response?.status === 400) setError(err.response.data?.detail || 'Ошибка валидации')
      else setError('Не удалось сохранить товар')
    } finally {
      setSaving(false)
    }
  }

  async function handleGalleryUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    if (initial) {
      setUploadingGallery(true)
      try {
        const data = new FormData()
        data.append('image', file)
        const res = await client.post(`/products/${initial.id}/images`, data)
        setGallery(prev => [...prev, res.data])
      } catch {
        setError('Не удалось загрузить фото галереи')
      } finally {
        setUploadingGallery(false)
      }
    } else {
      setPendingFiles(prev => [...prev, file])
    }
  }

  async function handleGalleryDelete(imageId) {
    try {
      await client.delete(`/products/${initial.id}/images/${imageId}`)
      setGallery(prev => prev.filter(img => img.id !== imageId))
    } catch {
      setError('Не удалось удалить фото')
    }
  }

  const rootCategories = categories.filter(c => !c.parent_id)

  return (
    <div className="bg-white rounded-2xl border border-green-100 p-6 mb-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        {initial ? 'Редактировать товар' : 'Новый товар'}
      </h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-gray-500">Название *</label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            required minLength={3} maxLength={255}
            placeholder="Название товара"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-xs font-medium text-gray-500">Описание</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            maxLength={5000}
            rows={6}
            placeholder="Описание товара (необязательно)"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">Цена, ₽ *</label>
          <input
            type="text" inputMode="decimal"
            value={form.price}
            onChange={e => set('price', e.target.value)}
            required placeholder="0.00"
            pattern="^\d+(\.\d{1,2})?$"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">Остаток, шт. *</label>
          <input
            type="number" min="0" step="1"
            value={form.stock}
            onChange={e => set('stock', e.target.value)}
            required placeholder="0"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">Категория *</label>
          <select
            value={form.category_id}
            onChange={e => set('category_id', e.target.value)}
            required
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">Выберите категорию</option>
            {rootCategories.map(parent => {
              const children = categories.filter(c => c.parent_id === parent.id)
              return children.length > 0 ? (
                <optgroup key={parent.id} label={parent.name}>
                  {children.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              ) : (
                <option key={parent.id} value={parent.id}>{parent.name}</option>
              )
            })}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">Главное фото</label>
          {initial?.image_url && !image && (
            <img src={`/api${initial.image_url}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
          )}
          {image && (
            <img src={URL.createObjectURL(image)} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
          )}
          <input
            type="file" accept="image/jpeg,image/png,image/webp"
            onChange={e => setImage(e.target.files[0] || null)}
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200 cursor-pointer"
          />
          <p className="text-xs text-gray-400">JPG, PNG или WebP · до 2 МБ · рекомендуется квадрат 1:1</p>
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <label className="text-xs font-medium text-gray-500">Галерея</label>
          <div className="flex flex-wrap gap-2">
            {gallery.map(img => (
              <div key={img.id} className="relative group w-16 h-16">
                <img src={`/api${img.image_url}`} className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                <button
                  type="button"
                  onClick={() => handleGalleryDelete(img.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex"
                >×</button>
              </div>
            ))}
            {pendingFiles.map((file, i) => (
              <div key={i} className="relative group w-16 h-16">
                <img src={URL.createObjectURL(file)} className="w-16 h-16 object-cover rounded-lg border border-gray-200 opacity-70" />
                <button
                  type="button"
                  onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs items-center justify-center hidden group-hover:flex"
                >×</button>
              </div>
            ))}
            <label className={`w-16 h-16 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:border-green-400 transition-colors ${uploadingGallery ? 'opacity-50' : ''}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleGalleryUpload} disabled={uploadingGallery} />
              <span className="text-2xl text-gray-300">+</span>
            </label>
          </div>
          <p className="text-xs text-gray-400">Наведите на фото чтобы удалить</p>
        </div>

        {error && (
          <p className="sm:col-span-2 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="sm:col-span-2 flex gap-2 justify-end">
          <button
            type="button" onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit" disabled={saving}
            className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Форма категории ────────────────────────────────────────────────────────
function CategoryForm({ initial, categories, onSave, onCancel }) {
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, parent_id: initial.parent_id ? String(initial.parent_id) : '' }
      : EMPTY_CATEGORY
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const body = { name: form.name.trim(), parent_id: form.parent_id ? Number(form.parent_id) : null }
      const res = initial
        ? await client.put(`/categories/${initial.id}`, body)
        : await client.post('/categories/', body)
      onSave(res.data)
    } catch (err) {
      if (err.response?.status === 400) setError(err.response.data?.detail || 'Ошибка валидации')
      else setError('Не удалось сохранить категорию')
    } finally {
      setSaving(false)
    }
  }

  const rootCandidates = categories.filter(c => !c.parent_id && c.id !== initial?.id)

  return (
    <div className="bg-white rounded-2xl border border-green-100 p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        {initial ? 'Редактировать категорию' : 'Новая категория'}
      </h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">Название *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required minLength={3} maxLength={50}
            placeholder="Название категории"
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">Родительская категория</label>
          <select
            value={form.parent_id}
            onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="">— Корневая категория —</option>
            {rootCandidates.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button" onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            type="submit" disabled={saving}
            className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Главная страница ───────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState('products')
  const [categories, setCategories] = useState([])

  // Products state
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showProductForm, setShowProductForm] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState(null)

  // Categories state
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [editingCategory, setEditingCategory] = useState(null)
  const [showCategoryForm, setShowCategoryForm] = useState(false)
  const [deletingCategoryId, setDeletingCategoryId] = useState(null)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) navigate('/')
  }, [user, loading, navigate])

  const fetchCategories = useCallback(async () => {
    setLoadingCategories(true)
    try {
      const { data } = await client.get('/categories/')
      setCategories(data)
    } finally {
      setLoadingCategories(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const { data } = await client.get('/products/', { params: { page, page_size: PAGE_SIZE } })
      setProducts(data.items)
      setTotal(data.total)
    } finally {
      setLoadingProducts(false)
    }
  }, [page])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { fetchProducts() }, [fetchProducts])

  // ── Products handlers ──
  function openNewProduct() {
    setEditingProduct(null)
    setShowProductForm(true)
  }

  function openEditProduct(product) {
    setEditingProduct(product)
    setShowProductForm(true)
  }

  function handleProductSaved() {
    setShowProductForm(false)
    setEditingProduct(null)
    fetchProducts()
  }

  async function handleDeleteProduct(id) {
    if (!confirm('Удалить товар?')) return
    setDeletingProductId(id)
    try {
      await client.delete(`/products/${id}`)
      fetchProducts()
    } finally {
      setDeletingProductId(null)
    }
  }

  // ── Categories handlers ──
  function openNewCategory() {
    setEditingCategory(null)
    setShowCategoryForm(true)
  }

  function openEditCategory(cat) {
    setEditingCategory(cat)
    setShowCategoryForm(true)
  }

  function handleCategorySaved() {
    setShowCategoryForm(false)
    setEditingCategory(null)
    fetchCategories()
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Удалить категорию?')) return
    setDeletingCategoryId(id)
    try {
      await client.delete(`/categories/${id}`)
      fetchCategories()
    } finally {
      setDeletingCategoryId(null)
    }
  }

  if (loading || !user) return null

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const getCategoryName = (id) => categories.find(c => c.id === id)?.name || '—'

  return (
    <div className="min-h-screen bg-gray-50 page-enter">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">

        <h1 className="text-xl font-bold text-gray-800 mb-6">Панель управления</h1>

        {/* Вкладки */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit mb-6">
          {[['products', 'Товары'], ['categories', 'Категории']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === key ? 'bg-green-600 text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── ТОВАРЫ ── */}
        {tab === 'products' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">{total} товаров</p>
              <button
                onClick={openNewProduct}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <span className="text-lg leading-none">+</span> Добавить товар
              </button>
            </div>

            {showProductForm && (
              <ProductForm
                key={editingProduct?.id ?? 'new'}
                initial={editingProduct}
                categories={categories}
                onSave={handleProductSaved}
                onCancel={() => { setShowProductForm(false); setEditingProduct(null) }}
              />
            )}

            {loadingProducts ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 bg-white rounded-xl border border-gray-100 animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">Товаров пока нет</div>
            ) : (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                        <th className="text-left px-4 py-3 w-12"></th>
                        <th className="text-left px-4 py-3">Название</th>
                        <th className="text-right px-4 py-3">Цена</th>
                        <th className="text-right px-4 py-3">Остаток</th>
                        <th className="text-left px-4 py-3 hidden md:table-cell">Категория</th>
                        <th className="px-4 py-3 w-20"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3">
                            {p.image_url
                              ? <img src={`/api${p.image_url}`} alt="" className="w-9 h-9 object-cover rounded-lg bg-gray-100" />
                              : <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01" />
                                  </svg>
                                </div>
                            }
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-gray-800 font-medium truncate max-w-[200px]">{p.name}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">
                            {Number(p.price).toLocaleString('ru-RU')} ₽
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-medium ${p.stock === 0 ? 'text-red-400' : 'text-gray-700'}`}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                            {getCategoryName(p.category_id)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditProduct(p)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                              >
                                <IconEdit />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                disabled={deletingProductId === p.id}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-6">
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
          </div>
        )}

        {/* ── КАТЕГОРИИ ── */}
        {tab === 'categories' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-400">{categories.length} категорий</p>
              <button
                onClick={openNewCategory}
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <span className="text-lg leading-none">+</span> Добавить категорию
              </button>
            </div>

            {showCategoryForm && (
              <CategoryForm
                initial={editingCategory}
                categories={categories}
                onSave={handleCategorySaved}
                onCancel={() => { setShowCategoryForm(false); setEditingCategory(null) }}
              />
            )}

            {loadingCategories ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white rounded-xl border border-gray-100 animate-pulse" />
                ))}
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">Категорий пока нет</div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <ul className="divide-y divide-gray-50">
                  {categories
                    .filter(c => !c.parent_id)
                    .map(parent => {
                      const children = categories.filter(c => c.parent_id === parent.id)
                      return (
                        <li key={parent.id}>
                          <div className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50 transition-colors">
                            <span className="text-sm font-medium text-gray-800">{parent.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditCategory(parent)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                              >
                                <IconEdit />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(parent.id)}
                                disabled={deletingCategoryId === parent.id}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                              >
                                <IconTrash />
                              </button>
                            </div>
                          </div>
                          {children.map(child => (
                            <div
                              key={child.id}
                              className="flex items-center justify-between pl-10 pr-5 py-2.5 bg-gray-50/30 border-t border-gray-50 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span className="text-gray-300">└</span>
                                {child.name}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openEditCategory(child)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                                >
                                  <IconEdit />
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(child.id)}
                                  disabled={deletingCategoryId === child.id}
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                >
                                  <IconTrash />
                                </button>
                              </div>
                            </div>
                          ))}
                        </li>
                      )
                    })}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>

    </div>
  )
}
