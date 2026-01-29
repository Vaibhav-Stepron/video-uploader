import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AuthProvider from "./context/AuthContext";
import ThemeProvider from "./context/ThemeContext";
import Layout from "./components/Layout";
import UploadPage from "./pages/UploadPage";
import MultipleUploadPage from "./pages/MultipleUploadPage";
import HistoryPage from "./pages/HistoryPage";
import ChangelogPage from "./pages/ChangelogPage";

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<UploadPage />} />
              <Route path="upload-multiple" element={<MultipleUploadPage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="changelog" element={<ChangelogPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
