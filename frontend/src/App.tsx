import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { RecipeDetail } from "./pages/RecipeDetail";
import { VoiceGuidance } from "./pages/VoiceGuidance";
import { SearchResults } from "./pages/SearchResults";

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/recipe/:id/voice" element={<VoiceGuidance />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
