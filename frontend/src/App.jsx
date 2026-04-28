import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CurrentZakat from './pages/CurrentZakat.jsx';
import MissedZakat from './pages/MissedZakat.jsx';
import './styles/global.css';

export default function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/current" element={<CurrentZakat />} />
            <Route path="/missed" element={<MissedZakat />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
