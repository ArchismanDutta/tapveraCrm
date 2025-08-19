const InfoModal = ({ show, onClose, title, message, cancelButton, onCancel }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50">
      <div className="bg-white rounded-2xl shadow-xl w-96 max-w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition text-xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="space-y-2 text-gray-700 text-sm">
          {message.split("\n").map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {cancelButton && (
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg shadow hover:bg-gray-100 transition"
            >
              Cancel
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-yellow-400 border-2 border-orange-500 text-black font-medium rounded-lg shadow hover:bg-orange-500 hover:text-white transition"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
