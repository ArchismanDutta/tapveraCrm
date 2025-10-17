import { useState, useEffect } from "react";
import { Sparkles, X } from "lucide-react";

const DiyaLamp = ({ delay = 0 }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative cursor-pointer transition-transform hover:scale-110"
      style={{ animationDelay: `${delay}ms` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`absolute inset-0 rounded-full transition-all duration-700 ${
          isHovered ? "opacity-100 scale-[2]" : "opacity-70 scale-125"
        }`}
        style={{
          background: "radial-gradient(circle, rgba(255, 193, 7, 0.8), rgba(255, 152, 0, 0.6), transparent 70%)",
          filter: "blur(25px)",
        }}
      />
      <div
        className={`absolute inset-0 rounded-full transition-all duration-500 ${
          isHovered ? "opacity-80 scale-150" : "opacity-50 scale-100"
        }`}
        style={{
          background: "radial-gradient(circle, rgba(255, 215, 0, 0.7), transparent 60%)",
          filter: "blur(15px)",
          animation: "pulse 2s ease-in-out infinite",
        }}
      />
      
      <div className="relative w-16 h-16 flex items-center justify-center">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
          <ellipse
            cx="50"
            cy="70"
            rx="35"
            ry="15"
            fill="#ff6b35"
            stroke="#ffd700"
            strokeWidth="2"
          />
          <path
            d="M 15 70 Q 10 65, 15 60 L 25 65 Z"
            fill="#ff6b35"
            stroke="#ffd700"
            strokeWidth="1.5"
          />
          
          <g style={{ animation: "flicker 1.5s ease-in-out infinite" }}>
            <ellipse cx="50" cy="45" rx="8" ry="20" fill="#ffc107" opacity="0.8" />
            <ellipse cx="50" cy="45" rx="5" ry="15" fill="#ffd700" />
            <ellipse cx="50" cy="50" rx="3" ry="8" fill="#ff6b35" />
          </g>
          
          <rect x="48" y="55" width="4" height="10" fill="#3e2723" rx="1" />
        </svg>
      </div>

      {isHovered && (
        <>
          <div className="absolute -top-2 left-1/2 w-3 h-3 rounded-full" 
            style={{ 
              background: "radial-gradient(circle, #ffc107, #ffd700)",
              animation: "float-up 2s ease-out infinite"
            }} />
          <div className="absolute top-0 right-2 w-2 h-2 rounded-full" 
            style={{ 
              animationDelay: "0.2s",
              background: "radial-gradient(circle, #ff6b35, #ff5722)",
              animation: "float-up 2s ease-out infinite"
            }} />
          <div className="absolute top-2 left-2 w-2 h-2 rounded-full" 
            style={{ 
              animationDelay: "0.4s",
              background: "radial-gradient(circle, #e91e63, #ec407a)",
              animation: "float-up 2s ease-out infinite"
            }} />
        </>
      )}
    </div>
  );
};

