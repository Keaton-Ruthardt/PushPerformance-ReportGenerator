#!/bin/bash

# Setup React Frontend for Push Performance
echo "Setting up Push Performance React Frontend..."

cd client

# Create directories
mkdir -p src/api src/context src/pages src/components

# Create main.jsx
cat > src/main.jsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF

# Create index.css
cat > src/index.css << 'EOF'
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}
EOF

# Create App.jsx
cat > src/App.jsx << 'EOF'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assessment from './pages/Assessment';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/assessment/:athleteId?"
            element={
              <PrivateRoute>
                <Assessment />
              </PrivateRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
EOF

# Create App.css
cat > src/App.css << 'EOF'
.app { min-height: 100vh; }
.container { max-width: 1200px; margin: 0 auto; padding: 20px; }
.btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.3s; }
.btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3); }
.card { background: white; border-radius: 16px; padding: 30px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1); margin-bottom: 20px; }
.form-group { margin-bottom: 20px; }
.form-label { display: block; font-weight: 600; margin-bottom: 8px; color: #374151; }
.form-input { width: 100%; padding: 12px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; }
.form-input:focus { outline: none; border-color: #667eea; }
.grid { display: grid; gap: 20px; }
.grid-2 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
EOF

echo "✅ Frontend structure created successfully!"
echo "📝 Next: Review FRONTEND_IMPLEMENTATION_GUIDE.md for full component code"
echo "🚀 Run: npm run dev (from client directory)"
