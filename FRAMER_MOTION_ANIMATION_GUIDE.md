# 🎨 Framer Motion Animation Guide

**Date:** 2025-10-22
**Status:** ✅ **COMPLETE**

---

## 🎯 Overview

This guide provides reusable Framer Motion animation patterns for all pages in the TapveraCRM application.

---

## 📦 Installation

Framer Motion is already installed:
```bash
npm install framer-motion
```

---

## 🎭 Animation Variants Library

### 1. Container (Staggered Children)

```javascript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,  // 80ms delay between children
      delayChildren: 0.1,      // 100ms before first child
    },
  },
};
```

**Usage:**
```jsx
<motion.div
  variants={containerVariants}
  initial="hidden"
  animate="visible"
  className="grid grid-cols-3 gap-4"
>
  {items.map((item) => (
    <motion.div key={item.id} variants={cardVariants}>
      {/* Child content */}
    </motion.div>
  ))}
</motion.div>
```

---

### 2. Card (Spring Entrance)

```javascript
const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20,
    },
  },
};
```

**Usage with Hover:**
```jsx
<motion.div
  variants={cardVariants}
  whileHover={{
    y: -5,
    transition: { type: "spring", stiffness: 400, damping: 10 }
  }}
  whileTap={{ scale: 0.98 }}
  className="card"
>
  {/* Card content */}
</motion.div>
```

---

### 3. Table Row (Sequential)

```javascript
const tableRowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,          // 50ms * index
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  }),
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 },
  },
};
```

**Usage:**
```jsx
<AnimatePresence>
  {rows.map((row, index) => (
    <motion.tr
      key={row.id}
      custom={index}
      variants={tableRowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      {/* Row content */}
    </motion.tr>
  ))}
</AnimatePresence>
```

---

### 4. Modal (Scale + Fade)

```javascript
const modalVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: { duration: 0.2 },
  },
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};
```

**Usage:**
```jsx
<AnimatePresence>
  {showModal && (
    <>
      {/* Overlay */}
      <motion.div
        variants={overlayVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 flex items-center justify-center z-50"
      >
        <div className="modal-content">
          {/* Modal body */}
        </div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

---

### 5. Stat Counter (Pop In)

```javascript
const statCounterVariants = {
  hidden: { scale: 0.5, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 15,
    },
  },
};
```

**Usage:**
```jsx
<motion.p
  className="text-3xl font-bold"
  key={count}  // Re-animate when count changes
  variants={statCounterVariants}
  initial="hidden"
  animate="visible"
>
  {count}
</motion.p>
```

---

### 6. List Item (Stagger + Slide)

```javascript
const listItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 24,
    },
  },
};
```

---

### 7. Slide Panel (Height Transition)

```javascript
const slidePanelVariants = {
  hidden: { opacity: 0, height: 0, marginBottom: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    marginBottom: 16,
    transition: {
      height: { type: "spring", stiffness: 300, damping: 30 },
      opacity: { duration: 0.2 },
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginBottom: 0,
    transition: {
      height: { duration: 0.2 },
      opacity: { duration: 0.15 },
    },
  },
};
```

---

### 8. Button (Tap + Hover)

```jsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  className="btn"
>
  Click Me
</motion.button>
```

---

### 9. Notification Toast

```javascript
const toastVariants = {
  hidden: { opacity: 0, y: -50, scale: 0.3 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    transition: { duration: 0.2 },
  },
};
```

---

### 10. Page Transition

```javascript
const pageVariants = {
  initial: { opacity: 0, x: -20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 },
  },
};
```

---

## 🎨 Page-Specific Patterns

### ProjectsPage

```jsx
// Stats Cards
<motion.div
  className="grid grid-cols-5 gap-6"
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  {stats.map((stat) => (
    <motion.div
      key={stat.id}
      variants={cardVariants}
      whileHover={{ y: -5 }}
      className="stat-card"
    >
      <h3>{stat.label}</h3>
      <motion.p
        key={stat.value}
        variants={statCounterVariants}
        initial="hidden"
        animate="visible"
      >
        {stat.value}
      </motion.p>
    </motion.div>
  ))}
</motion.div>

// Project Table
<AnimatePresence mode="wait">
  {projects.map((project, i) => (
    <motion.tr
      key={project.id}
      custom={i}
      variants={tableRowVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      {/* Row cells */}
    </motion.tr>
  ))}
</AnimatePresence>
```

---

### ChatPage

```jsx
// Message List (scroll from bottom)
const messageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
};

<AnimatePresence initial={false}>
  {messages.map((msg) => (
    <motion.div
      key={msg.id}
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      layout
      className={msg.isMine ? "message-sent" : "message-received"}
    >
      {msg.text}
    </motion.div>
  ))}
</AnimatePresence>

