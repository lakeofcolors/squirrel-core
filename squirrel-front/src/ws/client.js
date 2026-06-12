import { useGameStore } from "../store";
import { toast } from "react-toastify";
import { playCardDropSound } from "../utils/audio";
import { getUrl } from "../config/settings";
import axios from "axios";

let socket = null;
let pingInterval = null;
let listeners = new Set();
let refreshInterval = null;
let reconnectTimeout = null;

export function subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); }

export function cleanup() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  if (socket) {
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      socket.close();
    }
    socket.onopen = null;
    socket.onclose = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket = null;
  }
}

export async function refreshAuthToken() {
  try {
    const refresh_token = localStorage.getItem("refresh_token");
    if (!refresh_token) return false;

    const res = await axios.post(getUrl("/auth/refresh"), {
      refresh_token,
    });

    if (res.data?.access_token && res.data?.refresh_token) {
      // Обновляем токены в хранилище
      localStorage.setItem("access_token", res.data.access_token);
      localStorage.setItem("refresh_token", res.data.refresh_token);
      console.log("Token successfully refreshed");
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    // Если рефреш-токен тоже протух, можно очистить сторадж и выкинуть на логин
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/";
    return false;
  }
}

// Запуск фонового таймера
export function startTokenRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

  refreshInterval = setInterval(() => {
    refreshAuthToken();
  }, REFRESH_INTERVAL_MS);
}

// Очистка таймера (на случай размонтирования компонента)
export function stopTokenRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

export function forceCloseSocket() {
  if (socket) {
    socket.close(4000, "force test");
  }
}

function getToken() {
  return localStorage.getItem("access_token");
}

export function connectWS(navigate) {
  if (
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  ) {
    return;
  }

  cleanup();

  const token = getToken();
  socket = new WebSocket(getUrl("/v1/ws", true), ["jwt", token]);

  socket.onopen = () => {
    subscribeRooms();
  };

  socket.onclose = (e) => {
    console.log("WS closed", e.code, e.reason);
    cleanup();

    if (getToken()) {
      // Пингуем axios, чтобы он мог перехватить 401/403 и обновить токен через глобальный интерцептор
      reconnectTimeout = setTimeout(async () => {
        try {
          await axios.get(getUrl("/auth/me"), { headers: { Authorization: `Bearer ${getToken()}` } });
        } catch (err) {}
        
        connectWS(navigate);
      }, 3000);
    }
  };

  socket.onerror = (e) => {
    console.error("WS error", e);
  };

  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    const store = useGameStore.getState();

    switch (msg.event) {
      // lobby
      case "rooms_snapshot":
        store.setSnapshot(msg.items);
        break;

      case "room_created":
        store.addRoom(msg.room);
        break;

      case "room_removed":
        store.removeRoom(msg.room_id);
        break;

      case "room_updated":
        store.updateRoom(msg.room);
        break;

      case "game_invite":
        store.setIncomingGameInvite(msg);
        break;

      case "join_request":
        store.setIncomingJoinRequest(msg);
        break;

      case "game_hint":
        store.setGameHint(msg);
        break;

      // game
      case "game_snapshot":
        if (store.readyCheckActive || window.location.pathname !== "/game") {
          store.setVsScreenData(msg.players);
          store.setReadyCheckActive(false);
          setTimeout(() => {
            useGameStore.getState().setVsScreenData(null);
            if (window.location.pathname !== "/game") {
              navigate("/game");
            }
          }, 3500);
        } else {
          store.setReadyCheckActive(false);
        }
        store.setGameSnapshot(msg);
        break;

      case "your_hand":
        store.setYourHand(msg.cards);
        break;

      case "card_played":
        playCardDropSound();
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        }
        break;

      case "trick_won":
        store.setTrickWinner({
          position: msg.position,
          team: msg.team,
        });

        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        }

        setTimeout(() => {
          useGameStore.getState().clearTrickWinner();
        }, 1800);
        break;

      case "sponsor_action":
        useGameStore.getState().triggerSponsorAction(msg.from_id, msg.to_id);
        break;

      case "taunt":
        useGameStore.getState().triggerTauntAction(msg.position, msg.taunt_id);
        if (window.Telegram?.WebApp?.HapticFeedback) {
          window.Telegram.WebApp.HapticFeedback.impactOccurred('rigid');
        }
        break;

      case "player_disconnected":
        store.addDisconnectedPosition(msg.position);
        toast("Один из игроков временно отключился");
        break;
      case "player_reconnected":
        store.removeDisconnectedPosition(msg.position);
        toast("Игрок вернулся");
        break;

      case "spectator_count_updated":
        store.setSpectatorCount(msg.count);
        break;

      case "game_close":
        store.setGameCloseReason(msg.reason);
        toast(msg.reason || "Игра завершена");
        store.clearGame();

        setTimeout(() => {
          navigate("/find");
        }, 2000);
        break;

      case "game_over":
        store.setGameOver(true);
        store.setFinalScores(msg.scores);
        toast("Игра завершена");
        break;

      case "ready_check_started":
        store.setReadyCheckActive(true);
        store.setReadyExpiresAt(msg.expires_at);
        store.setReadyRoomId(msg.room_id);
        store.setReadyCheckPlayers(msg.players || []);
        store.setReadyPlayers([]);
        break;

      case "ready_check_update":
        store.setReadyPlayers(msg.ready_players);
        break;

      case "error":
        toast(msg.detail);
        store.setLastError(msg.detail);
        break;

      default:
        break;
    }
  };
}

