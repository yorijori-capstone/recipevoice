import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { RecipeDetail } from "./pages/RecipeDetail";
import VoiceTest from "./pages/VoiceTest";  

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/recipe/:id" element={<RecipeDetail />} />
        <Route path="/voice-test" element={<VoiceTest />} /> 
      </Routes>
    </BrowserRouter>
  )
}

export default App
