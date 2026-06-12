export default function Button({ type, children }) {
  return (
    <button
      type={type}
      className="w-full py-2 bg-orange-400 text-white font-bold rounded-lg hover:bg-orange-500 transition"
    >
      {children}
    </button>
  );
}
