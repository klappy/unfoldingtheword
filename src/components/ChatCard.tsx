import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, Globe, Languages, Loader2, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Message, ResourceLink } from '@/types';
import { cn } from '@/lib/utils';
import { TranslationStrings } from '@/i18n/translations';
import { useResetSession } from '@/hooks/useResetSession';

interface ChatCardProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  onResourceClick: (resource: ResourceLink) => void;
  isLoading?: boolean;
  currentLanguage?: { id: string; name: string; nativeName?: string } | null;
  onChangeLanguage?: () => void;
  t: (key: keyof TranslationStrings) => string;
  hasStaticTranslations?: boolean;
  onTranslateUi?: () => void;
  isTranslatingUi?: boolean;
}

export function ChatCard({ messages, onSendMessage, onResourceClick, isLoading, currentLanguage, onChangeLanguage, t, hasStaticTranslations, onTranslateUi, isTranslatingUi }: ChatCardProps) {
  const [input, setInput] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { resetSession } = useResetSession();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      const trimmedInput = input.trim().toLowerCase();
      // Detect reset command
      if (trimmedInput === 'reset' || trimmedInput === 'reset all' || trimmedInput === 'clear all data') {
        setInput('');
        setShowResetConfirm(true);
        return;
      }
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    await resetSession();
    // Page will reload after reset
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

  // Empty state with centered input
  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-full pt-4 relative">
        {/* Language button - top right */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {/* Translate UI button - show when no static translations */}
          {!hasStaticTranslations && onTranslateUi && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              onClick={onTranslateUi}
              disabled={isTranslatingUi}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full 
                         bg-primary/20 hover:bg-primary/30 text-primary text-xs transition-colors disabled:opacity-50"
            >
              {isTranslatingUi ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Languages className="w-3.5 h-3.5" />
              )}
              <span>{t('chat.translateUi')}</span>
            </motion.button>
          )}
          
          {currentLanguage && onChangeLanguage && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={onChangeLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full 
                         bg-muted/50 hover:bg-muted text-muted-foreground text-xs transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{currentLanguage.nativeName || currentLanguage.name}</span>
            </motion.button>
          )}
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-6"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6 glow-primary">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-medium text-foreground mb-2">
              {t('chat.welcome.title')}
            </h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {t('chat.welcome.subtitle')}
            </p>
          </motion.div>

          {/* Input directly below intro text */}
          <form onSubmit={handleSubmit} className="w-full max-w-md">
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
                placeholder={t('chat.placeholder')}
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

  return (
    <div className="flex flex-col h-full pt-4">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 fade-edges">
        <div className="max-w-2xl mx-auto space-y-6 pt-4">

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
                  
                  {/* Inline streaming indicator */}
                  {message.isStreaming && (
                    <span className="inline-flex gap-1 ml-1 align-middle">
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-subtle" />
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-subtle" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-subtle" style={{ animationDelay: '0.4s' }} />
                    </span>
                  )}
                </div>

                {message.resources && message.resources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30 space-y-3">
                    {message.resources.map((resource, i) => (
                      <button
                        key={i}
                        onClick={() => onResourceClick(resource)}
                        className="inline-resource text-sm block text-left py-1"
                      >
                        {resource.type === 'scripture' && '📖 '} 
                        {resource.type === 'note' && '📝 '} 
                        {resource.type === 'question' && '❓ '} 
                        {resource.type === 'academy' && '🎓 '} 
                        {resource.type === 'word' && '📚 '}
                        {resource.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {/* Only show separate loading bubble before streaming starts (initial loading) */}
          {isLoading && !messages.some(m => m.isStreaming) && (
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
              placeholder={t('chat.placeholder')}
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

      {/* Reset confirmation dialog */}
      {showResetConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="glass-card rounded-2xl p-6 max-w-sm w-full space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-destructive" />
              </div>
              <h3 className="text-lg font-medium text-foreground">Reset Everything?</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              This will permanently delete all your conversations, notes, and language preferences. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="px-4 py-2 text-sm bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isResetting && <Loader2 className="w-3 h-3 animate-spin" />}
                {isResetting ? 'Resetting...' : 'Yes, reset'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
