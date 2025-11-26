import React, { useState, useEffect } from "react";
import { X, Gift, Award, Heart, Star, Cake, Trophy, Sparkles } from "lucide-react";

const CelebrationPopup = ({ celebrations, isOpen, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen && celebrations.length > 0) {
      setIsVisible(true);
      setCurrentIndex(0);
    }
  }, [isOpen, celebrations]);

  const handleNext = () => {
    if (currentIndex < celebrations.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!isOpen || celebrations.length === 0) return null;

  const currentCelebration = celebrations[currentIndex];
  const isLastCelebration = currentIndex === celebrations.length - 1;

  const getBirthdayIcon = () => <Cake className="h-8 w-8 text-pink-400" />;
  const getAnniversaryIcon = () => <Trophy className="h-8 w-8 text-amber-400" />;

  const getBirthdayGradient = () => "from-pink-500/20 to-rose-500/20";
  const getAnniversaryGradient = () => "from-amber-500/20 to-orange-500/20";

  const getBirthdayBorder = () => "border-pink-500/30";
  const getAnniversaryBorder = () => "border-amber-500/30";

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`relative max-w-md w-full bg-gradient-to-br ${currentCelebration.type === 'birthday' ? getBirthdayGradient() : getAnniversaryGradient()} backdrop-blur-sm border ${currentCelebration.type === 'birthday' ? getBirthdayBorder() : getAnniversaryBorder()} rounded-2xl p-6 sm:p-8 transform transition-all duration-300 ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-8'} overflow-hidden`}>

        {/* Floating particles animation */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-2 h-2 ${currentCelebration.type === 'birthday' ? 'bg-pink-400' : 'bg-amber-400'} rounded-full animate-ping`}
              style={{
                left: `${20 + (i * 10)}%`,
                top: `${10 + (i * 8)}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: '2s'
              }}
            />
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/50 hover:bg-slate-700/50 text-gray-300 hover:text-white transition-all duration-200 z-10"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="text-center mb-6 relative z-10">
          <div className="flex justify-center mb-4">
            <div className={`p-4 rounded-full bg-gradient-to-br ${currentCelebration.type === 'birthday' ? 'from-pink-500 to-rose-600' : 'from-amber-500 to-orange-600'} shadow-lg`}>
              {currentCelebration.type === 'birthday' ? getBirthdayIcon() : getAnniversaryIcon()}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            {currentCelebration.type === 'birthday' ? '🎉 Birthday Celebration!' : '🎊 Work Anniversary!'}
          </h2>

          <div className="flex justify-center gap-1 mb-4">
            {[...Array(celebrations.length)].map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? currentCelebration.type === 'birthday' ? 'bg-pink-400' : 'bg-amber-400'
                    : 'bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* User Info */}
        <div className="text-center mb-6 relative z-10">
          <div className="mb-4">
            <img
              src={currentCelebration.user.avatar}
              alt={currentCelebration.user.name}
              className="w-20 h-20 rounded-full mx-auto border-4 border-white/20 shadow-lg"
            />
          </div>

          <h3 className="text-xl font-semibold text-white mb-1 break-words px-2">
            {currentCelebration.user.name}
          </h3>

          <p className="text-gray-300 text-sm mb-2 break-words px-2">
            {currentCelebration.user.designation} • {currentCelebration.user.department}
          </p>

          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${currentCelebration.type === 'birthday' ? 'bg-pink-500/30' : 'bg-amber-500/30'} text-white font-medium whitespace-nowrap`}>
            {currentCelebration.type === 'birthday' ? (
              <>
                <Gift className="h-4 w-4 flex-shrink-0" />
                <span>Turning {currentCelebration.age} today!</span>
              </>
            ) : (
              <>
                <Award className="h-4 w-4 flex-shrink-0" />
                <span>{currentCelebration.years} years with us!</span>
              </>
            )}
          </div>
        </div>

        {/* Message */}
        <div className="text-center mb-6 relative z-10">
          <p className="text-lg text-gray-200 mb-4 break-words px-2">
            {currentCelebration.message}
          </p>

          <div className="flex justify-center gap-2">
            {currentCelebration.type === 'birthday' ? (
              <>
                <Heart className="h-5 w-5 text-pink-400 animate-pulse" />
                <Sparkles className="h-5 w-5 text-pink-400 animate-pulse" />
                <Heart className="h-5 w-5 text-pink-400 animate-pulse" />
              </>
            ) : (
              <>
                <Star className="h-5 w-5 text-amber-400 animate-pulse" />
                <Trophy className="h-5 w-5 text-amber-400 animate-pulse" />
                <Star className="h-5 w-5 text-amber-400 animate-pulse" />
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 relative z-10">
          {!isLastCelebration && (
            <button
              onClick={handleNext}
              className={`flex-1 py-3 px-4 bg-gradient-to-r ${currentCelebration.type === 'birthday' ? 'from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700' : 'from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'} text-white rounded-xl font-medium transition-all duration-300 hover:scale-105 whitespace-nowrap overflow-hidden text-ellipsis`}
            >
              <span className="block truncate">
                Next Celebration ({celebrations.length - currentIndex - 1} more)
              </span>
            </button>
          )}

          <button
            onClick={handleClose}
            className="flex-1 py-3 px-4 bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 hover:text-white rounded-xl font-medium transition-all duration-300 whitespace-nowrap overflow-hidden text-ellipsis"
          >
            <span className="block truncate">
              {isLastCelebration ? 'Continue to Dashboard' : 'Skip All'}
            </span>
          </button>
        </div>

        {/* Footer */}
        <div className="text-center mt-4 relative z-10">
          <p className="text-xs text-gray-400">
            Spread joy and celebrate together! 🎉
          </p>
        </div>
      </div>
    </div>
  );
};

export default CelebrationPopup;