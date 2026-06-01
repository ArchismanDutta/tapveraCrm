import React, { useState, useEffect, useRef } from 'react';
import { Search, Clock, Smile, Heart, Coffee, Flag, Activity, Sun, Music } from 'lucide-react';

/**
 * Enhanced emoji picker with categories, search, and recents
 */
const EmojiPickerEnhanced = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState([]);
  const pickerRef = useRef(null);

  const categories = {
    smileys: {
      icon: Smile,
      label: 'Smileys & People',
      emojis: [
        '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
        '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
        '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
        '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
        '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
        '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
        '🧐', '😕', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '😦',
        '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
        '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿',
        '💀', '💩', '🤡', '👻', '👽', '👾', '🤖', '😺', '😸', '😹',
        '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
        '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍',
        '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝',
        '🙏', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠',
      ],
    },
    nature: {
      icon: Coffee,
      label: 'Animals & Nature',
      emojis: [
        '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
        '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆',
        '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋',
        '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎',
        '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟',
        '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧',
        '🌸', '🌺', '🌻', '🌹', '🥀', '🌷', '🌼', '🌱', '🌲', '🌳',
        '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🪴',
        '🌍', '🌎', '🌏', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓',
        '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌈', '☀️', '⛅',
      ],
    },
    food: {
      icon: Coffee,
      label: 'Food & Drink',
      emojis: [
        '🍎', '🍏', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
        '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑',
        '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠',
        '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞',
        '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕',
        '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫',
        '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙',
        '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷',
        '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🥄', '🍴', '🍽️', '🥣',
        '🍰', '🧁', '🥧', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪',
      ],
    },
    activity: {
      icon: Activity,
      label: 'Activity & Sports',
      emojis: [
        '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
        '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
        '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷',
        '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺',
        '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗',
        '🚴', '🚵', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹',
        '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳',
        '🎮', '🎰', '🧩', '🎁', '🎀', '🎊', '🎉', '🎈', '🎏', '🎐',
      ],
    },
    travel: {
      icon: Flag,
      label: 'Travel & Places',
      emojis: [
        '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
        '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵',
        '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟',
        '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇',
        '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸',
        '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽',
        '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤',
        '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌',
        '🕍', '🛕', '🕋', '⛩️', '🛤️', '🛣️', '🗾', '🎑', '🏞️', '🌅',
        '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉',
      ],
    },
    objects: {
      icon: Sun,
      label: 'Objects',
      emojis: [
        '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
        '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️',
        '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️',
        '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌',
        '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶',
        '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️',
        '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓',
        '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿',
        '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '🩹', '🩺', '💊', '💉',
      ],
    },
    symbols: {
      icon: Heart,
      label: 'Symbols',
      emojis: [
        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
        '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
        '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
        '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
        '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
        '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️',
        '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️',
        '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️',
        '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓',
        '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️',
        '✅', '☑️', '🔘', '⚪', '⚫', '🔴', '🔵', '🟢', '🟡', '🟠',
      ],
    },
    flags: {
      icon: Flag,
      label: 'Flags',
      emojis: [
        '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏴‍☠️', '🇦🇫', '🇦🇱', '🇩🇿',
        '🇦🇩', '🇦🇴', '🇦🇮', '🇦🇶', '🇦🇬', '🇦🇷', '🇦🇲', '🇦🇼', '🇦🇺', '🇦🇹',
        '🇦🇿', '🇧🇸', '🇧🇭', '🇧🇩', '🇧🇧', '🇧🇾', '🇧🇪', '🇧🇿', '🇧🇯', '🇧🇲',
        '🇧🇹', '🇧🇴', '🇧🇦', '🇧🇼', '🇧🇷', '🇧🇳', '🇧🇬', '🇧🇫', '🇧🇮', '🇰🇭',
        '🇨🇲', '🇨🇦', '🇨🇻', '🇰🇾', '🇨🇫', '🇹🇩', '🇨🇱', '🇨🇳', '🇨🇴', '🇰🇲',
        '🇨🇬', '🇨🇩', '🇨🇷', '🇨🇮', '🇭🇷', '🇨🇺', '🇨🇾', '🇨🇿', '🇩🇰', '🇩🇯',
        '🇩🇲', '🇩🇴', '🇪🇨', '🇪🇬', '🇸🇻', '🇬🇶', '🇪🇷', '🇪🇪', '🇪🇹', '🇫🇯',
        '🇫🇮', '🇫🇷', '🇬🇦', '🇬🇲', '🇬🇪', '🇩🇪', '🇬🇭', '🇬🇷', '🇬🇩', '🇬🇺',
      ],
    },
  };

  // Load recent emojis from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('recentEmojis');
    if (stored) {
      try {
        setRecentEmojis(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading recent emojis:', e);
      }
    }
  }, []);

  // Save emoji to recents
  const addToRecents = (emoji) => {
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 30);
    setRecentEmojis(updated);
    localStorage.setItem('recentEmojis', JSON.stringify(updated));
  };

  const handleEmojiSelect = (emoji) => {
    addToRecents(emoji);
    onSelect(emoji);
  };

  // Filter emojis by search
  const getFilteredEmojis = () => {
    if (!searchQuery) return categories[activeCategory].emojis;

    const query = searchQuery.toLowerCase();
    return categories[activeCategory].emojis.filter(emoji => {
      // Simple emoji search by checking if it's in the query
      // In a real app, you'd have emoji names/descriptions to search
      return true;
    });
  };

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full mb-2 right-0 bg-[#202c33] border border-[#2a3942] rounded-xl shadow-2xl w-96 max-h-96 overflow-hidden z-50"
    >
      {/* Search */}
      <div className="p-3 border-b border-[#2a3942]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search emoji..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2 bg-[#111b21] text-white text-sm rounded-lg border border-[#2a3942] focus:border-[#00a884] focus:outline-none placeholder-gray-500"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1 p-2 border-b border-[#2a3942] overflow-x-auto">
        {recentEmojis.length > 0 && (
          <button
            onClick={() => setActiveCategory('recent')}
            className={`p-2 rounded-lg transition ${
              activeCategory === 'recent'
                ? 'bg-[#00a884] text-white'
                : 'text-gray-400 hover:bg-[#2a3942]'
            }`}
            title="Recent"
          >
            <Clock className="w-5 h-5" />
          </button>
        )}
        {Object.entries(categories).map(([key, cat]) => {
          const Icon = cat.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`p-2 rounded-lg transition ${
                activeCategory === key
                  ? 'bg-[#00a884] text-white'
                  : 'text-gray-400 hover:bg-[#2a3942]'
              }`}
              title={cat.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Emoji Grid */}
      <div className="p-3 overflow-y-auto max-h-64 bg-[#111b21]">
        {activeCategory === 'recent' ? (
          <div>
            <h3 className="text-xs text-gray-400 mb-2 font-medium">Recently Used</h3>
            <div className="grid grid-cols-8 gap-2">
              {recentEmojis.map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-2xl hover:bg-[#2a3942] rounded p-1 transition"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-xs text-gray-400 mb-2 font-medium">
              {categories[activeCategory].label}
            </h3>
            <div className="grid grid-cols-8 gap-2">
              {getFilteredEmojis().map((emoji, idx) => (
                <button
                  key={idx}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="text-2xl hover:bg-[#2a3942] rounded p-1 transition"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmojiPickerEnhanced;
