// utils/projectProgress.js
//
// Computes a project's completion percentage from the tasks linked to it.
// A task counts toward the total as soon as it exists on the project; it
// only counts toward "completed" when its status is exactly "completed".
// Tasks that are pending, in-progress, or rejected all count as not-yet-done
// (a rejected task still needs to be redone, so it shouldn't inflate progress).
//
// Task.status enum (server/models/Task.js): "pending" | "in-progress" | "completed" | "rejected"

export function getTaskProgress(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const total = list.length;
  const completed = list.filter((t) => t?.status === "completed").length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { percent, completed, total };
}