// Typing Indicator
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
>
  <motion.span
    animate={{ scale: [1, 1.2, 1] }}
    transition={{ repeat: Infinity, duration: 1 }}
  >
    •
  </motion.span>
</motion.div>
```

---

### TasksPage (Kanban)

```jsx
// Kanban Column
<motion.div
  className="kanban-column"
  variants={containerVariants}
  initial="hidden"
  animate="visible"
>
  <AnimatePresence>
    {tasks.map((task, i) => (
      <motion.div
        key={task.id}
        custom={i}
        variants={cardVariants}
        layout
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        whileDrag={{ scale: 1.05, rotate: 2 }}
        className="task-card"
      >
        {task.title}
      </motion.div>
    ))}
  </AnimatePresence>
</motion.div>
```

---

### EmployeePortal

```jsx
// Project Timeline
const timelineItemVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.1,
      type: "spring",
      stiffness: 300,
    },
  }),
};

<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {timeline.map((item, i) => (
    <motion.div
      key={item.id}
      custom={i}
      variants={timelineItemVariants}
      className="timeline-item"
    >
      {/* Timeline content */}
    </motion.div>
  ))}
</motion.div>
```

---

## 🚀 Best Practices

### 1. **Use Layout Animations**

When items change position or size:
```jsx
<motion.div layout>Content</motion.div>
```

### 2. **AnimatePresence for Exit Animations**

Always wrap conditional renders:
```jsx
<AnimatePresence>
  {show && <motion.div exit={{ opacity: 0 }}>...</motion.div>}
</AnimatePresence>
```

### 3. **Use `key` for Re-animations**

Change key to trigger animation again:
```jsx
<motion.div key={count} variants={counterVariants}>
  {count}
</motion.div>
```

### 4. **Optimize with `layoutId`**

For shared element transitions:
```jsx
<motion.div layoutId="shared-element">...</motion.div>
```

### 5. **Performance Tips**

- Use `transform` and `opacity` (GPU accelerated)
- Avoid animating `width`, `height` directly
- Use `will-change` CSS for complex animations
- Limit simultaneous animations

---

## 🎯 Quick Reference

| Animation Type | Variant | Use Case |
|----------------|---------|----------|
| Stagger | `containerVariants` | Grids, lists |
| Card | `cardVariants` | Stats, project cards |
| Row | `tableRowVariants` | Tables |
| Modal | `modalVariants` | Dialogs, modals |
| Counter | `statCounterVariants` | Numbers |
| Slide Panel | `slidePanelVariants` | Accordions |
| Button | `whileHover/Tap` | Buttons |
| Toast | `toastVariants` | Notifications |
| Page | `pageVariants` | Route transitions |

---

## 🔧 Common Patterns

### Loading Skeleton
```jsx
<motion.div
  animate={{ opacity: [0.5, 1, 0.5] }}
  transition={{ repeat: Infinity, duration: 1.5 }}
  className="skeleton"
/>
```

### Pulse Badge
```jsx
<motion.div
  animate={{ scale: [1, 1.1, 1] }}
  transition={{ repeat: Infinity, duration: 2 }}
  className="badge"
/>
```

### Slide-in Drawer
```jsx
<motion.div
  initial={{ x: "100%" }}
  animate={{ x: 0 }}
  exit={{ x: "100%" }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
  className="drawer"
/>
```

### Fade-in Text
```jsx
<motion.p
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: 0.2 }}
>
  Text content
</motion.p>
```

---

## 📝 Implementation Checklist

### For Each Page:

- [ ] Import Framer Motion
- [ ] Define animation variants at top of file
- [ ] Wrap stat cards with `motion.div`
- [ ] Add `containerVariants` to grid containers
- [ ] Add `cardVariants` to individual cards
- [ ] Wrap table rows with `AnimatePresence`
- [ ] Add `whileHover` to interactive elements
- [ ] Add `whileTap` to buttons
- [ ] Wrap modals with `AnimatePresence`
- [ ] Add page transitions

---

## 🎨 Color-Coded Animation Intensity

### Subtle (Low Motion)
- Opacity transitions
- Small scale changes (0.95 - 1.05)
- Short durations (0.2s)

### Medium (Standard)
- Y/X translations (±20px)
- Scale changes (0.9 - 1.1)
- Spring animations
- Medium durations (0.3s)

### Bold (High Impact)
- Large translations (±50px)
- Significant scale changes
- Rotation
- Longer springs

---

## ✅ Success Metrics

After implementing animations:
- ✅ Page load feels faster (perceived performance)
- ✅ User focus guided to important elements
- ✅ State changes are clear and understandable
- ✅ Interactions feel responsive
- ✅ No janky or laggy animations (60fps)

---

**Built with:** Framer Motion 10+
**Documentation Date:** 2025-10-22
**Status:** ✅ READY TO USE

🎯 **Apply these patterns to ProjectsPage, ChatPage, TasksPage, EmployeePortal!**
