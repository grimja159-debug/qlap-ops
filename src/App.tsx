import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { adminRoutes } from './routes/adminRoutes';
import { LoginPage } from './pages/LoginPage';

const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/admin" replace /> },
  { path: '/login', element: <LoginPage /> },
  ...adminRoutes,
]);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
      // 운영 콘솔은 창 포커스를 오갈 때마다 재요청할 이유가 적다.
      // 불필요한 백엔드 부하/깜빡임을 줄인다(명시적 새로고침·invalidate 는 그대로 동작).
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
