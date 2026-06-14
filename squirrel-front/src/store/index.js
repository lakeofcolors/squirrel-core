import { create } from "zustand";

function normalizeRoom(r) {
  return {
    id: r.id,
    roomName: r.name,
    prizeMoney: r.key.stake,
    playersConnected: r.players.length,
    maxPlayers: 4,
    isRanked: true,
    isPrivate: r.kind !== "Open",
    players: r.players.map((p) => ({
      id: p.id,
      avatar: p.photo_url,
      username: p.username,
      rating: p.rating,
    })),
  };
}

export const useGameStore = create((set, get) => ({
  access_token: null,
  setToken: (access_token) => set({ access_token }),

  user: null,
  setUser: (user) => set({ user }),
  logout: () => set({ user: null }),

  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),

  friendRequestsCount: 0,
  setFriendRequestsCount: (count) => set({ friendRequestsCount: count }),

  incomingGameInvite: null,
  setIncomingGameInvite: (invite) => set({ incomingGameInvite: invite }),
  clearIncomingGameInvite: () => set({ incomingGameInvite: null }),

  incomingJoinRequest: null,
  setIncomingJoinRequest: (req) => set({ incomingJoinRequest: req }),
  clearIncomingJoinRequest: () => set({ incomingJoinRequest: null }),

  lastError: null,
  setLastError: (lastError) => set({ lastError }),

  rooms: {},
  setSnapshot: (items) =>
    set({
      rooms: Object.fromEntries(items.map((r) => [r.id, normalizeRoom(r)])),
    }),

  addRoom: (roomMeta) =>
    set((s) => ({
      rooms: {
        ...s.rooms,
        [roomMeta.id]: normalizeRoom(roomMeta),
      },
    })),

  removeRoom: (roomId) =>
    set((s) => {
      const next = { ...s.rooms };
      delete next[roomId];
      return { rooms: next };
    }),

  updateRoom: (roomMeta) =>
    set((s) => ({
      rooms: {
        ...s.rooms,
        [roomMeta.id]: normalizeRoom(roomMeta),
      },
    })),

  current_game_room: null,
  setCurrentGameRoom: (roomId) => set({ current_game_room: roomId }),

  gameOver: false,
  setGameOver: (value) => set({ gameOver: value }),

  // Полное состояние игры
  gameSnapshot: null,
  yourHand: [],
  trickWinner: null,
  gameHint: null,
  disconnectedPositions: [],
  gameCloseReason: null,
  isSpectating: false,
  spectatorCount: 0,
  readyCheckActive: false,
  readyPlayers: [],
  readyExpiresAt: null,
  readyRoomId: null,
  readyCheckPlayers: [],
  vsScreenData: null,

  setVsScreenData: (data) => set({ vsScreenData: data }),
  setReadyCheckActive: (active) => set({ readyCheckActive: active }),
  setReadyPlayers: (players) => set({ readyPlayers: players }),
  setReadyExpiresAt: (time) => set({ readyExpiresAt: time }),
  setReadyRoomId: (id) => set({ readyRoomId: id }),
  setReadyCheckPlayers: (players) => set({ readyCheckPlayers: players }),

  setGameSnapshot: (snapshot) =>
    set({
      gameSnapshot: snapshot,
      current_game_room: snapshot?.room_id || null,
    }),

  setYourHand: (cards) => set({ yourHand: cards }),

  setGameHint: (hint) => set({ gameHint: hint }),

  setTrickWinner: (payload) => set({ trickWinner: payload }),
  clearTrickWinner: () => set({ trickWinner: null }),

    addDisconnectedPosition: (position) =>
    set((s) =>
        s.disconnectedPositions.includes(position)
        ? s
        : { disconnectedPositions: [...s.disconnectedPositions, position] }
    ),
    removeDisconnectedPosition: (position) =>
    set((s) => ({
        disconnectedPositions: s.disconnectedPositions.filter((p) => p !== position),
    })),

    clearDisconnectedPositions: () => set({ disconnectedPositions: [] }),

  setGameCloseReason: (reason) => set({ gameCloseReason: reason }),
    finalScores: null,
    setFinalScores: (scores) => set({ finalScores: scores }),
    setIsSpectating: (value) => set({ isSpectating: value }),
    setSpectatorCount: (value) => set({ spectatorCount: value }),

    activeTaunts: {},
    activeThrows: [],
    triggerSponsorAction: (from_id, to_id) => {
      const id = Date.now() + Math.random();
      set((s) => ({
        activeThrows: [...s.activeThrows, { id, from_id, to_id }]
      }));
      setTimeout(() => {
        set((s) => ({
          activeThrows: s.activeThrows.filter(t => t.id !== id)
        }));
      }, 1500);
    },

    triggerTauntAction: (position, taunt_id) => {
      set((s) => ({
        activeTaunts: { ...s.activeTaunts, [position]: taunt_id }
      }));
      setTimeout(() => {
        set((s) => {
          const next = { ...s.activeTaunts };
          delete next[position];
          return { activeTaunts: next };
        });
      }, 2500);
    },

  clearGame: () =>
    set({
      current_game_room: null,
      gameSnapshot: null,
      yourHand: [],
      gameHint: null,
      trickWinner: null,
      disconnectedPosition: null,
      gameCloseReason: null,
      gameOver: false,
      disconnectedPositions: [],
      finalScores: null,
      isSpectating: false,
      spectatorCount: 0,
      readyCheckActive: false,
      readyPlayers: [],
      readyExpiresAt: null,
      readyRoomId: null,
      readyCheckPlayers: [],
    }),

  // derived helpers
  myPlayerInfo: () => {
    const state = get();
    const userId = state.user?.id;
    const players = state.gameSnapshot?.players || [];
    return players.find((p) => p.meta.id === userId) || null;
  },

  myPosition: () => {
    return get().myPlayerInfo()?.position || null;
  },

  isMyTurn: () => {
    const state = get();
    const myPos = state.myPosition();
    return !!myPos && state.gameSnapshot?.current_turn === myPos;
  },
}));