const Firework = ({ x, y, onComplete }) => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const colors = ["#ffd700", "#ffc107", "#ff6b35", "#ff5722", "#e91e63", "#ec407a", "#9c27b0", "#673ab7"];
    const newParticles = [];
    let id = 0;
    
    for (let i = 0; i < 32; i++) {
      newParticles.push({
        id: id++,
        angle: (i * 360) / 32,
        color: colors[Math.floor(Math.random() * colors.length)],
        distance: 120 + Math.random() * 80,
        delay: 0,
        size: 4,
        duration: 1.8,
      });
    }
    
    for (let i = 0; i < 24; i++) {
      newParticles.push({
        id: id++,
        angle: (i * 360) / 24 + 15,
        color: colors[Math.floor(Math.random() * colors.length)],
        distance: 80 + Math.random() * 60,
        delay: 0.1,
        size: 3,
        duration: 1.5,
      });
    }
    
    for (let i = 0; i < 40; i++) {
      newParticles.push({
        id: id++,
        angle: Math.random() * 360,
        color: colors[Math.floor(Math.random() * colors.length)],
        distance: 60 + Math.random() * 100,
        delay: 0.15,
        size: 2,
        duration: 1.3,
      });
    }

    setParticles(newParticles);

    const timeout = setTimeout(() => {
      onComplete();
    }, 2000);

    return () => clearTimeout(timeout);
  }, [onComplete]);

  return (
    <div className="fixed pointer-events-none z-50" style={{ left: x, top: y }}>
      <div 
        className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full"
        style={{
          background: "radial-gradient(circle, #ffc107, #ffd700, transparent)",
          boxShadow: "0 0 80px #ffd700, 0 0 120px #ff6b35",
          animation: "scale-in 0.2s ease-out, fade-out 0.4s ease-out 0.1s forwards",
        }}
      />
      
      <div 
        className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2"
        style={{
          borderColor: "#ffd700",
          animation: "ping 0.8s cubic-bezier(0, 0, 0.2, 1)",
        }}
      />
      
      {particles.map((particle) => {
        const rad = (particle.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * particle.distance;
        const ty = Math.sin(rad) * particle.distance;
        
        return (
          <div
            key={particle.id}
            className="absolute rounded-full"
            style={{
              width: `${particle.size * 4}px`,
              height: `${particle.size * 4}px`,
              marginLeft: `${-particle.size * 2}px`,
              marginTop: `${-particle.size * 2}px`,
              backgroundColor: particle.color,
              boxShadow: `0 0 ${particle.size * 8}px ${particle.color}, 0 0 ${particle.size * 16}px ${particle.color}`,
              animation: `explode ${particle.duration}s ease-out forwards`,
              animationDelay: `${particle.delay}s`,
              "--tx": `${tx}px`,
              "--ty": `${ty}px`,
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${particle.color}, transparent 70%)`,
                filter: "blur(2px)",
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

const FloatingParticles = () => {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const colors = ["#ffd700", "#ffc107", "#ff6b35", "#ff9800", "#e91e63", "#ec407a"];
    const newParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 6 + 2,
      duration: Math.random() * 5 + 4,
      delay: Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full opacity-70"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            background: `radial-gradient(circle, ${particle.color}, transparent)`,
            boxShadow: `0 0 ${particle.size * 3}px ${particle.color}, 0 0 ${particle.size * 5}px ${particle.color}`,
            animation: `float-particle ${particle.duration}s ease-in-out ${particle.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
};

const RangoliPattern = () => {
  return (
    <div className="absolute inset-0 opacity-15 pointer-events-none overflow-hidden">
      <svg
        className="w-full h-full"
        viewBox="0 0 200 200"
        style={{ 
          transformOrigin: "center",
          animation: "rotate-slow 60s linear infinite"
        }}
      >
        <defs>
          <radialGradient id="petalGradient">
            <stop offset="0%" stopColor="#e91e63" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#9c27b0" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="goldGradient">
            <stop offset="0%" stopColor="#ffd700" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ff6b35" stopOpacity="0.6" />
          </radialGradient>
        </defs>
        
        {Array.from({ length: 12 }).map((_, i) => (
          <g key={`petal-${i}`} transform={`rotate(${i * 30} 100 100)`}>
            <ellipse
              cx="100"
              cy="45"
              rx="18"
              ry="35"
              fill="url(#petalGradient)"
              opacity="0.7"
            />
          </g>
        ))}
        
        <circle cx="100" cy="100" r="25" fill="none" stroke="url(#goldGradient)" strokeWidth="3" opacity="0.8" />
        <circle cx="100" cy="100" r="15" fill="#ffd700" opacity="0.6" />
        
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i * 360) / 16;
          const rad = (angle * Math.PI) / 180;
          const x = 100 + Math.cos(rad) * 75;
          const y = 100 + Math.sin(rad) * 75;
          
          return (
            <circle
              key={`dot-${i}`}
              cx={x}
              cy={y}
              r="5"
              fill={i % 2 === 0 ? "#ff6b35" : "#ec407a"}
              opacity="0.85"
            />
          );
        })}
        
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * 360) / 8;
          const rad = (angle * Math.PI) / 180;
          const x1 = 100 + Math.cos(rad) * 85;
          const y1 = 100 + Math.sin(rad) * 85;
          const x2 = 100 + Math.cos(rad) * 95;
          const y2 = 100 + Math.sin(rad) * 95;
          
          return (
            <line
              key={`ray-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#ffd700"
              strokeWidth="2"
              opacity="0.7"
            />
          );
        })}
      </svg>
    </div>
  );
};

export default function DiwaliWelcome({ onClose }) {
  const [fireworks, setFireworks] = useState([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Auto-trigger fireworks
    const fireworkInterval = setInterval(() => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * (window.innerHeight * 0.6);
      setFireworks(prev => [...prev, { id: Date.now(), x, y }]);
    }, 1500);

    return () => clearInterval(fireworkInterval);
  }, []);

  const handleClick = (e) => {
    const x = e.clientX;
    const y = e.clientY;
    setFireworks(prev => [...prev, { id: Date.now(), x, y }]);
  };

  const removeFirework = (id) => {
    setFireworks(prev => prev.filter(f => f.id !== id));
  };

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @keyframes flicker {
          0%, 100% { transform: scaleY(1); opacity: 1; }
          50% { transform: scaleY(0.95); opacity: 0.9; }
        }
        @keyframes float-up {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-100px) scale(0); opacity: 0; }
        }
        @keyframes explode {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        @keyframes scale-in {
          0% { transform: scale(0); }
          100% { transform: scale(1); }
        }
        @keyframes fade-out {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes ping {
          75%, 100% { transform: scale(4); opacity: 0; }
        }
        @keyframes float-particle {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(10px, -20px) rotate(90deg); }
          50% { transform: translate(-5px, -40px) rotate(180deg); }
          75% { transform: translate(-15px, -20px) rotate(270deg); }
        }
        @keyframes rotate-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes gradient-shift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }
      `}</style>

      <div 
        className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer"
        onClick={handleClick}
        style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 25%, #312e81 50%, #1e1b4b 75%, #0f172a 100%)",
          backgroundSize: "400% 400%",
          animation: "gradient-shift 15s ease infinite"
        }}
      >
        {/* Animated Background Elements */}
        <FloatingParticles />
        <RangoliPattern />
        
        {/* Fireworks */}
        {fireworks.map(fw => (
          <Firework key={fw.id} x={fw.x} y={fw.y} onComplete={() => removeFirework(fw.id)} />
        ))}

        {/* Main Content Card */}
        <div className="relative z-10 max-w-4xl mx-auto px-6">
          <div 
            className="relative bg-gradient-to-br from-slate-900/90 via-purple-900/80 to-slate-900/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-yellow-500/30 overflow-hidden"
            style={{
              boxShadow: "0 0 100px rgba(234, 179, 8, 0.3), 0 0 200px rgba(234, 179, 8, 0.2), inset 0 0 100px rgba(234, 179, 8, 0.1)"
            }}
          >
            {/* Shimmer Effect */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.5), transparent)",
                backgroundSize: "1000px 100%",
                animation: "shimmer 3s infinite"
              }}
            />

            {/* Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="absolute top-6 right-6 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 border border-white/20 transition-all duration-300 hover:scale-110 hover:rotate-90 group"
            >
              <X className="w-5 h-5 text-white group-hover:text-yellow-400" />
            </button>

            <div className="relative z-10 p-12">
              {/* Diya Lamps Row */}
              <div className="flex justify-center gap-8 mb-8">
                {[0, 100, 200, 300, 400].map((delay) => (
                  <DiyaLamp key={delay} delay={delay} />
                ))}
              </div>

              {/* Main Heading with Gradient */}
              <div className="text-center mb-6">
                <h1 
                  className="text-7xl font-bold mb-4 leading-tight"
                  style={{
                    background: "linear-gradient(45deg, #ffd700, #ffc107, #ff6b35, #ff5722, #e91e63, #ffd700)",
                    backgroundSize: "300% 300%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    animation: "gradient-shift 3s ease infinite"
                  }}
                >
                  शुभ दीपावली
                </h1>
                <h2 className="text-5xl font-bold text-white mb-3" style={{ textShadow: "0 0 30px rgba(255, 215, 0, 0.5)" }}>
                  Happy Diwali 2025
                </h2>
                <div className="flex items-center justify-center gap-3 text-yellow-400">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                  <p className="text-xl font-medium">
                    Festival of Lights
                  </p>
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              {/* Beautiful Message Box */}
              <div className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 rounded-2xl p-8 mb-8 border border-yellow-500/20">
                <p className="text-white text-xl leading-relaxed text-center font-light">
                  May the divine light of <span className="font-semibold text-yellow-400">Diwali</span> illuminate your path to 
                  <span className="font-semibold text-orange-400"> success</span> and 
                  <span className="font-semibold text-pink-400"> prosperity</span>. 
                  <br />
                  Wishing you and your family a joyous festival filled with 
                  <span className="font-semibold text-purple-400"> love</span>, 
                  <span className="font-semibold text-blue-400"> laughter</span>, and 
                  <span className="font-semibold text-green-400"> endless blessings</span>! ✨
                </p>
              </div>

              {/* Decorative Elements */}
              <div className="flex justify-center items-center gap-6 mb-6">
                <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
                <div className="text-4xl">🪔</div>
                <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-yellow-500 to-transparent"></div>
              </div>

              {/* Interactive Hint */}
              <div className="text-center">
                <p className="text-yellow-300/80 text-sm font-medium animate-pulse">
                  ✨ Click anywhere to burst fireworks! ✨
                </p>
                <p className="text-white/60 text-xs mt-2">
                  This special celebration will be visible until Monday
                </p>
              </div>

              {/* Bottom Diya Lamps */}
              <div className="flex justify-center gap-12 mt-8">
                {[500, 600, 700].map((delay) => (
                  <DiyaLamp key={delay} delay={delay} />
                ))}
              </div>
            </div>

            {/* Decorative Corner Elements */}
            <div className="absolute top-0 left-0 w-32 h-32 opacity-30">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-transparent rounded-br-full"></div>
            </div>
            <div className="absolute bottom-0 right-0 w-32 h-32 opacity-30">
              <div className="absolute inset-0 bg-gradient-to-tl from-orange-400 to-transparent rounded-tl-full"></div>
            </div>
          </div>

          {/* Bottom Instruction */}
          <div className="text-center mt-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-8 py-3 bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 hover:from-yellow-600 hover:via-orange-600 hover:to-yellow-600 text-white font-semibold rounded-full shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-yellow-500/50"
              style={{
                boxShadow: "0 0 30px rgba(234, 179, 8, 0.5)"
              }}
            >
              Continue to Dashboard →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}