import React, { useState } from 'react';
import { 
  Square, 
  CheckSquare, 
  Trash2, 
  User, 
  ChevronRight, 
  X, 
  Search, 
  Plus 
} from 'lucide-react';
import { Todo, Customer } from '../types';

interface Props {
  todos: Todo[];
  customers: Customer[];
  onAddTodo: (text: string, customerId?: string, customerName?: string) => void;
  onToggleTodo: (todoId: string, done: boolean) => void;
  onEditTodo: (todoId: string, text: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onOpenCustomer: (customerId: string) => void;
}

const DAY = 86_400_000;

export function TodoView({
  todos,
  customers,
  onAddTodo,
  onToggleTodo,
  onEditTodo,
  onDeleteTodo,
  onOpenCustomer,
}: Props) {
  const [text, setText] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [attachedCustomer, setAttachedCustomer] = useState<{ id: string; name: string } | null>(null);

  // Editing state for inline edits
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const [now] = useState(() => Date.now());
  const ageMs = (ts?: { seconds: number } | null) => ts ? now - ts.seconds * 1000 : 0;
  
  const activeTodos = todos.filter(t => !t.done && ageMs(t.createdAt) < 14 * DAY);
  const doneTodos   = todos.filter(t =>  t.done && t.completedAt && ageMs(t.completedAt) < DAY);

  function relAge(ts?: { seconds: number } | null): string {
    if (!ts) return 'just now';
    const m = Math.floor((now - ts.seconds * 1000) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const handleAddSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;

    onAddTodo(
      text.trim(), 
      attachedCustomer?.id, 
      attachedCustomer?.name
    );

    setText('');
    setAttachedCustomer(null);
    setSearchQuery('');
    setShowCustomerSearch(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddSubmit();
    }
  };

  const handleStartEdit = (todo: Todo) => {
    if (todo.id) {
      setEditingTodoId(todo.id);
      setEditingText(todo.text);
    }
  };

  const handleSaveEdit = (todoId: string, originalText: string) => {
    const trimmed = editingText.trim();
    if (trimmed && trimmed !== originalText) {
      onEditTodo(todoId, trimmed);
    }
    setEditingTodoId(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, todoId: string, originalText: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(todoId, originalText);
    } else if (e.key === 'Escape') {
      setEditingTodoId(null);
    }
  };

  // Up to 6 case-insensitive matching customers
  const matchingCustomers = searchQuery.trim() 
    ? customers
        .filter(c => {
          const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
          return fullName.includes(searchQuery.toLowerCase());
        })
        .slice(0, 6)
    : [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-24 md:pb-8 font-sans">
      <header className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">To-Do</h2>
        <p className="text-gray-500 font-medium">
          Personal work tasks. Track checklist items and optionally attach a customer.
        </p>
      </header>

      {/* Add Todo Block */}
      <div className="card p-5 bg-white border border-gray-100 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            className="input flex-1 min-w-0"
            placeholder="Add a task…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="flex gap-2">
            {!attachedCustomer && !showCustomerSearch && (
              <button
                type="button"
                onClick={() => setShowCustomerSearch(true)}
                className="btn-sub whitespace-nowrap"
              >
                Attach customer
              </button>
            )}
            <button
              type="button"
              onClick={() => handleAddSubmit()}
              disabled={!text.trim()}
              className="btn flex items-center justify-center gap-1.5 px-6 leading-none cursor-pointer"
            >
              <Plus size={16} />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Customer Search Interface */}
        {showCustomerSearch && !attachedCustomer && (
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3">
            <div className="flex items-center gap-2 justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Search Customers</span>
              <button 
                type="button"
                onClick={() => { setShowCustomerSearch(false); setSearchQuery(''); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Type customer name..."
                className="input pl-10 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            {matchingCustomers.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-xl divide-y divide-gray-50 shadow-xs max-h-48 overflow-y-auto">
                {matchingCustomers.map(c => {
                  const name = `${c.firstName} ${c.lastName}`;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setAttachedCustomer({ id: c.id!, name });
                        setSearchQuery('');
                        setShowCustomerSearch(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm font-medium transition-colors flex items-center justify-between"
                    >
                      <span>{name}</span>
                      <span className="text-xs text-gray-400 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-full font-bold uppercase transition-colors">
                        Select
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {searchQuery.trim() && matchingCustomers.length === 0 && (
              <p className="text-xs text-gray-400 font-medium italic">No matching customers found.</p>
            )}
          </div>
        )}

        {/* Attached Customer Removable Chip */}
        {attachedCustomer && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
              <User size={14} />
              <span>{attachedCustomer.name}</span>
              <button
                type="button"
                onClick={() => setAttachedCustomer(null)}
                className="text-amber-500 hover:text-amber-700 focus:outline-none ml-1 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Todo items list card/container */}
      <div className="space-y-6">
        {/* Active Todos List */}
        {activeTodos.length > 0 && (
          <div className="grid grid-cols-1 gap-4">
            {activeTodos.map(todo => {
              const isEditing = editingTodoId === todo.id;

              return (
                <div 
                  key={todo.id} 
                  className="card p-4 bg-white border border-gray-100 rounded-2xl flex items-start gap-4 hover:shadow-xs transition-all relative font-sans"
                >
                  {/* Left Checkbox */}
                  <button 
                    type="button"
                    onClick={() => onToggleTodo(todo.id!, true)}
                    className="mt-0.5 text-gray-300 hover:text-amber-500 transition-colors focus:outline-none cursor-pointer"
                  >
                    <Square size={20} />
                  </button>

                  <div className="flex-1 space-y-2 min-w-0 pr-12">
                    {/* Task Text Inline Editing */}
                    {isEditing ? (
                      <input
                        type="text"
                        className="input py-1 px-2 text-sm w-full font-semibold text-gray-900 border-amber-300 focus:ring-amber-500"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onBlur={() => handleSaveEdit(todo.id!, todo.text)}
                        onKeyDown={(e) => handleEditKeyDown(e, todo.id!, todo.text)}
                        autoFocus
                      />
                    ) : (
                      <p 
                        onClick={() => handleStartEdit(todo)}
                        className="text-sm font-semibold text-gray-800 break-words hover:text-amber-900 leading-tight cursor-text"
                      >
                        {todo.text}
                      </p>
                    )}

                    {/* Customer Tappable Chip */}
                    {todo.customerName && todo.customerId && (
                      <button
                        type="button"
                        onClick={() => onOpenCustomer(todo.customerId!)}
                        className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200/60 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 transition-colors"
                      >
                        <User size={13} className="text-gray-400" />
                        <span>{todo.customerName}</span>
                        <ChevronRight size={13} className="text-gray-400" />
                      </button>
                    )}
                  </div>

                  {/* Stamp and Actions absolute or aligned right */}
                  <div className="absolute right-4 top-4 flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                      {relAge(todo.createdAt)}
                    </span>
                    <button 
                      type="button"
                      onClick={() => onDeleteTodo(todo.id!)}
                      className="text-gray-300 hover:text-red-500 transition-colors focus:outline-none cursor-pointer"
                      title="Delete Task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Done Category */}
        {doneTodos.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Done</h3>
            <div className="grid grid-cols-1 gap-3">
              {doneTodos.map(todo => (
                <div 
                  key={todo.id} 
                  className="card p-4 bg-gray-50/70 border border-gray-100 rounded-2xl flex items-start gap-4 hover:shadow-xs transition-all relative font-sans opacity-70"
                >
                  {/* Checked Box */}
                  <button 
                    type="button"
                    onClick={() => onToggleTodo(todo.id!, false)}
                    className="mt-0.5 text-amber-500 hover:text-gray-400 transition-colors focus:outline-none cursor-pointer"
                  >
                    <CheckSquare size={20} />
                  </button>

                  <div className="flex-1 space-y-1.5 min-w-0 pr-12">
                    <p className="text-sm font-semibold text-gray-400 line-through break-words leading-tight">
                      {todo.text}
                    </p>
                    {todo.customerName && todo.customerId && (
                      <button
                        type="button"
                        onClick={() => onOpenCustomer(todo.customerId!)}
                        className="flex items-center gap-1.5 bg-white border border-gray-100 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-400 cursor-pointer pointer-events-auto hover:bg-gray-50"
                      >
                        <User size={13} className="text-gray-300" />
                        <span>{todo.customerName}</span>
                        <ChevronRight size={13} className="text-gray-300" />
                      </button>
                    )}
                  </div>

                  {/* Stamp and Actions */}
                  <div className="absolute right-4 top-4 flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                      {relAge(todo.completedAt)}
                    </span>
                    <button 
                      type="button"
                      onClick={() => onDeleteTodo(todo.id!)}
                      className="text-gray-300 hover:text-red-500 transition-colors focus:outline-none cursor-pointer"
                      title="Delete Task"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {activeTodos.length === 0 && doneTodos.length === 0 && (
          <div className="text-center py-12 card border border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-400 font-medium text-sm">No tasks yet — add one above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
