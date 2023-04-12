import { Navigate } from "react-router";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AllVideosPage, VideoPage } from "./pages";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='videos'>
          <Route path='' element={<AllVideosPage />}></Route>
          <Route path=':videoId' element={<VideoPage />}></Route>
          <Route path="*" element={<Navigate to="/videos" replace />} />
        </Route>
        <Route path='*' element={<Navigate to='/videos'></Navigate>}></Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
