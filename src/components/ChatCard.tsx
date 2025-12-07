import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message, ResourceLink } from '@/types';
import { cn } from '@/lib/utils';

interface ChatCardProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onResourceClick: (resource: ResourceLink) => void;
  isLoading?: boolean;
}

export function ChatCard({ messages, onSendMessage, onResourceClick, isLoading }: ChatCardProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const getAgentColor = (agent?: string) => {
    switch (agent) {
      case 'scripture': return 'scripture';
      case 'notes': return 'notes';
      case 'questions': return 'questions';
      case 'academy': return 'academy';
      case 'words': return 'words';
      default: return 'scripture';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Swipe indicator */}
      <div className="pt-4 pb-2">
        <div className="swipe-indicator" />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 fade-edges">
        <div className="max-w-2xl mx-auto space-y-6 pt-4">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16"
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6 glow-primary">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-medium text-foreground mb-2">
                Begin Your Study
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                Ask about any passage, topic, or word. Swipe left to explore scripture and resources.
              </p>
            </motion.div>
          )}

          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                'flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'glass-card ai-message'
                )}
              >
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="text-primary font-semibold">{children}</strong>,
                      em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                      ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2 ml-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2 ml-2">{children}</ol>,
                      li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                      h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 text-primary">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-base font-semibold mb-2 mt-3 text-primary">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-2 text-accent">{children}</h3>,
                      h4: ({ children }) => <h4 className="text-sm font-medium mb-1 mt-2 text-foreground">{children}</h4>,
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-primary/50 pl-3 my-2 italic text-muted-foreground">
                          {children}
                        </blockquote>
                      ),
                      code: ({ children, className }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono text-accent">
                            {children}
                          </code>
                        ) : (
                          <code className="block bg-muted/30 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2">
                            {children}
                          </code>
                        );
                      },
                      pre: ({ children }) => <pre className="bg-muted/30 p-3 rounded-lg overflow-x-auto my-2">{children}</pre>,
                      a: ({ href, children }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
                          {children}
                        </a>
                      ),
                      hr: () => <hr className="border-border/30 my-3" />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>

                {message.resources && message.resources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30 space-y-1">
                    {message.resources.map((resource, i) => (
                      <button
                        key={i}
                        onClick={() => onResourceClick(resource)}
                        className="inline-resource text-xs block text-left"
                      >
                        {resource.type === 'scripture' && '📖'} 
                        {resource.type === 'note' && '📝'} 
                        {resource.type === 'question' && '❓'} 
                        {resource.type === 'academy' && '🎓'} 
                        {resource.type === 'word' && '📚'} 
                        {resource.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="glass-card rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-accent rounded-full animate-pulse-subtle" />
                  <span className="w-2 h-2 bg-accent rounded-full animate-pulse-subtle" style={{ animationDelay: '0.2s' }} />
                  <span className="w-2 h-2 bg-accent rounded-full animate-pulse-subtle" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="p-4 pt-0">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <div className="glass-card rounded-2xl p-2 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask about scripture..."
              rows={1}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground 
                         resize-none outline-none px-3 py-2 text-sm max-h-32"
              style={{ minHeight: '40px' }}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className={cn(
                'p-2 rounded-xl transition-all duration-200',
                input.trim() && !isLoading
                  ? 'bg-primary text-primary-foreground glow-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
