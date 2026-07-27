import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "./slices/chatSlice";
import modalReducer from "./slices/modalSlice"; // import the modal slice
import notificationsReducer from "./slices/notificationSlice";

export default configureStore({
  reducer: {
    chat: chatReducer,
    modal: modalReducer, // add modal slice here
    notifications: notificationsReducer,
    // other reducers...
  },
});
