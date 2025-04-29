// 1. Fix the vsLight import - import 'vs' instead
import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { nanoid } from 'nanoid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Mic, MicOff, Sun, Moon, MessageSquare, Download, Copy, 
  Trash2, Play, Zap, Plus, Upload, X, PanelLeft,
  Settings, Code, Github, ChevronDown, RefreshCcw, Terminal
} from 'lucide-react';

function App() {
  const [instruction, setInstruction] = useState('');
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [theme, setTheme] = useState('dark'); // dark, light, cyberpunk, minimal
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [chatPopupTabId, setChatPopupTabId] = useState(null);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const recognitionRef = useRef(null);
  const tabsRef = useRef(null);

  useEffect(() => {
    const newTab = createNewTab('Main Session');
    setTabs([newTab]);
    setActiveTabId(newTab.id);
    
    const savedTheme = localStorage.getItem('codegenTheme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      setTheme('light');
    }
  }, []);

  useEffect(() => {
    document.body.className = `${theme}-mode`;
    localStorage.setItem('codegenTheme', theme);
    
    // Theme transition animation
    const overlay = document.createElement('div');
    overlay.className = 'theme-transition-overlay active';
    document.body.appendChild(overlay);
    
    setTimeout(() => {
      overlay.classList.remove('active');
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 500);
    }, 50);
  }, [theme]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        setMicError('Mic error: ' + event.error);
        showToast(`Microphone error: ${event.error}`, 'error');
        setIsListening(false);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join('');
        setInstruction(transcript);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Scroll active tab into view
  useEffect(() => {
    if (activeTabId && tabsRef.current) {
      const activeTabElement = tabsRef.current.querySelector(`.tab.active`);
      if (activeTabElement) {
        activeTabElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  }, [activeTabId]);

  const createNewTab = (title = 'New Tab') => ({
    id: nanoid(),
    title,
    code: '',
    chats: [],
    createdAt: new Date()
  });

  const updateTab = (tabId, updates) => {
    setTabs((tabs) =>
      tabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      )
    );
  };

  const handleGenerateCode = async () => {
    if (!instruction.trim()) {
      showToast('Please enter an instruction first', 'error');
      return;
    }
    
    try {
      showToast('Generating code...', 'info');
      
      const res = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instruction,
          previousCode: tabs.find(t => t.id === activeTabId)?.code || '',
          context: tabs.find(t => t.id === activeTabId)?.history || []
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        updateTab(activeTabId, { 
          code: data.code,
          history: [
            ...(tabs.find(t => t.id === activeTabId)?.history || []),
            { instruction, code: data.code, timestamp: new Date() }
          ]
        });
        showToast('✨ Code generated successfully', 'success');
        setInstruction('');
      } else {
        throw new Error(data.error || 'Failed to generate code');
      }
    } catch (error) {
      showToast(`❌ ${error.message}`, 'error');
    }
  };

  const handleRunCode = async () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab?.code) {
      showToast('No code to run', 'error');
      return;
    }
    
    try {
      showToast('Running code...', 'info');
      
      const res = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: tab.code }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        // Create a modal to display the result
        const modal = document.createElement('div');
        modal.className = 'code-result-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'code-result-content';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '&times;';
        closeBtn.className = 'code-result-close';
        closeBtn.onclick = () => document.body.removeChild(modal);
        
        const title = document.createElement('h3');
        title.innerText = 'Code Execution Result';
        
        const result = document.createElement('pre');
        result.className = 'code-result-output';
        result.innerText = data.result;
        
        modalContent.appendChild(closeBtn);
        modalContent.appendChild(title);
        modalContent.appendChild(result);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Add animation
        setTimeout(() => {
          modal.classList.add('show');
        }, 10);
      } else {
        throw new Error(data.error || 'Failed to run code');
      }
    } catch (error) {
      showToast(`❌ ${error.message}`, 'error');
    }
  };

  const handleChatAsk = async () => {
    if (!chatQuestion.trim()) {
      showToast('Please enter a question', 'error');
      return;
    }
    
    setChatLoading(true);
    const tab = tabs.find((t) => t.id === chatPopupTabId);
    
    try {
      const res = await fetch('/api/chat-about-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: tab.code, question: chatQuestion }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        const updatedChats = [...(tab.chats || []), {
          question: chatQuestion,
          answer: data.answer,
          timestamp: new Date()
        }];
        
        updateTab(chatPopupTabId, { chats: updatedChats });
        setChatQuestion('');
        
        // Scroll to bottom of chat after a brief delay
        setTimeout(() => {
          const chatBody = document.querySelector('.chat-popup-body');
          if (chatBody) {
            chatBody.scrollTop = chatBody.scrollHeight;
          }
        }, 100);
      } else {
        throw new Error(data.error || 'Failed to get an answer');
      }
    } catch (error) {
      showToast(`❌ ${error.message}`, 'error');
    } finally {
      setChatLoading(false);
    }
  };

  const handleImportCode = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      updateTab(activeTabId, { code: content });
      showToast('📥 Code imported successfully', 'success');
    };
    reader.readAsText(file);
    
    // Reset the input value so the same file can be uploaded again
    e.target.value = '';
  };

  const handlePluginAction = async (pluginName) => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab?.code) {
      showToast('No code to process', 'error');
      return;
    }
    
    try {
      showToast(`Running ${pluginName}...`, 'info');
      
      const res = await fetch(`/api/plugin/${pluginName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: tab.code }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        updateTab(activeTabId, { code: data.result });
        showToast(`✅ Code ${pluginName} complete`, 'success');
      } else {
        throw new Error(data.error || `Failed to ${pluginName} code`);
      }
    } catch (error) {
      showToast(`❌ ${error.message}`, 'error');
    }
  };
  
  const startMic = () => {
    if (!recognitionRef.current) {
      showToast('Speech recognition not supported in your browser', 'error');
      return;
    }

    try {
      setMicError('');
      recognitionRef.current.start();
    } catch (error) {
      setMicError('Mic already running or unavailable');
      showToast('Microphone already running or unavailable', 'error');
    }
  };

  const stopMic = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
      setToast({ visible: false, message: '', type: '' });
    }, 3000);
  };

  // 2. Fix the ESLint error - use window.confirm instead of confirm
  const removeTab = (tabId) => {
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    
    if (newTabs.length === 0) {
      // If there are no tabs left, create a new one
      const newTab = createNewTab('New Session');
      setTabs([newTab]);
      setActiveTabId(newTab.id);
    } else if (activeTabId === tabId) {
      // If the active tab is being removed, activate the next available tab
      setActiveTabId(newTabs[0].id);
      setTabs(newTabs);
    } else {
      // Otherwise just remove the tab
      setTabs(newTabs);
    }
  };

  // Get the currently active tab
  const activeTab = tabs.find((t) => t.id === activeTabId) || { code: '' };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>
          <Code className="app-logo" size={28} />
          AI CodeGen Studio
        </h1>
        <div className="header-actions">
          <label className="upload-btn">
            <Upload size={16} />
            <input type="file" accept=".py,.js,.html,.css,.txt" onChange={handleImportCode} hidden />
            Import
          </label>
          
          <div className="theme-selector">
            <button 
              onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)} 
              className="theme-toggle"
            >
              {theme === 'dark' && <Moon size={18} />}
              {theme === 'light' && <Sun size={18} />}
              {theme === 'cyberpunk' && <Zap size={18} />}
              {theme === 'minimal' && <Settings size={18} />}
            </button>
            
            {isThemeMenuOpen && (
              <div className="theme-menu">
                <div 
                  className="theme-option" 
                  onClick={() => {
                    setTheme('dark');
                    setIsThemeMenuOpen(false);
                  }}
                >
                  <div className="theme-preview" style={{background: '#1f2937'}}></div>
                  Dark Mode
                </div>
                <div 
                  className="theme-option" 
                  onClick={() => {
                    setTheme('light');
                    setIsThemeMenuOpen(false);
                  }}
                >
                  <div className="theme-preview" style={{background: '#ffffff'}}></div>
                  Light Mode
                </div>
                <div 
                  className="theme-option" 
                  onClick={() => {
                    setTheme('cyberpunk');
                    setIsThemeMenuOpen(false);
                  }}
                >
                  <div className="theme-preview" style={{background: '#190544'}}></div>
                  Cyberpunk
                </div>
                <div 
                  className="theme-option" 
                  onClick={() => {
                    setTheme('minimal');
                    setIsThemeMenuOpen(false);
                  }}
                >
                  <div className="theme-preview" style={{background: '#f8f8f8'}}></div>
                  Minimal
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="tabs" ref={tabsRef}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.title}
            {tabs.length > 1 && (
              <button 
                className="tab-close" 
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        <button 
          className="tab-add"
          onClick={() => {
            const newTab = createNewTab(`Session ${tabs.length + 1}`);
            setTabs([...tabs, newTab]);
            setActiveTabId(newTab.id);
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="input-section">
        <textarea
          placeholder="Describe what code you want or how to modify existing code..."
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            // Submit on Ctrl+Enter or Cmd+Enter
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleGenerateCode();
            }
          }}
        />

        <div className="input-actions">
          <button 
            className={`mic-btn ${isListening ? 'listening' : ''}`} 
            onClick={isListening ? stopMic : startMic}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            {isListening ? 'Stop' : 'Voice'}
          </button>
          <button onClick={handleGenerateCode} className="generate-btn">
            <Zap size={18} /> Generate Code
          </button>
        </div>
      </div>

      <div className="code-actions">
        <button onClick={() => {
          navigator.clipboard.writeText(activeTab.code);
          showToast('Code copied to clipboard', 'success');
        }}>
          <Copy size={16} /> Copy
        </button>
        <button onClick={() => {
          const blob = new Blob([activeTab.code], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'code.py';
          a.click();
          URL.revokeObjectURL(url);
        }}>
          <Download size={16} /> Download
        </button>
        <button onClick={handleRunCode}>
          <Play size={16} /> Run
        </button>
        <button onClick={() => setChatPopupTabId(activeTabId)}>
          <MessageSquare size={16} /> Chat
        </button>
        <button onClick={() => {
          // 2. Fix the ESLint error - use window.confirm instead of confirm
          if (window.confirm('Are you sure you want to clear the code?')) {
            updateTab(activeTabId, { code: '' });
            showToast('Code cleared', 'success');
          }
        }}>
          <Trash2 size={16} /> Clear
        </button>
        <button onClick={() => handlePluginAction('optimize')}>
          <RefreshCcw size={16} /> Optimize
        </button>
        <button onClick={() => handlePluginAction('debug')}>
          <Terminal size={16} /> Debug
        </button>
        <button onClick={() => handlePluginAction('convert-to-oop')}>
          <PanelLeft size={16} /> OOP
        </button>
      </div>

      <div className="code-box">
        <div className="editor-header">
          <span className="editor-title">{activeTab?.title || 'Code Editor'}</span>
          <div className="editor-actions">
            <span className="editor-language">Python</span>
          </div>
        </div>
        <SyntaxHighlighter
          language="python"
          style={theme === 'light' || theme === 'minimal' ? vs : vscDarkPlus}
          showLineNumbers
          wrapLines={true}
        >
          {activeTab?.code || '# Generated code will appear here...\n# 1. Enter a description in the text area above\n# 2. Click "Generate Code" to create your code\n# 3. Run, optimize, or chat about your code using the buttons'}
        </SyntaxHighlighter>
      </div>

      {chatPopupTabId && (
        <div className="chat-popup">
          <div className="chat-popup-header">
            <h3>
              <MessageSquare size={16} />
              Code Assistant
            </h3>
            <button className="chat-close-btn" onClick={() => setChatPopupTabId(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="chat-popup-body">
            {(tabs.find((t) => t.id === chatPopupTabId)?.chats || []).length === 0 && (
              <div className="chat-welcome">
                <MessageSquare size={32} />
                <h4>Code Assistant</h4>
                <p>Ask questions about your code and get explanations, suggestions for improvements, or debugging help.</p>
              </div>
            )}
            {(tabs.find((t) => t.id === chatPopupTabId)?.chats || []).map((chat, i) => (
              <div key={i} className="chat-bubble">
                <div className="chat-q">
                  <span className="chat-icon">🧑</span>
                  {chat.question}
                </div>
                <div className="chat-a">
                  <span className="chat-icon">🤖</span>
                  {chat.answer}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="typing-indicator">
                <div className="typing-bubble"></div>
                <div className="typing-bubble"></div>
                <div className="typing-bubble"></div>
              </div>
            )}
          </div>
          <div className="chat-popup-footer">
            <input
              value={chatQuestion}
              onChange={(e) => setChatQuestion(e.target.value)}
              placeholder="Ask about this code..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleChatAsk();
                }
              }}
            />
            <button onClick={handleChatAsk}>
              <ChevronDown size={18} />
            </button>
          </div>
        </div>
      )}

      {toast.visible && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' && '✅ '}
          {toast.type === 'error' && '❌ '}
          {toast.type === 'info' && 'ℹ️ '}
          {toast.message}
        </div>
      )}

      <div className="floating-btn" onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}>
        <Zap size={24} />
      </div>

      <div className={`quick-actions ${isQuickActionsOpen ? 'active' : ''}`}>
        <div className="quick-action-btn tooltip" data-tooltip="GitHub" onClick={() => window.open('https://github.com', '_blank')}>
          <Github size={20} />
        </div>
        <div className="quick-action-btn tooltip" data-tooltip="New Tab" onClick={() => {
          const newTab = createNewTab(`Session ${tabs.length + 1}`);
          setTabs([...tabs, newTab]);
          setActiveTabId(newTab.id);
          setIsQuickActionsOpen(false);
        }}>
          <Plus size={20} />
        </div>
        <div className="quick-action-btn tooltip" data-tooltip="Chat" onClick={() => {
          setChatPopupTabId(activeTabId);
          setIsQuickActionsOpen(false);
        }}>
          <MessageSquare size={20} />
        </div>
      </div>

      {/* Code result modal - will be added dynamically */}
      <style jsx>{`
        .code-result-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .code-result-modal.show {
          opacity: 1;
        }
        
        .code-result-content {
          background: var(--bg-component);
          border-radius: var(--radius);
          width: 80%;
          max-width: 800px;
          max-height: 80vh;
          padding: 20px;
          position: relative;
          box-shadow: var(--shadow);
          overflow: auto;
          transform: translateY(20px);
          transition: transform 0.3s ease;
        }
        
        .code-result-modal.show .code-result-content {
          transform: translateY(0);
        }
        
        .code-result-close {
          position: absolute;
          right: 15px;
          top: 15px;
          background: rgba(255,255,255,0.1);
          border: none;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          color: var(--text-primary);
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .code-result-close:hover {
          background: rgba(255,255,255,0.2);
        }
        
        .code-result-output {
          background: var(--bg-main);
          padding: 15px;
          border-radius: 8px;
          margin-top: 15px;
          overflow: auto;
          max-height: 60vh;
          white-space: pre-wrap;
          font-family: monospace;
        }
        
        .chat-welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          height: 100%;
          gap: 10px;
          color: var(--text-secondary);
          padding: 20px;
        }
        
        .chat-icon {
          display: inline-block;
          width: 24px;
          height: 24px;
          margin-right: 8px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}

export default App;
