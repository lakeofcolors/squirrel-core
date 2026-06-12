import { useState, useEffect } from "react";
import { connectWS } from "./ws/client";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useGameStore } from "./store/index";
import { getUrl } from "./config/settings";

export default function SquirrelLoginForm() {
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const setToken = useGameStore((s) => s.setToken);
  const navigate = useNavigate();

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  useEffect(() => {
    const handleMouseMove = (event) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (!tg) {
      console.log("Not inside Telegram WebApp");
      alert("Not inside Telegram WebApp. For dev use browser.");
      return;
    }

    tg.ready();
    tg.expand();

    const doAuth = async () => {
        // senior8me
        let mock_data = "user=%7B%22id%22%3A313688482%2C%22first_name%22%3A%22senior%22%2C%22last_name%22%3A%22%22%2C%22username%22%3A%22senior8me%22%2C%22language_code%22%3A%22en%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2FaODVPx6OEOO1PY0vG-grHsIwkgXc1nBN7k9KQCDubFo.svg%22%7D&chat_instance=9089285524791343909&chat_type=private&auth_date=1771173915&signature=lLseCsI9WioKLnvfmy6n8eZDXaNo8bJNehTRanxqZ_DVD6X9qZIdj8yDfN8EK4XGLnpTyhzdoWPP5vPKcWY1Bw&hash=530a121acd186ce97e4b537abca7e251151c80735dd60c7d4e11fa02702241cb"
        // cyberbaby09
        // let mock_data = "query_id=AAEX9HQiAAAAABf0dCJwQa1A&user=%7B%22id%22%3A578090007%2C%22first_name%22%3A%22Alina%22%2C%22last_name%22%3A%22%22%2C%22username%22%3A%22cyber_baby09%22%2C%22language_code%22%3A%22en%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2FWEfDcf9TP94pV7gH2agDKZb7yKbo0sFFfd52VUBdQNI.svg%22%7D&auth_date=1771670118&signature=sUW2aJF8h4BZyjlYOkYriLdz4AE-hrFHU0ytNEm_LJROsdU1kajOKtK1TNmds1io10FtDsAneCN3XFiYU5REAg&hash=db05a740a7234d81d0e8f2289b02457a83cec4b012e2f8590d97300be2698b06"
        // rrr
        // let mock_data = "query_id=AAFug8QSAAAAAG6DxBKHLXf9&user=%7B%22id%22%3A314868590%2C%22first_name%22%3A%22Rrrrr%22%2C%22last_name%22%3A%22%22%2C%22username%22%3A%22mick0ey%22%2C%22language_code%22%3A%22ru%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2F2z3vli6qe9xWosTaYsE0I-FMcerw7nehaseLwHCZyh0.svg%22%7D&auth_date=1771671118&signature=IFIePbSXd7VMM0FbC8SKT4evUf_YxrG4ynoN_jt6cSdX4Dc7VmMBXCfVz_HlkFr9QpXTiQf4j2fdChAQw8mzCg&hash=3142d788e0f443e74f7c11c68c334a55e9ab37584ff1d2b6ee5e0956ffb0ac3e"
        // panaceya
        // let mock_data = "query_id=AAHBYzADAwAAAMFjMANhr9fS&user=%7B%22id%22%3A6495953857%2C%22first_name%22%3A%22%F0%9F%AA%AC%22%2C%22last_name%22%3A%22.%22%2C%22username%22%3A%22panaceya3%22%2C%22language_code%22%3A%22ru%22%2C%22allows_write_to_pm%22%3Atrue%2C%22photo_url%22%3A%22https%3A%5C%2F%5C%2Ft.me%5C%2Fi%5C%2Fuserpic%5C%2F320%5C%2FbLH9GOV1IptMF48qflGAUQGS1PuhWDBIxamGJ9O9fr-J5yliZDzDPCr_VlZr-iut.svg%22%7D&auth_date=1771671627&signature=yW4XVj-2BUn-q44ZGX7NQmOGEZE5uDwazY3nFPkmXeMA8h3d7K-LHgUd4VhVTXt07RARe7IaoPd7QGoCF3pqDA&hash=d562e414647933d1c69e223768885e5350cb94e939f375c90a94bb8fd8076543"


      try {
        const res = await axios.post(getUrl("/auth/login"), {
          init_data: tg.initData || mock_data,
        });

        if (res.data.access_token) {
          localStorage.setItem("access_token", res.data.access_token);
          localStorage.setItem("refresh_token", res.data.refresh_token);
          setToken(res.data.access_token);

          try {
            const meRes = await axios.get(getUrl("/auth/me"), {
              headers: { Authorization: `Bearer ${res.data.access_token}` },
            });
            if (meRes.data) {
              useGameStore.getState().setUser(meRes.data);
            }
          } catch (e) {
            console.error("Failed to fetch me data:", e);
          }

          // Проверяем реферальную ссылку (invite)
          const startParam = tg.initDataUnsafe?.start_param;
          if (startParam && startParam.startsWith("ref")) {
            const inviterId = parseInt(startParam.replace("ref_", "").replace("ref", ""), 10);
            if (!isNaN(inviterId)) {
              try {
                await axios.post(
                  getUrl("/v1/friends/invite/consume"),
                  { inviter_id: inviterId },
                  { headers: { Authorization: `Bearer ${res.data.access_token}` } }
                );
              } catch (inviteErr) {
                console.error("Failed to consume invite:", inviteErr);
              }
            }
          }

          await sleep(3000);

          const path = window.location.pathname;
          const state = useGameStore.getState();

          if (!state.gameSnapshot && (path === "/" || path === "/login")) {
            navigate("/find");
          }
        }
      } catch (err) {
        alert("Ошибка авторизации");
        console.error("Auth error:", err);
      }
    }

    doAuth();
  }, [navigate, setToken]);
  return (
    <div className="flex flex-col items-center justify-end min-h-screen login-bg p-10">
      <div className="relative flex justify-center mb-4">

        {/* Вращающаяся карта */}
        <motion.div
          className="relative w-48 h-60 rounded-xl shadow-md border-4 border-purple-600 bg-black/70 flex items-center justify-center p-2"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
        >
          {/* Пульсирующее свечение */}
          <motion.div
            className="absolute inset-0 rounded-xl"
            animate={{
              boxShadow: [
                "0 0 10px rgba(255,215,0,0.4)",
                "0 0 30px rgba(255,215,0,0.8)",
                "0 0 10px rgba(255,215,0,0.4)",
              ],
            }}
            transition={{ repeat: Infinity, duration: 2 }}
          />

          {/* Углы карты */}
          <div className="absolute top-1 left-1 text-xs font-bold
                          text-purple-300 drop-shadow-[0_0_4px_rgba(255,215,0,0.8)] flex flex-col items-center">
            <span>J</span>
            <span>♣️</span>
          </div>
          <div className="absolute bottom-1 right-1 text-xs font-bold
                          text-purple-300 drop-shadow-[0_0_4px_rgba(255,215,0,0.8)] rotate-180 flex flex-col items-center">
            <span>J</span>
            <span>♣️</span>
          </div>

          {/* Белка */}
          <motion.div
            className="relative w-24 h-24 rounded-full border-2 border-orange-500
                      flex justify-center items-center
                      shadow-[0_0_15px_rgba(255,165,0,0.5)]
                      bg-gradient-to-b from-orange-300 to-orange-500"
            animate={{ rotate: (mousePosition.x - window.innerWidth / 2) / 50 }}
          >
            {/* Ушки */}
            <div className="absolute -top-3 -left-4 w-4 h-6 bg-orange-400
                            rounded-t-full rotate-[-20deg] border border-orange-500"></div>
            <div className="absolute -top-3 -right-4 w-4 h-6 bg-orange-400
                            rounded-t-full rotate-[20deg] border border-orange-500"></div>

            {/* Глаза */}
            {!passwordFocused ? (
              <div className="absolute top-7 flex justify-between w-12">
                <motion.div className="w-2.5 h-2.5 bg-black rounded-full"
                  animate={{
                    x: (mousePosition.x - window.innerWidth / 2) / 120,
                    y: (mousePosition.y - window.innerHeight / 2) / 120,
                  }}
                />
                <motion.div className="w-2.5 h-2.5 bg-black rounded-full"
                  animate={{
                    x: (mousePosition.x - window.innerWidth / 2) / 120,
                    y: (mousePosition.y - window.innerHeight / 2) / 120,
                  }}
                />
              </div>
            ) : (
              <div className="absolute top-7 flex justify-between w-12">
                <div className="w-3 h-1 bg-black rounded-full"></div>
                <div className="w-3 h-1 bg-black rounded-full"></div>
              </div>
            )}

            {/* Нос + усы */}
            <div className="absolute bottom-3 w-2 h-2 bg-black rounded-full"></div>
            <div className="absolute bottom-3 left-2 w-5 h-0.5 bg-black rotate-[15deg]"></div>
            <div className="absolute bottom-2.5 left-2 w-5 h-0.5 bg-black rotate-[-15deg]"></div>
            <div className="absolute bottom-3 right-2 w-5 h-0.5 bg-black rotate-[-15deg]"></div>
            <div className="absolute bottom-2.5 right-2 w-5 h-0.5 bg-black rotate-[15deg]"></div>
          </motion.div>
        </motion.div>
      </div>

      {/* Три мигающие точки снизу */}
  {/* Текст + точки загрузки */}
    <div className="flex items-center gap-2 mt-6 text-yellow-300 font-semibold tracking-widest">
      <span>Loading</span>
      <div className="flex gap-2">
        {[0,1,2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 bg-yellow-400 rounded-full"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ repeat: Infinity, duration: 1, delay: i * 0.3 }}
          />
        ))}
      </div>
    </div>
    </div>
  );
}
