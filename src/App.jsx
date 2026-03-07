import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './components/Home';
import PublicStore from './components/PublicStore';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { currentUser } = useAuth();
    if (!currentUser) return <Navigate to="/login" />;
    return children;
};

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/beats" element={<PublicStore />} />
                    <Route path="/admin" element={
                        <ProtectedRoute>
                            <AdminDashboard />
                        </ProtectedRoute>
                    } />
                    <Route path="/login" element={<Login />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
