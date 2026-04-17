import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import PublicStore from './components/PublicStore';
import AdminDashboard from './components/AdminDashboard';
import AdminDashboard2 from './components/AdminDashboard2';
import Login from './components/Login';
import CheckoutSuccess from './components/CheckoutSuccess';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { initTracking } from './lib/tracking';
import { captureUTMParams } from './lib/utm';
import RouteTracker from './components/RouteTracker';
import CartDrawer from './components/CartDrawer';

const ProtectedRoute = ({ children }) => {
    const { currentUser } = useAuth();
    if (!currentUser) return <Navigate to="/login" />;
    return children;
};

function App() {
    useEffect(() => {
        captureUTMParams();
        initTracking();
    }, []);

    return (
        <AuthProvider>
            <CartProvider>
                <BrowserRouter>
                    <RouteTracker />
                    <CartDrawer />
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/beats" element={<PublicStore />} />
                        <Route path="/success" element={<CheckoutSuccess />} />
                        <Route path="/admin" element={
                            <ProtectedRoute>
                                <AdminDashboard />
                            </ProtectedRoute>
                        } />
                        <Route path="/admin2" element={
                            <ProtectedRoute>
                                <AdminDashboard2 />
                            </ProtectedRoute>
                        } />
                        <Route path="/login" element={<Login />} />
                    </Routes>
                </BrowserRouter>
            </CartProvider>
        </AuthProvider>
    );
}

export default App;
