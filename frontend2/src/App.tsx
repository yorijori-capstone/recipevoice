import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { DashboardV2 } from "./pages/DashboardV2";
import { RecipeDetail } from "./pages/RecipeDetail";
import { CookingMode } from "./pages/CookingMode";
import VoiceTest from "./pages/VoiceTest";

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardV2 />} />
        <Route path="/v1" element={<Dashboard />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/cooking/:recipeId" element={<CookingMode />} />
        <Route path="/voice-test" element={<VoiceTest />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
