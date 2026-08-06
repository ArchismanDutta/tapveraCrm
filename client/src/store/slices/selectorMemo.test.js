import { describe, it, expect } from "vitest";
import reducer, {
  selectMessages, selectPending, selectUnread, selectTotalUnread, threadKey,
  fetchMessages,
} from "./threadsSlice";

const KEY = threadKey("chat", "t1");
const seed = (messages) =>
  reducer(undefined, {
    type: fetchMessages.fulfilled.type,
    payload: { key: KEY, messages, pagination: null },
    meta: { arg: { scope: "chat", threadId: "t1" } },
  });
const wrap = (threads) => ({ threads });
const msg = (id, status) => ({ _id: id, timestamp: new Date(1000).toISOString(), status });

describe("selector memoisation", () => {
  it("returns the SAME selector instance for the same thread", () => {
    expect(selectMessages("chat", "t1")).toBe(selectMessages("chat", "t1"));
    expect(selectPending("chat", "t1")).toBe(selectPending("chat", "t1"));
    expect(selectTotalUnread("chat")).toBe(selectTotalUnread("chat"));
  });

  it("returns DIFFERENT instances for different threads", () => {
    expect(selectMessages("chat", "t1")).not.toBe(selectMessages("chat", "t2"));
    expect(selectMessages("chat", "t1")).not.toBe(selectMessages("project", "t1"));
  });

  it("selectPending returns a stable reference when nothing changed", () => {
    const s = wrap(seed([msg("m1", "sent"), msg("m2", "sending")]));
    const sel = selectPending("chat", "t1");
    expect(sel(s)).toBe(sel(s));           // the bug: this used to be a new array
    expect(sel(s).map((m) => m._id)).toEqual(["m2"]);
  });

  it("selectPending returns the shared EMPTY when nothing is pending", () => {
    const s = wrap(seed([msg("m1", "sent")]));
    const sel = selectPending("chat", "t1");
    expect(sel(s)).toBe(sel(s));
    expect(sel(s)).toHaveLength(0);
  });

  it("selectPending DOES recompute when the thread changes", () => {
    const sel = selectPending("chat", "t1");
    const before = sel(wrap(seed([msg("m1", "sent")])));
    const after = sel(wrap(seed([msg("m1", "sent"), msg("m2", "failed")])));
    expect(after).not.toBe(before);
    expect(after.map((m) => m._id)).toEqual(["m2"]);
  });

  it("plain lookups still read the right value", () => {
    const s = wrap(seed([msg("m1", "sent")]));
    expect(selectMessages("chat", "t1")(s).map((m) => m._id)).toEqual(["m1"]);
    expect(selectUnread("chat", "t1")(s)).toBe(0);
  });

  it("selectTotalUnread sums only its own scope", () => {
    const s = wrap({ ...seed([]), unreadByKey: { "chat:a": 2, "chat:b": 3, "project:c": 9 } });
    expect(selectTotalUnread("chat")(s)).toBe(5);
    expect(selectTotalUnread("project")(s)).toBe(9);
  });
});
