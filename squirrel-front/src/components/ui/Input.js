export default function Input({ type, placeholder, onFocus, onBlur }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      onFocus={onFocus}
      onBlur={onBlur}
      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
    />
  );
}
