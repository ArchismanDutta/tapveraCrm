import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "./slices/chatSlice";
import modalReducer from "./slices/modalSlice"; // import the modal slice

export default configureStore({
  reducer: {
    chat: chatReducer,
    modal: modalReducer, // add modal slice here
    // other reducers...
  },
});
