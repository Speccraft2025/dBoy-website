import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

// Pricing Rules config
export const LICENSE_TIERS = {
    starter: { label: 'Starter', price: 1000, format: 'MP3' },
    standard: { label: 'Standard', price: 4000, format: 'MP3 + WAV' },
    custom: { label: 'Custom', price: 10000, format: 'MP3 + WAV + Stems' }
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
    
    const [currency, setCurrency] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('dboy_currency') || 'USD';
        }
        return 'USD';
    });
    const exchangeRate = 130;

    useEffect(() => {
        if (typeof window !== 'undefined' && !localStorage.getItem('dboy_currency')) {
            fetch('https://ipapi.co/json/')
                .then(res => res.json())
                .then(data => {
                    if (data.country_code === 'KE') {
                        setCurrency('KES');
                        localStorage.setItem('dboy_currency', 'KES');
                    } else {
                        setCurrency('USD');
                        localStorage.setItem('dboy_currency', 'USD');
                    }
                })
                .catch(err => console.error('Geolocation failed:', err));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('dboy_cart', JSON.stringify(cart));
    }, [cart]);

    useEffect(() => {
        localStorage.setItem('dboy_currency', currency);
    }, [currency]);

    const formatPrice = (baseKesPrice) => {
        if (baseKesPrice === 0) return 'Free';
        if (currency === 'KES') {
            return `KES ${baseKesPrice.toLocaleString()}`;
        }
        return `$${Math.round(baseKesPrice / exchangeRate)}`;
    };

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

    const toggleExclusive = (beatId) => {
        setCart(prev => prev.map(item => {
            if (item.beatId === beatId && (item.licenseType === 'standard' || item.licenseType === 'custom')) {
                return { ...item, isExclusive: !item.isExclusive };
            }
            return item;
        }));
    };

    const clearCart = () => setCart([]);

    const cartAnalysis = useMemo(() => {
        let subtotal = 0;
        let discount = 0;
        
        const starterItems = [];
        const standardItems = [];

        cart.forEach(item => {
            let itemPrice = item.price;
            
            // Exclusive Upgrade overrides base price (total must be 10,000 KES)
            if (item.isExclusive) {
                itemPrice = 10000;
                subtotal += itemPrice;
            } else {
                subtotal += itemPrice;
                // Only non-exclusive items are eligible for bulk discounts
                if (item.licenseType === 'starter') starterItems.push(item);
                if (item.licenseType === 'standard') standardItems.push(item);
            }
        });

        // ── Bulk Discounts ──
        // Starter: Buy 1 Get 1 Free, Buy 3 Get 2 Free (Every 5th gives 2 free, remaining pairs give 1 free)
        starterItems.sort((a, b) => b.price - a.price);
        let starterFreeCount = Math.floor(starterItems.length / 5) * 2 + Math.floor((starterItems.length % 5) / 2);
        for (let i = 0; i < starterFreeCount; i++) {
            discount += starterItems[starterItems.length - 1 - i].price;
        }

        // Standard: Buy 2 Get 1 Free, Buy 4 Get 2 Free (Every 3rd item is free)
        standardItems.sort((a, b) => b.price - a.price);
        let standardFreeCount = Math.floor(standardItems.length / 3);
        for (let i = 0; i < standardFreeCount; i++) {
            discount += standardItems[standardItems.length - 1 - i].price;
        }

        const rate = currency === 'KES' ? 1 : (1 / exchangeRate);
        const finalSubtotal = Math.round(subtotal * rate);
        const finalDiscount = Math.round(discount * rate);
        const finalTotal = finalSubtotal - finalDiscount;

        return { 
            subtotal: finalSubtotal, 
            discount: finalDiscount, 
            total: finalTotal, 
            itemCount: cart.length 
        };
    }, [cart, currency]);

    return (
        <CartContext.Provider value={{
            cart,
            addToCart,
            removeFromCart,
            toggleExclusive,
            clearCart,
            isCartOpen,
            setIsCartOpen,
            currency,
            setCurrency,
            exchangeRate,
            formatPrice,
            ...cartAnalysis
        }}>
            {children}
        </CartContext.Provider>
    );
};
