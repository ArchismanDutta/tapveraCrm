// models/Notepad.js
const mongoose = require("mongoose");

const NotepadSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // Each user has one notepad
      index: true
    },
    content: {
      type: String,
      default: "",
      maxlength: 50000 // 50KB character limit for notepad
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    metadata: {
      characterCount: {
        type: Number,
        default: 0
      },
      wordCount: {
        type: Number,
        default: 0
      },
      lineCount: {
        type: Number,
        default: 0
      }
    },
    history: [
      {
        content: {
          type: String,
          maxlength: 50000
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Update metadata and history before saving
NotepadSchema.pre("save", function (next) {
  if (this.isModified("content")) {
    // Save current content to history before updating
    if (this.content && this.content.trim().length > 0) {
      // Add to history array
      this.history.unshift({
        content: this.content,
        timestamp: new Date()
      });

      // Keep only last 5 versions
      if (this.history.length > 5) {
        this.history = this.history.slice(0, 5);
      }
    }

    this.lastModified = new Date();
    this.metadata.characterCount = this.content.length;
    this.metadata.wordCount = this.content.trim().split(/\s+/).filter(word => word.length > 0).length;
    this.metadata.lineCount = this.content.split('\n').length;
  }
  next();
});

// Instance method to update content
NotepadSchema.methods.updateContent = function (newContent) {
  this.content = newContent;
  return this.save();
};

// Static method to get or create notepad for user
NotepadSchema.statics.getOrCreateNotepad = async function (userId) {
  let notepad = await this.findOne({ userId });

  if (!notepad) {
    notepad = await this.create({ userId, content: "" });
  }

  return notepad;
};

module.exports = mongoose.model("Notepad", NotepadSchema);
