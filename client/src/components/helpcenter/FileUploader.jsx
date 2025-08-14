import React, { useCallback, useRef, useState } from "react";

export default function FileUploader({
  files,
  onChange,
  accept = { "image/*": [".png", ".jpg", ".jpeg"] },
  maxSizeMB = 10,
  maxFiles = 5,
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const acceptAttr = Object.values(accept).flat().join(",");

  const validate = (list) => {
    const errors = [];
    const valid = [];

    for (const file of list) {
      const ext = "." + file.name.split(".").pop().toLowerCase();
      const allowed = Object.values(accept).flat();
      const sizeOk = file.size <= maxSizeMB * 1024 * 1024;

      if (!allowed.includes(ext) && !Object.keys(accept).some((k) => k === file.type)) {
        errors.push(`${file.name}: unsupported type`);
        continue;
      }
      if (!sizeOk) {
        errors.push(`${file.name}: exceeds ${maxSizeMB}MB`);
        continue;
      }
      valid.push(file);
    }

    if (errors.length) {
      alert(errors.join("\n"));
    }
    return valid;
  };

  const pickFiles = () => inputRef.current?.click();

  const onFiles = useCallback(
    (selected) => {
      const valid = validate(Array.from(selected));
      const merged = [...files, ...valid].slice(0, maxFiles);
      onChange(merged);
    },
    [files, onChange]
  );

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    onFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={pickFiles}
        className={`rounded-lg border-2 border-dashed px-4 py-8 text-center cursor-pointer select-none ${
          dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200"
        }`}
      >
        <div className="text-2xl mb-2">📎</div>
        <div className="font-medium">Drag and drop files here or click to upload</div>
      </div>

      {!!files.length && (
        <ul className="mt-3 space-y-2">
          {files.map((f, idx) => (
            <li
              key={idx}
              className="flex items-center justify-between bg-gray-50 border rounded px-3 py-2 text-sm"
            >
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                className="text-red-600 text-xs hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(files.filter((_, i) => i !== idx));
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
