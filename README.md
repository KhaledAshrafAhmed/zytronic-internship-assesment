# Zytronic Internship Assessment

## Features

- User registration and login (JWT authentication)
- Real-time chat using Socket.io
- Send and receive text and image messages
- Conversation management
- Responsive frontend (React + Next.js)
- Secure backend (Express, Helmet, CORS, Rate Limiting)
- Image uploads with preview

---

## Tech Stack

- **Frontend:** React, Next.js, Axios, Tailwind CSS
- **Backend:** Node.js, Express, MySQL, Socket.io, Multer
- **Other:** JWT, dotenv, helmet, express-rate-limit

---

### Backend Setup

```sh
cd backend
npm install
```

- Create a MySQL database and update `.env` with your credentials.
- Example `.env`:

  ```sh
  PORT=5000
  DB_HOST=localhost
  DB_USER=root
  DB_PASSWORD=yourpassword
  DB_NAME=chat_app
  JWT_SECRET=your-super-secret-jwt-key-here
  NODE_ENV=development
  ```

-Start the backend server:

  ```sh
  npm run dev
  ```
  The backend runs on `http://localhost:5000`.

### Frontend Setup

```sh
cd ../frontend
npm install
npm run dev
```
## Author

Khaled Ashraf (Zytronic Internship Assessment)