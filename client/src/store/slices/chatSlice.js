import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  users: [],
  selectedUser: null,
  messagesByUser: {},
  typingUsers: {},
  newMessagesByUser: {},
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setUsers(state, action) {
      state.users = action.payload;
    },
    selectUser(state, action) {
      state.selectedUser = action.payload;
      // Clear new message highlight when selecting
      if (action.payload?._id) {
        delete state.newMessagesByUser[action.payload._id];
      }
    },
    addMessages(state, action) {
      const { userId, messages } = action.payload;
      if (!state.messagesByUser[userId]) {
        state.messagesByUser[userId] = [];
      }
      state.messagesByUser[userId] = [
        ...state.messagesByUser[userId],
        ...messages,
      ];
    },
    addMessage(state, action) {
      const { userId, message } = action.payload;
      if (!state.messagesByUser[userId]) {
        state.messagesByUser[userId] = [];
      }
      state.messagesByUser[userId].push(message);
      // Mark new message for user if not currently selected
      if (!state.selectedUser || userId !== state.selectedUser._id) {
        state.newMessagesByUser[userId] = true;
      }
    },
    setTypingUser(state, action) {
      // action.payload = userId
      state.typingUsers[action.payload] = true;
    },
    removeTypingUser(state, action) {
      delete state.typingUsers[action.payload];
    },
    clearNewMessages(state, action) {
      delete state.newMessagesByUser[action.payload];
    },
    resetChat(state) {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setUsers,
  resetChat,
  selectUser,
  addMessages,
  addMessage,
  setTypingUser,
  removeTypingUser,
  clearNewMessages,
} = chatSlice.actions;

export default chatSlice.reducer;
