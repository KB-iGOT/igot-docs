import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { HubPage } from './pages/HubPage';
import { FeaturePage } from './pages/FeaturePage';
import { NotFoundPage } from './pages/NotFoundPage';

/* Hash routing: the build is static files (GitHub Pages / any web server) with no server-side rewrites. */
const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'hubs', element: <HubPage /> },
      { path: 'hubs/:hubId', element: <HubPage /> },
      { path: 'features/:featureId', element: <FeaturePage /> },
      { path: 'features/:featureId/:tabKey', element: <FeaturePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
