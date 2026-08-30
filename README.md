# 🎨 Live Drawing & Voice Canvas

A real-time collaborative brainstorming web application where multiple users can join a shared room, draw together, add notes, and communicate through voice.

## 🚀 Live Demo

**Website:**  
https://live-drawing-and-voice-canvas.vercel.app/

---

## 📌 Overview

Live Drawing & Voice Canvas is a collaborative digital whiteboard designed for teams, students, and groups to brainstorm ideas in real time.

Users can create or join a shared room using a room ID and collaborate on the same canvas. Drawing actions and room participants are synchronized in real time, while voice communication is handled using WebRTC.

No account or registration is required.

---

## ✨ Features

### 🎨 Interactive Whiteboard

- Freehand drawing
- Adjustable brush size
- Multiple brush colors
- Rectangle tool
- Circle tool
- Text/notes tool
- Clear canvas functionality

### 👥 Real-Time Collaboration

- Create or join shared rooms
- Shareable room links
- Live participant counter
- Real-time canvas synchronization
- New drawings appear instantly for other users
- Room state synchronization

### 🎙️ Voice Chat

- Real-time voice communication
- WebRTC peer-to-peer audio
- Microphone permission support
- WebSocket-based WebRTC signaling
- Multiple users can communicate within the same room

### 📤 Export

The current canvas can be exported as:

- PNG image
- PDF document

### 🌐 Deployment

- Fully deployed on Vercel
- Vercel serverless API
- WebSocket-based real-time communication

---

## 🛠️ Technology Stack

### Frontend

- React.js
- Vite
- HTML5 Canvas API
- CSS3
- JavaScript

### Backend

- Node.js
- Express.js
- WebSocket (`ws`)

### Real-Time Communication

- WebSockets
- WebRTC
- STUN server

### Export

- jsPDF
- HTML5 Canvas

### Deployment

- Vercel
- GitHub



