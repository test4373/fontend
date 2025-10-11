import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';

const AdminProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  const { data: adminCheck, isLoading: adminLoading } = useQuery({
    queryKey: ['admin-check'],
    queryFn: async () => {
      try {
        const response = await api.get('/admin/stats');
        return response.data.success;
      } catch (error) {
        return false;
      }
    },
    enabled: isAuthenticated && !loading,
  });

  if (loading || adminLoading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
    </div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!adminCheck) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
