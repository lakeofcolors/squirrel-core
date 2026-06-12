import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import SquirrelLoginForm from "./SquirrelLoginForm";
import SquirrelGameTable from "./Game";
import GameSearch from "./SearchGame";
import ReadyCheckModal from "./components/ReadyCheckModal";
import VsScreenModal from "./components/VsScreenModal";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useEffect } from "react";
import { useGameStore } from "./store";
import { connectWS, startTokenRefresh, stopTokenRefresh, cleanup, refreshAuthToken } from "./ws/client";
import axios from "axios";

// === GLOBAL AXIOS INTERCEPTOR FOR 401/403 ===
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если 401 или 403 и мы еще не пробовали делать retry
    if (error.response && (error.response.status === 401 || error.response.status === 403) && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function(resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return axios(originalRequest);
        }).catch(err => {
          return Promise.reject(err);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const success = await refreshAuthToken();
        if (success) {
          const newToken = localStorage.getItem("access_token");
          processQueue(null, newToken);
          originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
          
          useGameStore.getState().setToken?.(newToken);

          return axios(originalRequest);
        } else {
          processQueue(new Error('Refresh failed'));
          return Promise.reject(error);
        }
      } catch (err) {
        processQueue(err);
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
// ============================================

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useGameStore((s) => s.token) || localStorage.getItem("access_token");

  useEffect(() => {
    // Не подключаемся если на лендинге/логине
    if (location.pathname === "/" || location.pathname === "/login") {
      cleanup();
      stopTokenRefresh();
      return;
    }

    if (token) {
      connectWS(navigate);
      startTokenRefresh();
    }
  }, [navigate, location.pathname, token]);

  return (
    <>
      <Routes>
        <Route path="/" element={<SquirrelLoginForm />} />
        <Route path="/find" element={<GameSearch />} />
        <Route path="/game" element={<SquirrelGameTable />} />
      </Routes>

      <ReadyCheckModal />
      <VsScreenModal />

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
    </>
  );
}

export default App;
