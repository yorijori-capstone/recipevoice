import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { DashboardV3 } from "./pages/DashboardV3";
import { RecipeDetail } from "./pages/RecipeDetail";
import { CookingMode } from "./pages/CookingMode";
import VoiceTest from "./pages/VoiceTest";
import { YoutubeSearch } from "./pages/YoutubeSearch";
import { Navbar } from "./components/Navbar";

function App() {

  return (
    <BrowserRouter>
      {/* Mobile App Container */}
      <div
        style={{
          maxWidth: '480px',
          margin: '0 auto',
          minHeight: '100vh',
          boxShadow: '0 0 50px rgba(0, 0, 0, 0.1)',
          background: 'var(--color-surface)',
          position: 'relative',
        }}
      >
        <Navbar />
        <Routes>
          <Route path="/" element={<DashboardV3 />} />
          <Route path="/v1" element={<Dashboard />} />
          <Route path="/recipe/:id" element={<RecipeDetail />} />
          <Route path="/cooking/:recipeId" element={<CookingMode />} />
          <Route path="/voice-test" element={<VoiceTest />} />
          <Route path="/youtube-search" element={<YoutubeSearch />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
