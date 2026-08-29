# 🎨 Live Drawing & Voice Canvas

A real-time collaborative whiteboard where multiple users can **draw, add notes, and talk through voice chat** in the same room.

## 🚀 Features

* 🖊️ Freehand drawing
* 🔷 Rectangles & circles
* 📝 Text notes
* 🔄 Real-time collaboration
* 🎙️ WebRTC voice chat
* 📤 Export as PNG/PDF
* 👥 Room-based collaboration
* 🌐 Vercel-ready deployment

## 🛠️ Tech Stack

**Frontend:** React.js, HTML5 Canvas, CSS
**Backend:** Node.js, Express.js, Socket.IO
**Voice:** WebRTC
**Export:** jsPDF
**Deployment:** Vercel

## 📂 Structure

```text
client/      → React frontend
server/      → Node.js backend
api/         → Vercel Socket.IO API
vercel.json  → Vercel configuration
```

## ▶️ Run Locally

```bash
# Frontend
cd client
npm install
npm run dev

# Backend
cd server
npm install
npm run dev
```

## 🌐 Deployment

The project is configured for **Vercel** deployment.

Connect the project repository to Vercel, configure the required environment variables, and deploy.

## 🎯 Purpose

Built as a full-stack collaborative brainstorming platform demonstrating **React, Canvas, WebSockets, WebRTC, and cloud deployment**.
