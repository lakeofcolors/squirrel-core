import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
          <h2 className="text-3xl font-black mb-4 text-red-500">Ой! Что-то пошло не так.</h2>
          <p className="text-gray-400 mb-6 text-center max-w-md">Произошла непредвиденная ошибка в интерфейсе. Пожалуйста, перезагрузите страницу.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-bold transition-colors"
          >
            Перезагрузить страницу
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
