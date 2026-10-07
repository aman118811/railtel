import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Link, Navigate, RouterProvider } from 'react-router-dom';
import App from './App.jsx';
import Dashboard from './Dashboard.jsx';
import StationsTable from './StationsTable.jsx';
import StationList from './StationList.jsx';
import StationForm from './StationForm.jsx';
import StationDetail from './StationDetail.jsx';
import StationWizard from './StationWizard.jsx';
import ReportPage from './ReportPage.jsx';
import Projects from './Projects.jsx';
import ProjectForm from './ProjectForm.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import './styles.css';
import './app.css';

function NotFound() {
  return (
    <div className="page">
      <h1>Page not found</h1>
      <p className="muted">There is nothing at this address.</p>
      <Link to="/" className="btn btn-primary">Back to projects</Link>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      { path: 'projects', element: <Projects /> },
      { path: 'projects/new', element: <ProjectForm /> },
      { path: 'projects/:id', element: <ProjectDetail /> },
      { path: 'projects/:id/edit', element: <ProjectForm /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'stations', element: <StationsTable preset="stations" /> },
      { path: 'stations/grouped', element: <StationList /> },
      { path: 'stations/new', element: <StationWizard /> },
      { path: 'stations/:id/draft', element: <StationWizard /> },
      { path: 'stations/:id/view', element: <StationDetail /> },
      { path: 'stations/:id', element: <StationForm /> },
      { path: 'progress', element: <StationsTable preset="progress" /> },
      { path: 'handover', element: <StationsTable preset="handover" /> },
      { path: 'infrastructure', element: <StationsTable preset="infrastructure" /> },
      { path: 'report', element: <ReportPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
