# Kanban Task Manager

A modern Kanban-style task management application built with React and Supabase.

## Live Demo
https://kanbanboard-peach-ten.vercel.app/

## GitHub Repo
https://github.com/SherryNazifi/Kanban-board

## Features

- Drag-and-drop task management
- Four workflow columns:
  - To Do
  - In Progress
  - In Review
  - Done
- Task creation with:
  - title
  - description
  - priority
  - due date
- Task deletion
- Supabase backend integration
- Anonymous user authentication

## Bonus Features

- Task statistics (total, completed, overdue)
- Relative due dates (Today, Tomorrow, etc.)
- Overdue and due-soon indicators
- Clean and modern UI design

## Tech Stack

- React
- Supabase
- @hello-pangea/dnd
- Vercel (deployment)

## Database Schema

tasks (
  id uuid primary key,
  user_id uuid,
  title text,
  description text,
  status text,
  priority text,
  due_date date,
  created_at timestamp
)

## Notes

Tasks are stored in Supabase and tied to user sessions.
Due to limitations with anonymous session persistence, tasks may not always appear after a page refresh in the deployed environment.

## Future Improvements
- Stable session handling
- Search and filtering
- Labels and tags
- User assignment
- Mobile responsiveness


## Screenshots

### Kanban Board
![Board](desktop/imgs/sc1.png)

### Adding a New Task
![Board](desktop/imgs/sc2.png)
