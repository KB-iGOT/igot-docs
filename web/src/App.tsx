import { createHashRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { HubListPage } from './pages/HubListPage';
import { FeaturePage } from './pages/FeaturePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlatformOverviewPage } from './pages/PlatformOverviewPage';
import { EtlAnalyticsPage } from './pages/EtlAnalyticsPage';
import { DocPage } from './pages/DocPage';

/* Hash routing: the build is static files (GitHub Pages / any web server) with no server-side rewrites. */
const router = createHashRouter([
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'platform-overview', element: <PlatformOverviewPage /> },
      { path: 'etl-analytics/:view?/:id?', element: <EtlAnalyticsPage /> },
      { path: 'system-architecture', element: <DocPage title="System Architecture" path="platform/system-architecture.md" /> },
      { path: 'monitoring', element: <DocPage title="Monitoring" path="platform/monitoring.md" /> },
      { path: 'hubs', element: <HubListPage /> },
      { path: 'hubs/:hubId', element: <HubListPage /> },
      { path: 'features/:featureId', element: <FeaturePage /> },
      { path: 'features/:featureId/:tabKey', element: <FeaturePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
