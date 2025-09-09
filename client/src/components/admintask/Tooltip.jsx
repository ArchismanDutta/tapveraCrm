export default function Tooltip({ visible, position = {}, text }) {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 px-2 py-1 rounded-md bg-black text-[13px] text-white shadow-lg opacity-95 pointer-events-none"
      style={{
        top: position.top ?? 0,
        left: position.left ?? 0,
        transform: "translate(-50%, -120%)",
      }}
    >
      {text}
      {/* Arrow */}
      <div className="absolute left-1/2 bottom-0 w-2 h-2 bg-black rotate-45 -translate-x-1/2 translate-y-1/2"></div>
    </div>
  );
}
