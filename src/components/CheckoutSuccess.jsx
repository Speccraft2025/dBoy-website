import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db, app } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { CheckCircle, XCircle, Loader, Download, ChevronLeft, FileText } from 'lucide-react';
import { trackEvent } from '../lib/tracking';
import { useCart } from '../contexts/CartContext';

export default function CheckoutSuccess() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { clearCart } = useCart();
    
    const [status, setStatus] = useState('loading'); // loading, paid, failed, pending
    const [orderInfo, setOrderInfo] = useState(null);
    const [downloadLinks, setDownloadLinks] = useState([]);
    const [downloadError, setDownloadError] = useState(null);
    
    // Pesapal passes OrderTrackingId and OrderMerchantReference
    const orderTrackingId = searchParams.get('OrderTrackingId');
    const merchantReference = searchParams.get('OrderMerchantReference') || localStorage.getItem('dboy_pending_order');
    const userEmail = localStorage.getItem('dboy_user_email');

    useEffect(() => {
        if (!merchantReference) {
            setStatus('failed');
            return;
        }

        const orderRef = doc(db, 'orders', merchantReference);
        
        const unsubscribe = onSnapshot(orderRef, (snapshot) => {
            if (!snapshot.exists()) {
                setStatus('failed');
                return;
            }

            const orderData = snapshot.data();
            setOrderInfo(orderData);

            if (orderData.status === 'paid') {
                handleSuccess(orderData);
            } else if (orderData.status === 'failed') {
                setStatus('failed');
            } else {
                setStatus('pending');
            }
        }, (error) => {
            console.error("Snapshot error:", error);
            setStatus('failed');
        });

        return () => unsubscribe();
    }, [merchantReference]);

    const handleSuccess = async (orderData) => {
        setStatus('paid');
        clearCart();
        
        // Track Conversion
        trackEvent('purchase', {
            transaction_id: merchantReference,
            value: orderData.totalAmount,
            currency: orderData.currency || 'KES',
            items: orderData.items.map(i => ({ item_id: i.beatId, item_name: i.title, price: i.price }))
        });

        // Request secure signed URLs from Backend
        try {
            const functions = getFunctions(app);
            const getOrderedAssets = httpsCallable(functions, 'getOrderedAssets');
            const res = await getOrderedAssets({ 
                orderId: merchantReference,
                userEmail: orderData.userEmail || userEmail 
            });
            setDownloadLinks(res.data.assets || []);
        } catch (error) {
            console.error("Failed to generate secure links:", error);
            setDownloadError("Could not fetch secure links. Please check your email or contact support.");
        }
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center pt-24 pb-12 px-6">
            <div className="w-full max-w-2xl bg-[#1e293b]/60 backdrop-blur-md rounded-3xl p-8 sm:p-12 border border-white/5 shadow-2xl relative overflow-hidden">
                
                {status === 'loading' && (
                    <div className="flex flex-col items-center justify-center space-y-6">
                        <Loader className="animate-spin text-[#facc15]" size={64} />
                        <h2 className="text-2xl font-black tracking-widest uppercase">Verifying Payment...</h2>
                        <p className="text-gray-400">Please wait while we confirm your transaction securely.</p>
                    </div>
                )}

                {status === 'pending' && (
                    <div className="flex flex-col items-center justify-center space-y-6 text-center">
                        <Loader className="animate-spin text-gray-400" size={64} />
                        <h2 className="text-2xl font-black tracking-widest uppercase text-white">Payment Pending</h2>
                        <p className="text-gray-400">We are waiting for Pesapal to confirm your transaction. If money was deducted, your files will be emailed to you shortly at <strong className="text-white">{orderInfo?.userEmail}</strong>.</p>
                        <button onClick={() => window.location.reload()} className="mt-4 bg-[#facc15] text-black px-6 py-2 rounded-full font-bold">Refresh Status</button>
                    </div>
                )}

                {status === 'failed' && (
                    <div className="flex flex-col items-center justify-center space-y-6 text-center">
                        <XCircle className="text-red-500" size={64} />
                        <h2 className="text-2xl font-black tracking-widest uppercase text-red-500">Transaction Failed</h2>
                        <p className="text-gray-400">We could not verify your payment. Please try checking out again.</p>
                        <button onClick={() => navigate('/beats')} className="mt-4 bg-gray-800 text-white px-6 py-2 rounded-full font-bold border border-gray-600 hover:bg-gray-700 transition">Return to Store</button>
                    </div>
                )}

                {status === 'paid' && (
                    <div className="flex flex-col items-center space-y-8 w-full">
                        <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle className="text-green-500" size={48} />
                        </div>
                        <div className="text-center">
                            <h2 className="text-3xl font-black tracking-widest uppercase text-white drop-shadow-[0_0_15px_rgba(250,204,21,0.2)]">Purchase Complete</h2>
                            <p className="text-gray-400 mt-2">Thank you for your order! Your receipt has been sent to {orderInfo?.userEmail || userEmail}</p>
                        </div>
                        
                        <div className="w-full bg-[#0f172a] rounded-2xl p-6 border border-white/5 shadow-inner mt-4">
                            <h3 className="font-bold text-[#facc15] uppercase tracking-widest text-sm mb-4">Your Downloads</h3>
                            
                            {downloadError ? (
                                <div className="text-center py-6 text-red-500 font-bold">
                                    {downloadError}
                                </div>
                            ) : downloadLinks.length === 0 ? (
                                <div className="text-center py-6 text-gray-500 flex flex-col items-center">
                                    <Loader className="animate-spin mb-2" size={24} />
                                    <p className="text-sm uppercase tracking-widest">Generating Secure Links...</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {downloadLinks.map((link, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-[#1e293b] rounded-xl">
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-white truncate">{link.title}</h4>
                                                <p className="text-xs text-green-400 font-medium tracking-wider uppercase">{link.licenseType} License</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                                {link.audioUrl && (
                                                    <a href={link.audioUrl} target="_blank" rel="noreferrer" className="bg-[#facc15] text-black hover:bg-yellow-400 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition flex-1 sm:flex-none justify-center">
                                                        <Download size={14} /> Audio
                                                    </a>
                                                )}
                                                {link.stemsUrl && (
                                                    <a href={link.stemsUrl} target="_blank" rel="noreferrer" className="bg-purple-500 text-white hover:bg-purple-400 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition flex-1 sm:flex-none justify-center">
                                                        <Download size={14} /> Stems ZIP
                                                    </a>
                                                )}
                                                {link.licensePdfUrl && (
                                                    <a href={link.licensePdfUrl} target="_blank" rel="noreferrer" className="bg-[#3b82f6] text-white hover:bg-blue-500 font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition flex-1 sm:flex-none justify-center">
                                                        <FileText size={14} /> License PDF
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button onClick={() => navigate('/beats')} className="flex items-center gap-2 text-gray-400 hover:text-white transition mt-8 hover:underline">
                            <ChevronLeft size={16} /> Continue Shopping
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
