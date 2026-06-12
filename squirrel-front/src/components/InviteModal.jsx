import React from 'react';
import { useGameStore } from '../store';
import { sendjoinRoom } from '../ws/client';
import { toast } from 'react-toastify';

export default function InviteModal() {
  const invite = useGameStore((s) => s.incomingGameInvite);
  const clearInvite = useGameStore((s) => s.clearIncomingGameInvite);

  if (!invite) return null;

  const handleAccept = () => {
    sendjoinRoom(invite.room_id, null, invite.target_bot_id);
    clearInvite();
    toast.success("Присоединение к комнате...", { theme: "dark" });
  };

  const handleDecline = () => {
    clearInvite();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a0a14]/90 backdrop-blur-md px-4 p-4 animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-purple-500/30 bg-black shadow-[0_0_80px_rgba(168,85,247,0.3)]">
        {/* Glow */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-purple-600/30 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-pink-600/20 blur-[80px] rounded-full pointer-events-none" />

        <div className="relative z-10 p-6 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 p-1 shadow-lg shadow-purple-500/50 mb-4">
            <img
              src={invite.from?.photo_url || "https://api.dicebear.com/7.x/thumbs/svg?seed=squirrel"}
              alt="avatar"
              className="w-full h-full rounded-full object-cover bg-black"
            />
          </div>
          
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-pink-400 mb-2 text-center leading-tight">
            Приглашение в игру!
          </h2>
          
          <p className="text-gray-300 text-center mb-6 font-medium">
            <span className="font-bold text-white text-lg">{invite.from?.username || "Игрок"}</span> зовет вас играть!
          </p>

          <div className="flex w-full space-x-3">
            <button
              onClick={handleDecline}
              className="flex-1 py-3 px-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold transition-colors border border-gray-600/50"
            >
              Скрыться 🙈
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 py-3 px-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-black shadow-lg shadow-pink-500/30 transition-all border border-pink-400/50 active:scale-95"
            >
              Ворваться 🚀
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
