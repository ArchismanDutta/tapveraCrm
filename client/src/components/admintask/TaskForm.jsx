import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Flag,
  Link2,
  LoaderCircle,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import API from "../../api";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const initialTask = {
  title: "",
  assignedTo: [],
  dueDate: "",
  dueTime: "",
  priority: "Medium",
  status: "pending",
  description: "",
  project: null,
};

const getLocalDateInput = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:focus:border-blue-400/40 dark:focus:ring-blue-400/10";

const getPersonId = (person) =>
  typeof person === "object" ? person?._id : person;

const getPersonName = (person) =>
  typeof person === "object"
    ? person?.name || person?.email || "Team member"
    : "Team member";

const hasUrl = (text) => {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text || "");
};

const RichTextPreview = ({ text }) => {
  const parts = text.split(URL_REGEX);

  return (
    <div className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
      {parts.map((part, index) => {
        URL_REGEX.lastIndex = 0;
        return URL_REGEX.test(part) ? (
          <a
            key={`link-${index}-${part}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
          >
            <Link2 className="h-3 w-3 shrink-0" />
            {part}
          </a>
        ) : (
          <span key={`text-${index}-${part.slice(0, 12)}`}>{part}</span>
        );
      })}
    </div>
  );
};

const FieldHeader = ({ icon, title, description }) => (
  <div className="mb-4 flex items-start gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
      {React.createElement(icon, { className: "h-4 w-4" })}
    </span>
    <div>
      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {description}
      </p>
    </div>
  </div>
);

const TaskForm = ({ onCreate, users = [] }) => {
  const [task, setTask] = useState(initialTask);
  const [projects, setProjects] = useState([]);
  const [fetchedUsers, setFetchedUsers] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [personSearch, setPersonSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const projectRef = useRef(null);
  const peopleRef = useRef(null);

  useEffect(() => {
    let active = true;

    const fetchProjects = async () => {
      try {
        const response = await API.get("/api/projects?limit=10000");
        const list = Array.isArray(response.data)
          ? response.data
          : response.data?.projects || [];
        if (active) setProjects(list);
      } catch (projectError) {
        console.error("Failed to fetch projects:", projectError);
        if (active) setProjects([]);
      } finally {
        if (active) setLoadingProjects(false);
      }
    };

    fetchProjects();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (users.length > 0) return undefined;

    let active = true;
    setLoadingPeople(true);
    API.get("/api/users/assignable")
      .then((response) => {
        if (active) {
          setFetchedUsers(Array.isArray(response.data) ? response.data : []);
        }
      })
      .catch((peopleError) => {
        console.error("Failed to fetch assignable users:", peopleError);
        if (active) setFetchedUsers([]);
      })
      .finally(() => {
        if (active) setLoadingPeople(false);
      });

    return () => {
      active = false;
    };
  }, [users]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (projectRef.current && !projectRef.current.contains(event.target)) {
        setProjectOpen(false);
      }
      if (peopleRef.current && !peopleRef.current.contains(event.target)) {
        setPeopleOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const allUsers = users.length > 0 ? users : fetchedUsers;

  const availableUsers = useMemo(() => {
    if (!selectedProject) return allUsers;

    const projectPeople = Array.isArray(selectedProject.assignedTo)
      ? selectedProject.assignedTo
      : [];

    return projectPeople
      .map((person) => {
        if (typeof person === "object") return person;
        return allUsers.find((candidate) => candidate._id === person);
      })
      .filter(
        (person) =>
          person && (!person.status || String(person.status) === "active")
      );
  }, [allUsers, selectedProject]);

  const selectedPeople = useMemo(() => {
    const userMap = new Map(
      [...allUsers, ...availableUsers].map((person) => [person._id, person])
    );
    return task.assignedTo
      .map((id) => userMap.get(id))
      .filter(Boolean);
  }, [allUsers, availableUsers, task.assignedTo]);

  const filteredProjects = projects.filter((project) =>
    String(project.projectName || "")
      .toLowerCase()
      .includes(projectSearch.trim().toLowerCase())
  );

  const filteredPeople = availableUsers.filter((person) => {
    const search = personSearch.trim().toLowerCase();
    return (
      !search ||
      String(person.name || "").toLowerCase().includes(search) ||
      String(person.email || "").toLowerCase().includes(search)
    );
  });

  const setField = (field, value) => {
    setTask((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const selectProject = (project) => {
    setSelectedProject(project);
    setTask((current) => ({
      ...current,
      project: project?._id || null,
      assignedTo: [],
    }));
    setProjectSearch("");
    setPersonSearch("");
    setProjectOpen(false);
  };

  const togglePerson = (person) => {
    const id = getPersonId(person);
    if (!id) return;

    setTask((current) => ({
      ...current,
      assignedTo: current.assignedTo.includes(id)
        ? current.assignedTo.filter((selectedId) => selectedId !== id)
        : [...current.assignedTo, id],
    }));
    if (error) setError("");
  };

  const selectAllVisible = () => {
    const visibleIds = filteredPeople.map(getPersonId).filter(Boolean);
    setTask((current) => ({
      ...current,
      assignedTo: Array.from(
        new Set([...current.assignedTo, ...visibleIds])
      ),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!task.title.trim()) {
      setError("Add a clear task title.");
      return;
    }
    if (task.assignedTo.length === 0) {
      setError("Choose at least one person to assign this task to.");
      return;
    }
    if (!task.dueDate) {
      setError("Choose a due date.");
      return;
    }
    if (!task.priority) {
      setError("Choose a priority.");
      return;
    }

    const time = task.dueTime || "23:59";
    const combinedDueDate = new Date(`${task.dueDate}T${time}:00`);

    try {
      setSubmitting(true);
      await onCreate({
        ...task,
        title: task.title.trim(),
        description: task.description.trim(),
        dueDate: combinedDueDate,
        project: task.project || undefined,
      });
      setTask(initialTask);
      setSelectedProject(null);
      setProjectSearch("");
      setPersonSearch("");
    } catch (createError) {
      setError(
        createError.response?.data?.message ||
          "The task could not be created. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.025]">
        <FieldHeader
          icon={Flag}
          title="Task details"
          description="Describe the outcome so the assigned person knows exactly what good looks like."
        />

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Title <span className="text-rose-500">*</span>
            </span>
            <input
              type="text"
              value={task.title}
              onChange={(event) => setField("title", event.target.value)}
              placeholder="For example: Prepare the Q3 client review"
              maxLength={140}
              disabled={submitting}
              className={`${inputClass} h-11`}
            />
            <span className="mt-1 block text-right text-[10px] text-slate-400">
              {task.title.length}/140
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Description{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              value={task.description}
              onChange={(event) => setField("description", event.target.value)}
              placeholder="Add context, expected output, useful links, or acceptance criteria..."
              rows={5}
              maxLength={1200}
              disabled={submitting}
              className={`${inputClass} resize-y py-3 leading-5`}
            />
            <div className="mt-1 flex items-center justify-between gap-3">
              <span className="text-[10px] text-slate-400">
                Links become clickable in the preview.
              </span>
              <span className="text-[10px] text-slate-400">
                {task.description.length}/1200
              </span>
            </div>
          </label>

          {hasUrl(task.description) && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-400/20 dark:bg-blue-400/10">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700 dark:text-blue-200">
                <Link2 className="h-3.5 w-3.5" />
                Description preview
              </p>
              <RichTextPreview text={task.description} />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.025]">
        <FieldHeader
          icon={Users}
          title="Assignment"
          description="Connect a project if helpful, then choose who this task should be assigned to."
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <div ref={projectRef} className="relative">
            <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Project{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <button
              type="button"
              onClick={() => setProjectOpen((open) => !open)}
              disabled={submitting}
              aria-expanded={projectOpen}
              className={`${inputClass} flex h-11 items-center justify-between gap-2 text-left`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <BriefcaseBusiness className="h-4 w-4 shrink-0 text-slate-400" />
                <span
                  className={`truncate ${
                    selectedProject ? "" : "text-slate-400"
                  }`}
                >
                  {selectedProject?.projectName || "No project selected"}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                  projectOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {selectedProject && (
              <button
                type="button"
                onClick={() => selectProject(null)}
                disabled={submitting}
                className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 transition hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-300"
              >
                <X className="h-3 w-3" />
                Remove project and reset assignees
              </button>
            )}

            {projectOpen && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#171a22]">
                <div className="border-b border-slate-100 p-2 dark:border-white/[0.07]">
                  <label className="relative block">
                    <span className="sr-only">Search projects</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={projectSearch}
                      onChange={(event) => setProjectSearch(event.target.value)}
                      placeholder="Search projects"
                      className={`${inputClass} h-9 pl-9`}
                      autoFocus
                    />
                  </label>
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                  <button
                    type="button"
                    onClick={() => selectProject(null)}
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/[0.05]"
                  >
                    No project
                  </button>
                  {loadingProjects ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading projects...
                    </div>
                  ) : filteredProjects.length > 0 ? (
                    filteredProjects.map((project) => (
                      <button
                        key={project._id}
                        type="button"
                        onClick={() => selectProject(project)}
                        className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                      >
                        <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                          {project.projectName || "Untitled project"}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {Array.isArray(project.assignedTo)
                            ? project.assignedTo.length
                            : 0}{" "}
                          team members
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-6 text-center text-xs text-slate-400">
                      No projects match your search.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div ref={peopleRef} className="relative">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assign to <span className="text-rose-500">*</span>
              </label>
              {task.assignedTo.length > 0 && (
                <span className="text-[10px] font-medium text-blue-600 dark:text-blue-300">
                  {task.assignedTo.length} selected
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPeopleOpen((open) => !open)}
              disabled={submitting}
              aria-expanded={peopleOpen}
              className={`${inputClass} flex h-11 items-center justify-between gap-2 text-left`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <UserPlus className="h-4 w-4 shrink-0 text-slate-400" />
                <span
                  className={`truncate ${
                    selectedPeople.length ? "" : "text-slate-400"
                  }`}
                >
                  {selectedPeople.length
                    ? selectedPeople.map(getPersonName).join(", ")
                    : selectedProject
                      ? "Choose from the project team"
                      : "Choose people to assign"}
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                  peopleOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {peopleOpen && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#171a22]">
                <div className="border-b border-slate-100 p-2 dark:border-white/[0.07]">
                  <label className="relative block">
                    <span className="sr-only">Search people</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={personSearch}
                      onChange={(event) => setPersonSearch(event.target.value)}
                      placeholder="Search by name or email"
                      className={`${inputClass} h-9 pl-9`}
                      autoFocus
                    />
                  </label>
                  {filteredPeople.length > 1 && (
                    <button
                      type="button"
                      onClick={selectAllVisible}
                      className="mt-2 text-[11px] font-semibold text-blue-600 transition hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                    >
                      Select all visible
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto p-1">
                  {loadingPeople ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-400">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading people...
                    </div>
                  ) : filteredPeople.length > 0 ? (
                    filteredPeople.map((person) => {
                      const id = getPersonId(person);
                      const selected = task.assignedTo.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => togglePerson(person)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.05]"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              selected
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-300 dark:border-white/20"
                            }`}
                          >
                            {selected && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                              {getPersonName(person)}
                            </span>
                            {person.email && (
                              <span className="block truncate text-[11px] text-slate-400">
                                {person.email}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="px-3 py-6 text-center text-xs text-slate-400">
                      {selectedProject
                        ? "No eligible people are assigned to this project."
                        : "No people match your search."}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedPeople.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedPeople.map((person) => (
              <span
                key={person._id}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200"
              >
                {getPersonName(person)}
                <button
                  type="button"
                  onClick={() => togglePerson(person)}
                  className="rounded p-0.5 transition hover:bg-blue-100 dark:hover:bg-blue-400/15"
                  aria-label={`Remove ${getPersonName(person)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.025]">
        <FieldHeader
          icon={CalendarDays}
          title="Schedule and priority"
          description="Set a realistic deadline and signal how urgently this needs attention."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              Due date <span className="text-rose-500">*</span>
            </span>
            <input
              type="date"
              min={getLocalDateInput()}
              value={task.dueDate}
              onChange={(event) => setField("dueDate", event.target.value)}
              disabled={submitting}
              className={`${inputClass} h-11 dark:bg-[#151923]`}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
              Due time{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <input
              type="time"
              value={task.dueTime}
              onChange={(event) => setField("dueTime", event.target.value)}
              disabled={submitting}
              className={`${inputClass} h-11 dark:bg-[#151923]`}
            />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Flag className="h-3.5 w-3.5 text-slate-400" />
            Priority <span className="text-rose-500">*</span>
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                value: "Low",
                active:
                  "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
              },
              {
                value: "Medium",
                active:
                  "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
              },
              {
                value: "High",
                active:
                  "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200",
              },
            ].map((priority) => (
              <button
                key={priority.value}
                type="button"
                onClick={() => setField("priority", priority.value)}
                disabled={submitting}
                aria-pressed={task.priority === priority.value}
                className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border text-xs font-semibold transition disabled:opacity-60 ${
                  task.priority === priority.value
                    ? priority.active
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400 dark:hover:bg-white/[0.06]"
                }`}
              >
                {task.priority === priority.value && (
                  <Check className="h-3.5 w-3.5" />
                )}
                {priority.value}
              </button>
            ))}
          </div>
        </fieldset>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Required: title, at least one assignee, due date, and priority.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {submitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {submitting ? "Creating task..." : "Create task"}
        </button>
      </div>
    </form>
  );
};

export default TaskForm;
