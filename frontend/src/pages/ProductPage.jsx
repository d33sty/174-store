import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-xs w-full mx-4">
        <p className="text-sm text-gray-700 text-center mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  )
}

function StarRating({ value, onChange, size = 'md' }) {
  const [hovered, setHovered] = useState(0)
  const sz = size === 'lg' ? 'text-2xl' : 'text-lg'
  return (
    <div className={`flex gap-0.5 ${sz}`}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          onMouseEnter={() => onChange && setHovered(n)}
          onMouseLeave={() => onChange && setHovered(0)}
          className={`transition-colors ${onChange ? 'cursor-pointer' : 'cursor-default'} ${
            n <= (hovered || value) ? 'text-yellow-400' : 'text-gray-200'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ReplyForm({ reviewId, parentId = null, onAdded, onCancel }) {
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!message.trim()) return
    setSaving(true)
    try {
      await client.post('/replies/', { review_id: reviewId, parent_id: parentId, message: message.trim() })
      setMessage('')
      onAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2 mt-2">
      <input
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Написать ответ..."
        maxLength={500}
        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button
        type="submit"
        disabled={saving || !message.trim()}
        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm transition-colors"
      >
        {saving ? '...' : 'Отправить'}
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-gray-600 px-2"
        >
          Отмена
        </button>
      )}
    </form>
  )
}

function ReplyRow({ reply, user, reviewId, parentName, onDelete, onUpdate, onReply, replyFormActive, onReplyAdded }) {
  const [editing, setEditing] = useState(false)
  const [editMessage, setEditMessage] = useState(reply.message)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const replyName = reply.display_name ?? `#${reply.user_id}`
  const replyAvatar = reply.display_name ? reply.display_name[0].toUpperCase() : '#'
  const isOwner = user?.id === reply.user_id
  const canDelete = isOwner || user?.role === 'admin'

  async function handleSaveEdit() {
    if (!editMessage.trim()) return
    setSaving(true)
    try {
      const { data } = await client.put(`/replies/${reply.id}/`, {
        review_id: reviewId,
        parent_id: reply.parent_id,
        message: editMessage.trim(),
      })
      onUpdate(data)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    setConfirmDelete(false)
    try {
      await client.delete(`/replies/${reply.id}/`)
      onDelete(reply.id)
    } catch {}
  }

  return (
    <div className="text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-medium shrink-0">
            {replyAvatar}
          </div>
          <span className="text-gray-600 font-medium">{replyName}</span>
          {reply.is_admin && (
            <span className="text-[10px] bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded-full leading-none">Продавец</span>
          )}
          {parentName && <span className="text-xs text-gray-400">↩ {parentName}</span>}
          <span className="text-gray-400 text-xs">{formatDate(reply.created_at)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user && !editing && (
            <button onClick={() => onReply(reply.id)} className="text-xs text-green-600 hover:text-green-700 transition-colors cursor-pointer">
              {replyFormActive ? 'Скрыть' : 'Ответить'}
            </button>
          )}
          {isOwner && !editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-green-600 transition-colors cursor-pointer">
              Изменить
            </button>
          )}
          {canDelete && (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
              Удалить
            </button>
          )}
        </div>
      </div>
      {editing ? (
        <div className="mt-1 ml-8">
          <input
            value={editMessage}
            onChange={e => setEditMessage(e.target.value)}
            maxLength={500}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <div className="flex gap-2 mt-1 justify-end">
            <button
              onClick={() => { setEditing(false); setEditMessage(reply.message) }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving || !editMessage.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs px-3 py-1 rounded-lg transition-colors"
            >
              {saving ? '...' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 ml-8 text-gray-700 break-words">{reply.message}</p>
      )}

      {replyFormActive && (
        <div className="mt-2 ml-8">
          <ReplyForm
            reviewId={reviewId}
            parentId={reply.id}
            onAdded={onReplyAdded}
            onCancel={() => onReply(reply.id)}
          />
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          message="Удалить ответ?"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

function ReviewCard({ review, user, productId, onDelete, onUpdate }) {
  const [replies, setReplies] = useState(review.replies ?? [])
  const [showReplies, setShowReplies] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [replyFormTarget, setReplyFormTarget] = useState(false) // false=скрыта, null=к отзыву, number=к ответу
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editGrade, setEditGrade] = useState(review.grade)
  const [editComment, setEditComment] = useState(review.comment ?? '')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const replyMap = Object.fromEntries(replies.map(r => [r.id, r]))
  const displayName = review.display_name ?? `#${review.user_id}`
  const avatarChar = review.display_name ? review.display_name[0].toUpperCase() : '#'
  const isOwner = user?.id === review.user_id
  const canDelete = isOwner || user?.role === 'admin'

  async function loadReplies() {
    if (loadingReplies) return
    setLoadingReplies(true)
    try {
      const { data } = await client.get(`/reviews/${review.id}/replies`)
      setReplies(data)
    } finally {
      setLoadingReplies(false)
    }
  }

  function toggleReplies() {
    if (!showReplies && replies.length === 0) loadReplies()
    setShowReplies(v => !v)
  }

  function handleMainReplyClick() {
    if (!user) { navigate('/login'); return }
    setReplyFormTarget(prev => prev === null ? false : null)
    if (!showReplies) { setShowReplies(true); loadReplies() }
  }

  function handleReplyToReply(replyId) {
    setReplyFormTarget(prev => prev === replyId ? false : replyId)
    if (!showReplies) { setShowReplies(true) }
  }

  async function onReplyAdded() {
    setReplyFormTarget(false)
    await loadReplies()
    setShowReplies(true)
  }

  function handleReplyDelete(replyId) {
    setReplies(prev => prev.filter(r => r.id !== replyId))
  }

  function handleReplyUpdate(updatedReply) {
    setReplies(prev => prev.map(r => r.id === updatedReply.id ? updatedReply : r))
  }

  async function handleSaveEdit() {
    setSaving(true)
    try {
      const { data } = await client.put(`/reviews/${review.id}`, {
        product_id: productId,
        grade: editGrade,
        comment: editComment.trim() || null,
      })
      onUpdate(data)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function cancelEdit() {
    setEditing(false)
    setEditGrade(review.grade)
    setEditComment(review.comment ?? '')
  }

  async function doDelete() {
    setConfirmDelete(false)
    try {
      await client.delete(`/reviews/${review.id}`)
      onDelete(review.id)
    } catch {}
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-sm font-semibold shrink-0">
            {avatarChar}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-700">{displayName}</p>
              {review.is_admin && (
                <span className="text-[10px] bg-green-100 text-green-700 font-medium px-1.5 py-0.5 rounded-full leading-none">Продавец</span>
              )}
            </div>
            <p className="text-xs text-gray-400">{formatDate(review.comment_date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <StarRating value={editing ? editGrade : review.grade} onChange={editing ? setEditGrade : undefined} size="md" />
          {isOwner && !editing && (
            <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-green-600 transition-colors cursor-pointer">
              Изменить
            </button>
          )}
          {canDelete && (
            <button onClick={() => setConfirmDelete(true)} className="text-xs text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
              Удалить
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-3">
          <textarea
            value={editComment}
            onChange={e => setEditComment(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          <div className="flex gap-2 mt-2 justify-end">
            <button onClick={cancelEdit} className="text-sm text-gray-400 hover:text-gray-600 px-3 py-1.5 transition-colors">
              Отмена
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors"
            >
              {saving ? '...' : 'Сохранить'}
            </button>
          </div>
        </div>
      ) : (
        review.comment && <p className="mt-3 text-sm text-gray-700 leading-relaxed">{review.comment}</p>
      )}

      <div className="mt-3 flex items-center gap-4">
        <button
          onClick={handleMainReplyClick}
          className="text-xs text-green-600 hover:text-green-700 transition-colors"
        >
          {replyFormTarget === null ? 'Скрыть' : 'Ответить'}
        </button>
        {replies.length > 0 && (
          <button
            onClick={toggleReplies}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showReplies ? 'Скрыть ответы' : `Показать ответы (${replies.length})`}
          </button>
        )}
      </div>

      {replyFormTarget === null && (
        <ReplyForm
          reviewId={review.id}
          parentId={null}
          onAdded={onReplyAdded}
          onCancel={() => setReplyFormTarget(false)}
        />
      )}

      {showReplies && (
        <div className="mt-3 pl-4 border-l-2 border-gray-100 space-y-3">
          {loadingReplies ? (
            <p className="text-xs text-gray-400">Загрузка...</p>
          ) : replies.length === 0 ? (
            <p className="text-xs text-gray-400">Ответов пока нет</p>
          ) : (
            replies.map(reply => {
              const parent = reply.parent_id ? replyMap[reply.parent_id] : null
              const parentName = parent ? (parent.display_name ?? `#${parent.user_id}`) : null
              return (
                <ReplyRow
                  key={reply.id}
                  reply={reply}
                  user={user}
                  reviewId={review.id}
                  parentName={parentName}
                  onDelete={handleReplyDelete}
                  onUpdate={handleReplyUpdate}
                  onReply={handleReplyToReply}
                  replyFormActive={replyFormTarget === reply.id}
                  onReplyAdded={onReplyAdded}
                />
              )
            })
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          message="Удалить отзыв?"
          onConfirm={doDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

export default function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToCount } = useCart()

  const [product, setProduct] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [activeImage, setActiveImage] = useState(null)

  const [grade, setGrade] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [prodRes, revRes] = await Promise.all([
          client.get(`/products/${id}`),
          client.get(`/products/${id}/reviews/`),
        ])
        setProduct(prodRes.data)
        setReviews(revRes.data)
      } catch (err) {
        if (err.response?.status === 404) setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

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

  function handleReviewDelete(reviewId) {
    setReviews(prev => prev.filter(r => r.id !== reviewId))
  }

  function handleReviewUpdate(updatedReview) {
    setReviews(prev => prev.map(r => r.id === updatedReview.id ? updatedReview : r))
  }

  async function handleReviewSubmit(e) {
    e.preventDefault()
    setReviewError('')
    setSubmitting(true)
    try {
      const { data } = await client.post('/reviews/', { product_id: Number(id), grade, comment: comment.trim() || null })
      setReviews(prev => [data, ...prev])
      setComment('')
      setGrade(5)
    } catch (err) {
      if (err.response?.status === 403) {
        setReviewError('Отзывы могут оставлять только покупатели, оплатившие этот товар')
      } else if (err.response?.status === 409) {
        setReviewError('Вы уже оставляли отзыв на этот товар')
      } else {
        setReviewError('Не удалось отправить отзыв')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 page-enter">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
            <div className="aspect-square bg-gray-100 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-6 bg-gray-100 rounded w-3/4" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
              <div className="h-8 bg-gray-100 rounded w-1/3" />
              <div className="h-24 bg-gray-100 rounded" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 page-enter">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4 py-20 text-center">
          <p className="text-lg text-gray-400">Товар не найден</p>
          <Link to="/" className="mt-4 inline-block text-green-600 hover:underline text-sm">← Вернуться в каталог</Link>
        </main>
      </div>
    )
  }

  const rating = Math.round(Number(product.rating))

  return (
    <div className="min-h-screen bg-gray-50 page-enter">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* Назад */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Назад
        </button>

        {/* Карточка товара */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">

            {/* Фото + галерея */}
            {(() => {
              const allImages = [
                ...(product.image_url ? [{ id: 'main', image_url: product.image_url }] : []),
                ...(product.images || []),
              ]
              const currentUrl = activeImage ?? allImages[0]?.image_url ?? null
              const currentIndex = allImages.findIndex(img => img.image_url === currentUrl)
              const navigate = (dir) => {
                const next = (currentIndex + dir + allImages.length) % allImages.length
                setActiveImage(allImages[next].image_url)
              }
              return (
                <div className="flex flex-col border-b md:border-b-0 md:border-r border-gray-100">
                  <div className="aspect-square bg-gray-50 flex items-center justify-center relative">
                    {currentUrl ? (
                      <img src={`/api${currentUrl}`} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    {allImages.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => navigate(-1)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/70 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(1)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/70 hover:bg-white rounded-full shadow-md flex items-center justify-center transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                  {allImages.length > 1 && (
                    <div className="flex gap-2 p-3 overflow-x-auto border-t border-gray-100">
                      {allImages.map(img => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setActiveImage(img.image_url)}
                          className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                            currentUrl === img.image_url
                              ? 'border-green-500'
                              : 'border-transparent hover:border-gray-300'
                          }`}
                        >
                          <img src={`/api${img.image_url}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Детали */}
            <div className="p-6 md:p-8 flex flex-col gap-4">
              <h1 className="text-xl font-semibold text-gray-900 leading-snug">{product.name}</h1>

              {/* Рейтинг */}
              <div className="flex items-center gap-2">
                <StarRating value={rating} />
                <span className="text-sm text-gray-500">{Number(product.rating).toFixed(1)}</span>
                <span className="text-sm text-gray-400">· {reviews.length} {reviews.length === 1 ? 'отзыв' : 'отзывов'}</span>
              </div>

              {/* Цена */}
              <p className="text-3xl font-bold text-gray-900">
                {Number(product.price).toLocaleString('ru-RU')} ₽
              </p>

              {/* Описание */}
              {product.description && (
                <div>
                  <p className={`text-sm text-gray-600 leading-relaxed ${!descExpanded && product.description.length > 300 ? 'line-clamp-5' : ''}`}>
                    {product.description}
                  </p>
                  {product.description.length > 300 && (
                    <button
                      onClick={() => setDescExpanded(e => !e)}
                      className="text-xs text-green-600 hover:text-green-700 mt-1 transition-colors"
                    >
                      {descExpanded ? 'Свернуть' : 'Читать далее'}
                    </button>
                  )}
                </div>
              )}

              {/* Наличие */}
              {product.stock === 0 ? (
                <p className="text-sm text-red-400 font-medium">Нет в наличии</p>
              ) : (
                <p className="text-sm text-green-600 font-medium">В наличии: {product.stock} шт.</p>
              )}

              {/* Добавить в корзину */}
              {product.stock > 0 && (
                <div className="flex items-center gap-3 mt-auto">
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => setQty(q => Math.max(1, q - 1))}
                      className="px-3 py-2.5 text-gray-500 hover:bg-gray-50 transition-colors text-lg leading-none"
                    >−</button>
                    <span className="px-4 py-2.5 min-w-[3rem] text-center text-gray-700 text-sm">{qty}</span>
                    <button
                      onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                      className="px-3 py-2.5 text-gray-500 hover:bg-gray-50 transition-colors text-lg leading-none"
                    >+</button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    disabled={adding}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
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
        </div>

        {/* Отзывы */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Отзывы</h2>

          {/* Форма нового отзыва */}
          {user && !reviews.some(r => r.user_id === user.id) ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Оставить отзыв</p>
              <form onSubmit={handleReviewSubmit} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Оценка:</span>
                  <StarRating value={grade} onChange={setGrade} size="lg" />
                </div>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Комментарий (необязательно)..."
                  rows={3}
                  maxLength={1000}
                  className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
                {reviewError && (
                  <p className="text-xs text-red-500">{reviewError}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="self-end bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors"
                >
                  {submitting ? 'Отправка...' : 'Опубликовать'}
                </button>
              </form>
            </div>
          ) : !user ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 text-center">
              <p className="text-sm text-gray-500">
                <Link to="/login" className="text-green-600 hover:underline">Войдите</Link>, чтобы оставить отзыв
              </p>
            </div>
          ) : null}

          {/* Список отзывов */}
          {reviews.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Отзывов пока нет. Будьте первым!</p>
          ) : (
            <div className="space-y-3">
              {reviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  user={user}
                  productId={Number(id)}
                  onDelete={handleReviewDelete}
                  onUpdate={handleReviewUpdate}
                />
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
