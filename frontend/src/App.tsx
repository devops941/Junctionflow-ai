import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import DashboardPage from './pages/dashboard/DashboardPage'
import DatasetsPage from './pages/datasets/DatasetsPage'
import DatasetDetailPage from './pages/datasets/DatasetDetailPage'
import ExplorePage from './pages/explore/ExplorePage'
import FeaturesPage from './pages/features/FeaturesPage'
import ModelsPage from './pages/models/ModelsPage'
import ForecastsPage from './pages/forecasts/ForecastsPage'
import AccuracyPage from './pages/accuracy/AccuracyPage'
import ReportsPage from './pages/reports/ReportsPage'
import JunctionsPage from './pages/junctions/JunctionsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="junctions" element={<JunctionsPage />} />
          <Route path="datasets" element={<DatasetsPage />} />
          <Route path="datasets/:id" element={<DatasetDetailPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="features" element={<FeaturesPage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="forecasts" element={<ForecastsPage />} />
          <Route path="accuracy" element={<AccuracyPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
