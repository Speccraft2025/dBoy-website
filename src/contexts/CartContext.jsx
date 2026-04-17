import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

// Pricing Rules config
export const LICENSE_TIERS = {
    basic: { label: 'Basic', price: 0, format: 'MP3' },
    premium: { label: 'Premium', price: 50, format: 'MP3 + WAV' },
    exclusive: { label: 'Exclusive', price: 100, format: 'MP3 + WAV + Stems' }
};

export const CartProvider = ({ children }) => {
    const [cart, setCart] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('dboy_cart');
            return saved ? JSON.parse(saved) : [];
        }
        return [];
    });
    const [isCartOpen, setIsCartOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem('dboy_cart', JSON.stringify(cart));
    }, [cart]);

    const addToCart = (item) => {
        setCart(prev => {
            // Check if beat already exists with same license
            const existingIdx = prev.findIndex(i => i.beatId === item.beatId && i.licenseType === item.licenseType);
            if (existingIdx > -1) {
                // If they add the same beat+license, we just ignore or update qty. Let's ignore for digital goods.
                return prev;
            }
            // If they are adding a different license for same beat, maybe we replace it? Or allow both? 
            // Better to replace existing beat in cart if changing license
            const filtered = prev.filter(i => i.beatId !== item.beatId);
            return [...filtered, { ...item, quantity: 1 }];
        });
        setIsCartOpen(true);
    };

    const removeFromCart = (beatId) => {
        setCart(prev => prev.filter(i => i.beatId !== beatId));
    };

    const clearCart = () => setCart([]);

    // Calculate totals & discounts
    const cartAnalysis = useMemo(() => {
        let subtotal = 0;
        let discount = 0;
        
        // Group items by license type
        const premiumItems = [];
        const otherItems = [];

        cart.forEach(item => {
            if (item.licenseType === 'premium') premiumItems.push(item);
            else otherItems.push(item);
        });

        // Calculate other items
        otherItems.forEach(item => { subtotal += item.price; });

        // Calculate Premium items (Buy 1 Get 2 Free)
        // Sort descending so the highest price is paid if prices differ
        premiumItems.sort((a, b) => b.price - a.price);

        for (let i = 0; i < premiumItems.length; i++) {
            subtotal += premiumItems[i].price;
            // Every 2nd and 3rd item in a group of 3 is free
            if (i % 3 === 1 || i % 3 === 2) {
                discount += premiumItems[i].price;
            }
        }

        const total = subtotal - discount;

        return { subtotal, discount, total, itemCount: cart.length };
    }, [cart]);

    return (
        <CartContext.Provider value={{
            cart,
            addToCart,
            removeFromCart,
            clearCart,
            isCartOpen,
            setIsCartOpen,
            ...cartAnalysis
        }}>
            {children}
        </CartContext.Provider>
    );
};
