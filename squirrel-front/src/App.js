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
  const wsConnected = useGameStore((s) => s.wsConnected);

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

  const isGameRoute = location.pathname !== "/" && location.pathname !== "/login";
  const showDisconnectOverlay = token && isGameRoute && !wsConnected;

  return (
    <>
      <Routes>
        <Route path="/" element={<SquirrelLoginForm />} />
        <Route path="/find" element={<GameSearch />} />
        <Route path="/game" element={<SquirrelGameTable />} />
      </Routes>

      <ReadyCheckModal />
      <VsScreenModal />

      {showDisconnectOverlay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-[#1a1a2e] border border-red-500/30 rounded-3xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-4 animate-pulse">
            <span className="text-4xl">🔌</span>
            <h3 className="text-xl font-bold text-white">Соединение потеряно</h3>
            <p className="text-gray-400 text-sm">
              Пытаемся восстановить подключение к игровому серверу...
            </p>
            <div className="mt-2 w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      )}

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
