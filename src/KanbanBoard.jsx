//imports
import React, {useState, useEffect} from 'react'; 
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {supabase} from './supabaseClient';

//Constants
const COLUMNS = ['todo', 'in_progress', 'in_review', 'done'];

const COLUMN_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done'
};

const PRIORITY_COLORS = {
  low: {
    bg: '#e0f2fe',
    text: '#0369a1',
    border: '#0ea5e9',
    label: 'Low'
  },
  normal: { 
    bg: '#fef3c7',       
    text: '#92400e',    
    border: '#fbbf24',    
    label: 'Normal'      
  },
  high: { 
    bg: '#fee2e2',        
    text: '#991b1b',      
    border: '#ef4444',   
    label: 'High'         
  }
};

export default function KanbanBoard() {
  const [tasks, setTasks] = useState({
    todo: [],
    in_progress: [],
    in_review: [],
    done: []
  });

  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'normal',
    dueDate: ''
  });

  // Load app on mount
  useEffect(() => {
    initApp();
  }, []);

  // Initialize app and sign in user
  const initApp = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (session?.user) {
      setUserId(session.user.id);
      await loadTasks(session.user.id);
    } else {
      const { data: { user }, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;

      setUserId(user.id);
      await loadTasks(user.id);
    }

  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  // Load tasks from database
  const loadTasks = async (uid) => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('tasks')      
        .select('*')        
        .eq('user_id', uid) 
        .order('created_at', { ascending: true }); 
      
      if (fetchErr) throw fetchErr;
      
      const organized = { 
        todo: [],           
        in_progress: [],    
        in_review: [],     
        done: []            
      };
      
      data?.forEach(task => {
        if (organized[task.status]) {
          organized[task.status].push(task);
        }
      });
      
      setTasks(organized);
    } catch (err) {
      console.error('Error loading tasks:', err);
      setError(err.message);
    }
  };

  // Create new task
  const createTask = async (e) => {
    e.preventDefault();

    if (!newTask.title.trim()){
      setError('Task title is required');
      return;
    }

    try {
      const {data, error: insertErr} = await supabase
        .from('tasks')
        .insert([{
          user_id: userId,
          title: newTask.title,
          description: newTask.description || null,
          priority: newTask.priority,
          due_date: newTask.dueDate || null,
          status: 'todo'
        }])
        .select();

      if (insertErr) throw insertErr;

      setTasks(prev => ({
        ...prev,
        todo: [...prev.todo, data[0]]
      }));

      setNewTask({ title: '', description: '', priority: 'normal', dueDate: '' });
      setShowNewTaskForm(false); 
      setError(null);            
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err.message);
    }
  };

  // Delete task
  const deleteTask = async (taskId, status) => {
    try {
      const { error: deleteErr } = await supabase
        .from('tasks')                  
        .delete()                      
        .eq('id', taskId);                  
      
      if (deleteErr) throw deleteErr;

      setTasks(prev => ({
        ...prev,  
        [status]: prev[status].filter(t => t.id !== taskId) 
      }));
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err.message);
    }
  };

  // Handle drag and drop
  const handleDragEnd = async (result) => {
    const { source, destination } = result;

    if (!destination) return;

    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceStatus = source.droppableId;      
    const destStatus = destination.droppableId;   

    const draggedTask = tasks[sourceStatus][source.index];

    // Update UI first
    const newTasks = { ...tasks };                       
    newTasks[sourceStatus].splice(source.index, 1);         
    newTasks[destStatus].splice(destination.index, 0, draggedTask);  
    setTasks(newTasks);

    // Update database
    try {
      const { error: updateErr } = await supabase
        .from('tasks')                            
        .update({ status: destStatus })           
        .eq('id', draggedTask.id);           
      
      if (updateErr) throw updateErr;
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err.message);
      loadTasks(userId);  
    }  
  };

  // Check if task is overdue
  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  // Check if task is due soon (within 3 days)
  const isDueSoon = (dueDate) => {
    if (!dueDate) return false;
    
    const due = new Date(dueDate);      
    const today = new Date();   
    const daysUntil = Math.ceil((due - today) / (1000 * 60 * 60 * 24)); 
    
    return daysUntil > 0 && daysUntil <= 3;
  };


  // Get relative date text (Today, Tomorrow, In 3 days, etc)
  const getRelativeDate = (date) => {
    const today = new Date();
    const due = new Date(date);

    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff < 0) return `${Math.abs(diff)} days overdue`;
    return `In ${diff} days`;
  };

  // Calculate stats
  const stats = {
    total: Object.values(tasks).reduce((sum, col) => sum + col.length, 0),
    completed: tasks.done.length,
    overdue: Object.values(tasks)
      .flat()
      .filter(t => t.status !== 'done' && isOverdue(t.due_date))
      .length
  };

  // Show loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#ffffff',
        color: '#1f2937',
        fontSize: '18px'
      }}>
        Loading your board...
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #0f172a, #242c36)',
      backgroundAttachment: 'fixed',
      padding: '32px 20px',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          marginBottom: '32px',
          color: 'white'
        }}>
          <h1 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '36px',
            fontWeight: '600',
            letterSpacing: '-0.5px'
          }}>
            Task Board
          </h1>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{ 
            padding: '12px 16px', 
            background: '#fee2e2', 
            color: '#991b1b', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #fecaca',
            fontSize: '14px'
          }}>
             {error}
          </div>
        )}

        {/* Stats */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <div style={{ 
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#3b82f6' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Total Tasks
            </div>
          </div>

          <div style={{ 
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#38b38c' }}>
              {stats.completed}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Completed
            </div>
          </div>

          <div style={{ 
            background: 'white',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: '#dc2626' }}>
              {stats.overdue}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Overdue
            </div>
          </div>
        </div>

        {/* Add Task Button / Form */}
        {!showNewTaskForm ? (
          <button
            onClick={() => setShowNewTaskForm(true)}
            style={{
              background: '#42536a',
              color: 'white',
              border: 'none',
              padding: '12px 20px',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: 'pointer',
              marginBottom: '24px',
              fontSize: '14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
            onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
          >
            + Add New Task
          </button>
        ) : (
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb'
          }}>
            <form onSubmit={createTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                placeholder="Task title"
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                style={{
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
                autoFocus
              />

              <textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                style={{
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  minHeight: '80px',
                  resize: 'none'
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                  style={{
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit'
                  }}
                >
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                </select>

                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  style={{
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: '#1f2937',
                    color: 'white',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Create Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewTaskForm(false);
                    setNewTask({ title: '', description: '', priority: 'normal', dueDate: '' });
                  }}
                  style={{
                    flex: 1,
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Kanban Board */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px'
          }}>
            {COLUMNS.map(columnId => (
              <div 
                key={columnId} 
                style={{ 
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}
              >
                {/* Column Header */}
                <div style={{ 
                  padding: '16px',
                  borderBottom: '1px solid #e5e7eb',
                  background: '#f9fafb'
                }}>
                  <h2 style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1f2937'
                  }}>
                    {COLUMN_LABELS[columnId]}
                  </h2>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '13px', 
                    color: '#9ca3af'
                  }}>
                    {tasks[columnId]?.length || 0} {tasks[columnId]?.length === 1 ? 'task' : 'tasks'}
                  </p>
                </div>

                {/* Tasks Container */}
                <Droppable droppableId={columnId}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: snapshot.isDraggingOver ? '#f3f4f6' : 'transparent',
                        minHeight: '400px',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      {tasks[columnId]?.length === 0 ? (
                        <div style={{
                          textAlign: 'center',
                          color: '#d1d5db',
                          paddingTop: '60px',
                          fontSize: '13px'
                        }}>
                          No tasks yet
                        </div>
                      ) : (
                        tasks[columnId].map((task, index) => (
                          <Draggable 
                            key={task.id} 
                            draggableId={task.id} 
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={{
                                  background: 'white',
                                  padding: '12px',
                                  marginBottom: '12px',
                                  borderRadius: '8px',
                                  border: snapshot.isDragging ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                                  boxShadow: snapshot.isDragging 
                                    ? '0 8px 24px rgba(59, 130, 246, 0.3)' 
                                    : '0 1px 3px rgba(0,0,0,0.1)',
                                  cursor: 'grab',
                                  transition: 'all 0.2s',
                                  transform: snapshot.isDragging ? 'scale(1.02)' : 'scale(1)',
                                  ...provided.draggableProps.style
                                }}
                              >
                                {/* Priority Badge */}
                                {task.priority && (
                                  <div style={{
                                    display: 'inline-block',
                                    background: PRIORITY_COLORS[task.priority].bg,
                                    color: PRIORITY_COLORS[task.priority].text,
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    marginBottom: '8px',
                                    border: `1px solid ${PRIORITY_COLORS[task.priority].border}`
                                  }}>
                                    {PRIORITY_COLORS[task.priority].label}
                                  </div>
                                )}

                                {/* Task Title */}
                                <div style={{
                                  fontWeight: '600',
                                  fontSize: '14px',
                                  color: '#1f2937',
                                  marginBottom: task.description ? '8px' : '0',
                                  wordBreak: 'break-word'
                                }}>
                                  {task.title}
                                </div>

                                {/* Task Description */}
                                {task.description && (
                                  <div style={{
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    marginBottom: '8px',
                                    lineHeight: '1.4'
                                  }}>
                                    {task.description}
                                  </div>
                                )}

                                {/* Due Date */}
                                {task.due_date && (
                                  <div style={{
                                    fontSize: '12px',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    background: isOverdue(task.due_date) 
                                      ? '#fee2e2' 
                                      : isDueSoon(task.due_date)
                                      ? '#fef3c7'
                                      : '#f0fdf4',
                                    color: isOverdue(task.due_date) 
                                      ? '#991b1b' 
                                      : isDueSoon(task.due_date)
                                      ? '#92400e'
                                      : '#166534',
                                    marginBottom: '8px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                  }}>
                                    <span style={{ fontWeight: '600' }}>
                                      {getRelativeDate(task.due_date)}
                                    </span>
                                    <span style={{ opacity: 0.7 }}>
                                      {new Date(task.due_date).toDateString()}
                                    </span>
                                  </div>
                                )}

                                {/* Delete Button */}
                                <button
                                  onClick={() => deleteTask(task.id, columnId)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#d1d5db',
                                    cursor: 'pointer',
                                    fontSize: '16px',
                                    padding: 0,
                                    transition: 'color 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.target.style.color = '#dc2626'}
                                  onMouseLeave={(e) => e.target.style.color = '#d1d5db'}
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}
