import React, { useState } from 'react';
import { X, Trash2, ShoppingBag, Music2, ShieldCheck, Loader } from 'lucide-react';
import { useCart, LICENSE_TIERS } from '../contexts/CartContext';
import { trackEvent } from '../lib/tracking';
import { getUTMParams } from '../lib/utm';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

export default function CartDrawer() {
    const { cart, isCartOpen, setIsCartOpen, removeFromCart, toggleExclusive, subtotal, discount, total, itemCount, currency, formatPrice } = useCart();
    const [isProcessing, setIsProcessing] = useState(false);

    if (!isCartOpen) return null;

    const handleCheckout = async () => {
        if (itemCount === 0) return;
        
        setIsProcessing(true);
        try {
            // Track intention
            trackEvent('begin_checkout', {
                value: total,
                currency: 'KES',
                items: cart.map(i => ({ item_id: i.beatId, item_name: i.title, price: i.price }))
            });

            // Call Firebase Function /createOrder
            const functions = getFunctions(app);
            const createOrder = httpsCallable(functions, 'createOrder');
            
            let userEmail = localStorage.getItem('dboy_user_email');
            if (!userEmail) {
                userEmail = window.prompt("Please enter an email address to receive your tracks:");
                if (!userEmail) {
                    setIsProcessing(false);
                    return; // user cancelled
                }
                localStorage.setItem('dboy_user_email', userEmail);
            }

            const response = await createOrder({
                items: cart.map(i => ({
                    beatId: i.beatId,
                    title: i.title,
                    price: i.price,
                    licenseType: i.licenseType,
                    isExclusive: i.isExclusive || false
                })),
                userEmail: userEmail,
                callbackUrl: `${window.location.origin}/success`,
                currency: currency
            });

            const { redirectUrl, orderId } = response.data;
            
            if (redirectUrl) {
                // Keep orderId in state to fetch later 
                localStorage.setItem('dboy_pending_order', orderId);
                window.location.href = redirectUrl;
            } else {
                throw new Error("No payment link returned from gateway.");
            }
        } catch (error) {
            console.error('Checkout error:', error);
            setIsProcessing(false);
            alert(`Payment Gateway Error: ${error.message}`);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={() => setIsCartOpen(false)}
            />

            {/* Drawer */}
            <div className="relative w-full max-w-md h-full bg-[#0f172a] shadow-2xl flex flex-col border-l border-[#facc15]/20 animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-5 sm:p-6 border-b border-[#facc15]/10 bg-[#1e293b]/40">
                    <div className="flex items-center gap-3 text-white">
                        <ShoppingBag className="text-[#facc15]" size={24} />
                        <h2 className="text-xl font-black tracking-widest uppercase">Your Cart</h2>
                        <span className="bg-[#facc15] text-black text-xs font-bold px-2 py-0.5 rounded-full">{itemCount}</span>
                    </div>
                    <button 
                        onClick={() => setIsCartOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body (Items) */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                    {itemCount === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-gray-500">
                            <Music2 size={48} className="opacity-20" />
                            <p className="font-medium tracking-wide">Your cart is empty.</p>
                            <button 
                                onClick={() => setIsCartOpen(false)}
                                className="text-[#facc15] border border-[#facc15]/30 hover:bg-[#facc15]/10 px-6 py-2 rounded-full transition text-sm font-bold uppercase"
                            >
                                Browse Beats
                            </button>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.beatId} className="flex gap-4 bg-[#1e293b]/50 p-3 rounded-xl border border-white/5 relative group">
                                <div className="w-16 h-16 bg-black rounded-lg overflow-hidden border border-[#facc15]/20 flex-shrink-0">
                                    <img src={item.coverUrl || 'https://via.placeholder.com/150'} alt={item.title} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex flex-col flex-1 min-w-0 justify-center">
                                    <h3 className="text-white font-bold text-sm truncate">{item.title}</h3>
                                    <p className="text-xs text-[#facc15] uppercase tracking-wider font-semibold mt-0.5">
                                        {LICENSE_TIERS[item.licenseType]?.label} License {item.isExclusive && '(Exclusive)'}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {item.isExclusive ? formatPrice(10000) : formatPrice(item.price)}
                                    </p>
                                    {(item.licenseType === 'standard' || item.licenseType === 'custom') && (
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer group/toggle w-fit">
                                            <input 
                                                type="checkbox" 
                                                checked={!!item.isExclusive}
                                                onChange={() => toggleExclusive(item.beatId)}
                                                className="hidden"
                                            />
                                            <div className={`w-8 h-4 rounded-full transition-colors relative ${item.isExclusive ? 'bg-[#facc15]' : 'bg-gray-600'}`}>
                                                <div className={`absolute w-3 h-3 bg-white rounded-full top-0.5 transition-transform ${item.isExclusive ? 'left-1 translate-x-[14px]' : 'left-0.5 translate-x-0'}`} />
                                            </div>
                                            <span className="text-[10px] uppercase font-bold text-gray-400 group-hover/toggle:text-white transition-colors">
                                                Upgrade Exclusive
                                            </span>
                                        </label>
                                    )}
                                </div>
                                <button 
                                    onClick={() => removeFromCart(item.beatId)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-2"
                                    title="Remove from cart"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer (Totals & Checkout) */}
                {itemCount > 0 && (
                    <div className="p-5 sm:p-6 bg-[#1e293b] border-t border-[#facc15]/10 space-y-4">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-gray-400">
                                <span>Subtotal</span>
                                <span>{currency === 'KES' ? 'KES ' : '$'}{subtotal.toLocaleString()}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-green-400 font-medium">
                                    <span>Promo Discount</span>
                                    <span>- {currency === 'KES' ? 'KES ' : '$'}{discount.toLocaleString()}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-white text-lg font-black pt-2 border-t border-white/10">
                                <span>Total</span>
                                <span className="text-[#facc15]">{currency === 'KES' ? 'KES ' : '$'}{total.toLocaleString()}</span>
                            </div>
                        </div>

                        <button 
                            onClick={handleCheckout}
                            disabled={isProcessing}
                            className="w-full bg-[#facc15] hover:bg-yellow-400 text-black font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:shadow-[0_0_30px_rgba(250,204,21,0.4)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? (
                                <Loader className="animate-spin" size={20} />
                            ) : (
                                <>
                                    <ShieldCheck size={20} />
                                    Secure Checkout
                                </>
                            )}
                        </button>
                        <p className="text-center text-[10px] text-gray-500 uppercase tracking-widest mt-3 flex items-center justify-center gap-1">
                            <ShieldCheck size={12} /> Powered by Pesapal
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
