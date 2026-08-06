import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "./slices/chatSlice";
import modalReducer from "./slices/modalSlice"; // import the modal slice
import notificationsReducer from "./slices/notificationSlice";
// Phase 2: single source of truth for BOTH messaging surfaces (ChatPage and
// ProjectMessagePanel), keyed "<scope>:<id>". Replaces the component useState +
// sessionStorage + window.CustomEvent bus that ChatPage and ProjectMessagePanel
// use today. Added alongside the old paths — nothing reads it until Phase 3.
import threadsReducer from "./slices/threadsSlice";
// Online / last-seen (S3). Server-driven; see services/messaging/presence.js.
import presenceReducer from "./slices/presenceSlice";

export default configureStore({
  reducer: {
    chat: chatReducer,
    modal: modalReducer, // add modal slice here
    notifications: notificationsReducer,
    threads: threadsReducer,
    presence: presenceReducer,
    // other reducers...
  },
  middleware: (getDefault) =>
    // Message objects carry Date instances and, once optimistic sending lands
    // (S2), File objects in the outbox. Both trip the serializability check,
    // which is a dev-only warning but a very noisy one.
    getDefault({
      serializableCheck: {
        ignoredActions: ["threads/sendMessage/pending"],
        ignoredPaths: ["threads.messagesByKey"],
      },
    }),
});
