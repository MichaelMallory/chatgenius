# ChatGenius

<p align="center">
  <img src="public/logo.png" alt="ChatGenius Logo" width="200"/>
</p>

ChatGenius is a modern, real-time chat application built with Next.js 14, TypeScript, and Supabase. It features a rich set of communication tools including channels, direct messaging, thread discussions, file sharing, and reactions - all with real-time updates and a beautiful, responsive UI.

## ✨ Features

### 💬 Real-time Communication
- Public and private channels
- Direct messaging
- Thread discussions
- Message formatting with Markdown support
- Emoji reactions
- Real-time presence indicators
- Message editing and deletion
- Typing indicators

### 📎 File Sharing
- Drag-and-drop file uploads
- Image previews and thumbnails
- Support for multiple file types
- 50MB file size limit
- Secure file storage and access control

### 🔍 Search & Discovery
- Full-text search across messages
- File search with previews
- User search with profile links
- Advanced filters and categorization
- Keyboard shortcuts (Cmd/Ctrl + K)

### 👤 User Management
- Email/password authentication
- OAuth support (GitHub, Google)
- Profile customization
- Status updates
- Real-time presence tracking
- Avatar management

### 🔒 Security
- Row Level Security (RLS)
- Protected routes
- Secure file access
- Role-based permissions

## 🚀 Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Real-time)
- **State Management**: React Context, Custom Hooks
- **Testing**: Jest, React Testing Library
- **CI/CD**: GitHub Actions
- **Styling**: Tailwind CSS, shadcn/ui components

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chatgenius.git
cd chatgenius
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account

### Project Structure
```
src/
  ├── app/              # Next.js app router pages
  ├── components/       # React components
  │   ├── chat/        # Chat-related components
  │   ├── channel/     # Channel components
  │   ├── ui/          # Reusable UI components
  │   └── providers/   # Context providers
  ├── lib/             # Utility functions and configs
  └── styles/          # Global styles
```

### Database Schema
The application uses the following main tables:
- `profiles`: User profiles and status
- `channels`: Chat channels and settings
- `messages`: Chat messages with threading
- `files`: File attachments
- `reactions`: Message reactions
- `user_channels`: Channel membership and roles

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
