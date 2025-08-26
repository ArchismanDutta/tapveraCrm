// client/src/store/index.js
import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "./slices/chatSlice";
// Other reducers...

export default configureStore({
  reducer: {
    chat: chatReducer,
    // user: userReducer, etc.
  },
});
