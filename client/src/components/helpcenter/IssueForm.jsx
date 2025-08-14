import React, { useState } from "react";
import FileUploader from "./FileUploader";
import API from "../../api"; // axios instance with auth

const PRIORITIES = ["Low", "Medium", "High"];

export default function IssueForm({
  defaultPriority = "Medium",
  onSuccess,               // called after successful submit
  endpoint = "/help/issues" // backend API path (mounted under /api in your server)
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState(defaultPriority);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOkMsg("");

    if (!title.trim()) {
      setError("Please enter an issue title.");
      return;
    }

    try {
      setSubmitting(true);

      const formData = new FormData();
      formData.append("title", title);
      formData.append("priority", priority);
      formData.append("description", description);
      files.forEach((f) => formData.append("attachments", f));

      await API.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setOkMsg("Issue submitted successfully. Our team will contact you soon.");
      setTitle("");
      setPriority(defaultPriority);
      setDescription("");
      setFiles([]);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Help issue submit error:", err?.response?.data || err.message);
      setError(
        err?.response?.data?.message ||
          "Failed to submit issue. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium mb-1">Issue Title</label>
        <input
          type="text"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Enter a brief title for your issue"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Priority */}
      <div>
        <label className="block text-sm font-medium mb-1">Priority Level</label>
        <div className="relative">
          <select
            className="appearance-none w-full border rounded-lg px-3 pr-10 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="" disabled>
              Select priority level
            </option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {/* Custom arrow */}
          <svg
            className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-1">Issue Description</label>
        <textarea
          rows={5}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Please provide detailed information about your issue"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      {/* Attachments */}
      <div>
        <label className="block text-sm font-medium mb-2">Attachments</label>
        <FileUploader
          files={files}
          onChange={setFiles}
          accept={{
            "application/pdf": [".pdf"],
            "application/msword": [".doc"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
            "image/*": [".png", ".jpg", ".jpeg"],
          }}
          maxSizeMB={10}
          maxFiles={5}
        />
        <p className="text-xs text-gray-500 mt-2">
          Supports PDF, DOC, DOCX, JPG, PNG (max 10MB each)
        </p>
      </div>

      {/* Error / Success Messages */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded">
          {error}
        </div>
      )}
      {okMsg && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">
          {okMsg}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full h-11 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit Issue"}
      </button>
    </form>
  );
}
