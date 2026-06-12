import React, { useState, useEffect, useRef } from "react";
import API from "../../api";
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// ── Render text with clickable URL highlights ──────────────────────────────────
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function RichTextPreview({ text }) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <div className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        URL_REGEX.lastIndex = 0;
        return URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors break-all"
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-3 h-3 flex-shrink-0 inline" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd"/>
            </svg>
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </div>
  );
}

function hasUrl(text) {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

const TaskForm = ({ onCreate, users = [] }) => {
  const [task, setTask] = useState({
    title: "",
    assignedTo: [],
    dueDate: null, // use Date object here, not string
    dueTime: "",
    priority: "",
    status: "pending",
    description: "",
    project: null, // optional project reference
  });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const [timeOpen, setTimeOpen] = useState(false);
  const timeRef = useRef(null);

  // Project-related state
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const projectDropdownRef = useRef(null);

  // Fetch projects based on user access
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await API.get("/api/projects?limit=10000");
        // endpoint returns { projects: [...], pagination: ... } — not a bare array
        const list = Array.isArray(res.data) ? res.data : (res.data?.projects || []);
        setProjects(list);
      } catch (err) {
        console.error("Failed to fetch projects", err);
      }
    };
    fetchProjects();
  }, []);

  // If no users were passed in as props, fetch from the assignable endpoint
  // (used when non-admin roles open the create task form)
  const [fetchedUsers, setFetchedUsers] = useState([]);
  useEffect(() => {
    if (!users || users.length === 0) {
      API.get("/api/users/assignable")
        .then((r) => setFetchedUsers(Array.isArray(r.data) ? r.data : []))
        .catch((err) => console.error("Failed to fetch assignable users", err));
    }
  }, [users]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (timeRef.current && !timeRef.current.contains(e.target)) {
        setTimeOpen(false);
      }
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(e.target)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleUserSelection = (userId) => {
    setTask((prev) => {
      const alreadySelected = prev.assignedTo.includes(userId);
      return {
        ...prev,
        assignedTo: alreadySelected
          ? prev.assignedTo.filter((id) => id !== userId)
          : [...prev.assignedTo, userId],
      };
    });
  };

  const handleProjectSelection = (project) => {
    setSelectedProject(project);
    setTask((prev) => ({
      ...prev,
      project: project ? project._id : null,
      assignedTo: [], // Reset assigned users when project changes
    }));
    setProjectDropdownOpen(false);
    setProjectSearchTerm("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!task.title || task.assignedTo.length === 0 || !task.dueDate) return;

    const dueDateOnly = task.dueDate;
    // Combine dueDate date part with dueTime string part into one Date object
    let combinedDueDate;
    if (task.dueTime) {
      const [hours, minutes] = task.dueTime.split(":");
      combinedDueDate = new Date(dueDateOnly);
      combinedDueDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    } else {
      combinedDueDate = dueDateOnly;
    }

    const formattedTask = {
      ...task,
      dueDate: combinedDueDate,
      project: task.project || undefined // Only include project if it's set
    };
    onCreate(formattedTask);

    setTask({
      title: "",
      assignedTo: [],
      dueDate: null,
      dueTime: "",
      priority: "",
      status: "pending",
      description: "",
      project: null,
    });
    setSearchTerm("");
    setSelectedProject(null);
    setProjectSearchTerm("");
  };

  // Resolve the user list: prefer props, fall back to auto-fetched
  const allUsers = (users && users.length > 0) ? users : fetchedUsers;

  // Filter users based on project selection
  const availableUsers = selectedProject
    ? selectedProject.assignedTo.filter(u => !u.status || u.status === 'active')
    : allUsers;

  const filteredUsers = availableUsers.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter projects based on search term
  const filteredProjects = projects.filter((p) =>
    p.projectName.toLowerCase().includes(projectSearchTerm.toLowerCase())
  );

  const generateTimeSlots = () => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hour = h.toString().padStart(2, "0");
        const min = m.toString().padStart(2, "0");
        slots.push(`${hour}:${min}`);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const commonInputClasses =
    "bg-[#141a29] border border-[rgba(84,123,209,0.4)] p-2 rounded-lg shadow-sm text-sm text-blue-100 w-full focus:ring-2 focus:ring-[#ff8000] outline-none";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Task Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Task Title</label>
        <input
          type="text"
          placeholder="Enter task title"
          className={commonInputClasses}
          value={task.title}
          onChange={(e) => setTask({ ...task, title: e.target.value })}
          required
        />
      </div>

      {/* Project Selection (Optional) */}
      <div className="relative" ref={projectDropdownRef}>
        <label className="block text-sm font-medium mb-1">
          Project (Optional)
        </label>
        <div
          className={`${commonInputClasses} cursor-pointer flex justify-between items-center`}
          onClick={() => setProjectDropdownOpen((prev) => !prev)}
        >
          <span>
            {selectedProject ? selectedProject.projectName : "Select project (optional)..."}
          </span>
          {selectedProject && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleProjectSelection(null);
              }}
              className="text-[#ff8000] hover:text-[#ffa733] font-bold ml-2"
            >
              ✕
            </button>
          )}
        </div>

        {projectDropdownOpen && (
          <div className="absolute left-0 top-full mt-1 border border-[rgba(84,123,209,0.4)] bg-[#141a29] rounded-lg shadow-lg w-full z-50 text-blue-100 max-h-60 overflow-y-auto">
            <div className="p-2 border-b border-[rgba(84,123,209,0.4)]">
              <input
                type="text"
                placeholder="Search projects..."
                value={projectSearchTerm}
                onChange={(e) => setProjectSearchTerm(e.target.value)}
                className="bg-[#141a29] border border-[rgba(84,123,209,0.4)] rounded-2xl p-2 text-blue-100 w-full focus:ring-2 focus:ring-[#ff8000] outline-none"
              />
            </div>

            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <div
                  key={project._id}
                  className="px-3 py-2 hover:bg-[rgba(255,128,0,0.15)] cursor-pointer rounded-md"
                  onClick={() => handleProjectSelection(project)}
                >
                  <div className="font-medium">{project.projectName}</div>
                  <div className="text-xs text-blue-300">
                    {project.assignedTo?.length || 0} employee(s) • {project.status}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-blue-300">No projects found</div>
            )}
          </div>
        )}
      </div>

      {/* Assign To */}
      <div className="relative" ref={dropdownRef}>
        <label className="block text-sm font-medium mb-1">Assign To (Multiple)</label>
        <div
          className={`${commonInputClasses} cursor-pointer`}
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          {task.assignedTo.length > 0
            ? `${task.assignedTo.length} user(s) selected`
            : "Select users..."}
        </div>

        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-1 border border-[rgba(84,123,209,0.4)] bg-[#141a29] rounded-lg shadow-lg w-full z-50 text-blue-100 max-h-60 overflow-y-auto">
            <div className="p-2 border-b border-[rgba(84,123,209,0.4)]">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#141a29] border border-[rgba(84,123,209,0.4)] rounded-2xl p-2 text-blue-100 w-full focus:ring-2 focus:ring-[#ff8000] outline-none"
              />
            </div>

            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <label
                  key={user._id}
                  className="flex items-center px-3 py-2 hover:bg-[rgba(255,128,0,0.15)] cursor-pointer rounded-md"
                >
                  <input
                    type="checkbox"
                    checked={task.assignedTo.includes(user._id)}
                    onChange={() => toggleUserSelection(user._id)}
                    className="mr-2 cursor-pointer"
                  />
                  {user.name}
                </label>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-blue-300">No users found</div>
            )}
          </div>
        )}
      </div>

      {/* Date + Time Picker */}
      <div className="flex gap-3">
        {/* Custom Date Picker */}
        <div className="w-full">
          <label className="block text-sm font-medium mb-1 text-blue-100">Due Date</label>
          <ReactDatePicker
            selected={task.dueDate}
            onChange={(date) => setTask({ ...task, dueDate: date })}
            className={commonInputClasses}
            placeholderText="Select due date"
            minDate={new Date()}
            dateFormat="yyyy-MM-dd"
            isClearable
            wrapperClassName="w-full"
          />
        </div>

        {/* Time */}
        <div className="relative w-full" ref={timeRef}>
          <label className="block text-sm font-medium mb-1 text-blue-100">Due Time</label>
          <input
            type="text"
            readOnly
            placeholder="Select Time"
            className={`${commonInputClasses} cursor-pointer`}
            value={task.dueTime}
            onClick={() => setTimeOpen((prev) => !prev)}
          />
          {timeOpen && (
            <div className="absolute top-full mt-1 bg-[#141a29] border border-[rgba(84,123,209,0.4)] rounded-2xl shadow-lg max-h-60 overflow-y-auto w-full z-50 text-blue-100">
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="px-3 py-1 hover:bg-[#ff8000]/50 cursor-pointer rounded-md text-sm"
                  onClick={() => {
                    setTask({ ...task, dueTime: time });
                    setTimeOpen(false);
                  }}
                >
                  {time}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium mb-1">Priority</label>
        <select
          className={commonInputClasses}
          value={task.priority}
          onChange={(e) => setTask({ ...task, priority: e.target.value })}
          required
        >
          <option value="">Select priority</option>
          <option>Low</option>
          <option>Medium</option>
          <option>High</option>
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          placeholder="Enter task description"
          className={`${commonInputClasses} resize-none`}
          rows={3}
          value={task.description}
          onChange={(e) => setTask({ ...task, description: e.target.value })}
        />
        {/* Live URL preview — only shown when description contains a URL */}
        {task.description && hasUrl(task.description) && (
          <div className="mt-2 p-3 bg-[#0d1220] border border-[rgba(84,123,209,0.2)] rounded-lg">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd"/>
              </svg>
              <span className="text-xs text-blue-400 font-medium">Preview — links are clickable</span>
            </div>
            <RichTextPreview text={task.description} />
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full p-3 rounded-lg font-semibold bg-gradient-to-r from-[#ff8000] to-[#ffa733] text-black hover:opacity-90 transition cursor-pointer"
      >
        Create Task
      </button>
    </form>
  );
};

export default TaskForm;