export function getSocket() {
  return socket;
}

export function findGame() {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "findgame",
        stake: "0",
        currency: "Virtual",
        league: "Bronze",
      })
    );
  }
}

export function cancelGame() {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "cancelsearch",
        stake: "0",
        currency: "Virtual",
        league: "Bronze",
      })
    );
  }
}

export function playWithBots(difficulty, max_eyes) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "playwithbots",
        stake: "0",
        currency: "Virtual",
        league: "Bronze",
        difficulty,
        max_eyes,
      })
    );
  }
}

const rankToBackend = {
  Seven: "7",
  Eight: "8",
  Nine: "9",
  Ten: "10",
  Jack: "j",
  Queen: "q",
  King: "k",
  Ace: "a",
};

const suitToBackend = {
  Clubs: "c",
  Diamonds: "d",
  Hearts: "h",
  Spades: "s",
};

export function playCard(room_id, card) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      op: "playcard",
      room_id,
      rank: rankToBackend[card.rank],
      suit: suitToBackend[card.suit],
    }));
  }
}

export function sendTaunt(room_id, taunt_id) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ op: "taunt", room_id, taunt_id }));
  }
}

export function sendSponsor(room_id, target_id) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ op: "sponsorplayer", room_id, target_id }));
  }
}

export function createRoom({ stake, currency, league, name, password_hash }) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "createroom",
        stake: String(stake),
        currency,
        league,
        name: name || undefined,
        password_hash,
      })
    );
  }
}

export function sendjoinRoom(room_id, password = null, target_bot_id = null) {
  if (socket?.readyState === WebSocket.OPEN) {
    const payload = {
      op: "joinroom",
      room_id,
      target_bot_id,
    };
    if (password) {
      payload.password = password;
    }
    socket.send(JSON.stringify(payload));
  }
}

export function sendleaveRoom(room_id) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "leaveroom",
        room_id,
      })
    );
  }
}

export function subscribeRooms() {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "subscriberooms",
      })
    );
  }
}

export function spectateRoom(room_id) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "spectateroom",
        room_id,
      })
    );
  }
}

export function unspectateRoom(room_id) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "unspectateroom",
        room_id,
      })
    );
  }
}

export function surrenderRoom(room_id) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "surrenderroom",
        room_id,
      })
    );
  }
}

export function sendReady(room_id) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "ready",
        room_id,
      })
    );
  }
}


export function inviteFriend(room_id, friend_id, target_bot_id = null) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "invitefriend",
        room_id,
        friend_id,
        target_bot_id,
      })
    );
  }
}

export function requestToJoin(room_id) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "requesttojoin",
        room_id,
      })
    );
  }
}

export function acceptJoinRequest(room_id, target_id) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        op: "acceptjoinrequest",
        room_id,
        target_id,
      })
    );
  }
}
