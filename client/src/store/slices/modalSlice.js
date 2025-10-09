import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  detailTask: null,
};

const modalSlice = createSlice({
  name: "modal",
  initialState,
  reducers: {
    openDetailModal: (state, action) => {
      state.detailTask = action.payload;
    },
    closeDetailModal: (state) => {
      state.detailTask = null;
    },
  },
});

export const { openDetailModal, closeDetailModal } = modalSlice.actions;
export default modalSlice.reducer;
