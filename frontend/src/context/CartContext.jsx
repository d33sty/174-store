import { createContext, useContext, useState, useCallback } from 'react'
import client from '../api/client'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cartCount, setCartCount] = useState(0)

  const refreshCart = useCallback(async () => {
    try {
      const { data } = await client.get('/cart/')
      setCartCount(data.total_quantity)
    } catch {
      setCartCount(0)
    }
  }, [])

  const addToCount = useCallback((delta) => {
    setCartCount(c => Math.max(0, c + delta))
  }, [])

  return (
    <CartContext.Provider value={{ cartCount, setCartCount, refreshCart, addToCount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
