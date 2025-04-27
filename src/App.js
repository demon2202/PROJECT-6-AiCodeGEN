import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Moon, Sun, Mic, MicOff, Copy, Play, Download, Trash2, Plus, Code, Save, Check, AlertCircle, X } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula, tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { nanoid } from 'nanoid';

function CodeGenerator() {
  const [darkMode, setDarkMode] = useState(() => {
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [instruction, setInstruction] = useState('');
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: '' });
  const [activeTabId, setActiveTabId] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [keyboardShortcutsVisible, setKeyboardShortcutsVisible] = useState(false);
  const [exportFormat, setExportFormat] = useState('py');
  
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);
  const instructionInputRef = useRef(null);

  // Initialize a session on first load
  useEffect(() => {
    if (tabs.length === 0) {
      const newTab = createNewTab();
      setTabs([newTab]);
      setActiveTabId(newTab.id);
    }
  }, []);

  // Save dark mode to localStorage
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();

      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }

        if (finalTranscript.trim()) {
          setTranscript(finalTranscript.trim());
          setInstruction(finalTranscript.trim());
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        showToast('Speech recognition error', 'error');
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        clearTimeout(timeoutRef.current);
      };
    }

    // Set up keyboard shortcuts
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + Enter to generate code
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('instruction-form');
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
      
      // Cmd/Ctrl + Shift + N to create new tab
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        handleNewTab();
      }
      
      // Cmd/Ctrl + R to run code
      if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        const activeTab = tabs.find(tab => tab.id === activeTabId);
        if (activeTab && activeTab.code) {
          runCode(activeTab.code);
        }
      }
      
      // Escape to close modal
      if (e.key === 'Escape') {
        setKeyboardShortcutsVisible(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      clearTimeout(timeoutRef.current);
    };
  }, [tabs, activeTabId]);

  // Create new tab helper
  const createNewTab = () => {
    return {
      id: nanoid(),
      title: `Session ${tabs.length + 1}`,
      code: '',
      history: []
    };
  };

  const handleNewTab = () => {
    const newTab = createNewTab();
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setInstruction('');
    setTranscript('');
    
    // Focus instruction input after creating a new tab
    setTimeout(() => {
      if (instructionInputRef.current) {
        instructionInputRef.current.focus();
      }
    }, 0);
  };

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast('Speech recognition is not supported in your browser', 'error');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      try {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
          recognitionRef.current.start();
          timeoutRef.current = setTimeout(() => {
            recognitionRef.current.stop();
          }, 6000);
        }).catch((err) => {
          showToast('Microphone access denied or not available', 'error');
          console.error('getUserMedia error:', err);
        });
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!instruction.trim() || status === 'loading') return;

    setStatus('loading');
    const activeTab = tabs.find(tab => tab.id === activeTabId);
    
    try {
      const response = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, previousCode: activeTab?.code || '' })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate code');
      }

      // Update the tab's code and history
      const updatedTabs = tabs.map(tab => {
        if (tab.id === activeTabId) {
          // Update tab title based on the instruction if it's the first instruction
          let newTitle = tab.title;
          if (tab.history.length === 0) {
            newTitle = instruction.length > 30 
              ? instruction.substring(0, 30) + '...' 
              : instruction;
          }
          
          return {
            ...tab,
            code: data.code,
            title: newTitle,
            history: [...tab.history, { instruction, code: data.code, timestamp: new Date() }]
          };
        }
        return tab;
      });
      
      setTabs(updatedTabs);
      setInstruction('');
      setTranscript('');
      setStatus('success');
      showToast('Code generated successfully', 'success');
      
      // After 2 seconds, revert to idle state
      setTimeout(() => setStatus('idle'), 2000);
    } catch (error) {
      console.error('Error generating code:', error);
      showToast(error.message, 'error');
      setStatus('error');
      
      // After 2 seconds, revert to idle state
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const copyToClipboard = (code) => {
    navigator.clipboard.writeText(code);
    showToast('Code copied to clipboard', 'success');
  };

  const downloadCode = (code, format = exportFormat) => {
    const file = new Blob([code], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = `generated_code.${format}`;
    a.click();
    showToast(`Code downloaded as ${a.download}`, 'success');
  };

  const clearCode = () => {
    const updatedTabs = tabs.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, code: '' };
      }
      return tab;
    });
    setTabs(updatedTabs);
    showToast('Code cleared', 'info');
  };

  const runCode = async (code) => {
    if (!code) return;
    
    try {
      setStatus('loading');
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
  
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        showToast('Server error: Expected JSON but received something else', 'error');
        setStatus('error');
        return;
      }
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error || 'Code execution failed');
      }
  
      setStatus('success');
      showToast('Code executed successfully', 'success');
      
      // Show modal with output
      const outputModal = document.getElementById('output-modal');
      const outputContent = document.getElementById('output-content');
      if (outputModal && outputContent) {
        outputContent.textContent = data.result;
        outputModal.classList.add('show-modal');
      } else {
        alert(`✅ Code Output:\n${data.result}`);
      }
    } catch (error) {
      console.error('Error running code:', error);
      showToast('Failed to run the code', 'error');
      setStatus('error');
    } finally {
      // After 2 seconds, revert to idle state
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('show-modal');
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: '' }), 3000);
  };

  const removeTab = (tabId) => {
    // Don't remove if it's the only tab
    if (tabs.length === 1) {
      return;
    }
    
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);
    
    // If we're removing the active tab, activate the first tab
    if (tabId === activeTabId) {
      setActiveTabId(newTabs[0].id);
    }
  };

  const renameTab = (tabId, newTitle) => {
    if (!newTitle) return;
    
    const updatedTabs = tabs.map(tab => {
      if (tab.id === tabId) {
        return { ...tab, title: newTitle };
      }
      return tab;
    });
    
    setTabs(updatedTabs);
  };

  const handleHistoryItemClick = (historyItem) => {
    // Update the code with the selected history item
    const updatedTabs = tabs.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, code: historyItem.code };
      }
      return tab;
    });
    
    setTabs(updatedTabs);
  };

  const activeTab = tabs.find(tab => tab.id === activeTabId) || {};

  return (
    <div className="code-generator-container">
      <header>
        <div className="logo-container">
          <Code size={24} />
          <h1>AI CodeGen</h1>
        </div>
        <div className="header-actions">
          <button className="header-button" onClick={() => setKeyboardShortcutsVisible(true)}>
            Shortcuts
          </button>
          <button className="theme-toggle" onClick={toggleDarkMode}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <div className="tabs-container">
        <div className="tabs">
          {tabs.map(tab => (
            <div 
              key={tab.id}
              className={`tab ${activeTabId === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="tab-title" 
                onDoubleClick={(e) => {
                  const newTitle = prompt('Rename this tab:', tab.title);
                  if (newTitle) renameTab(tab.id, newTitle);
                }}
              >
                {tab.title || `Session ${tabs.indexOf(tab) + 1}`}
              </span>
              {tabs.length > 1 && (
                <button className="close-tab" onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}>
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button className="new-tab" onClick={handleNewTab}>
            <Plus size={16} />
          </button>
        </div>
      </div>

      <main>
        <section className="input-section">
          <form id="instruction-form" onSubmit={handleSubmit}>
            <div className="input-container">
              <input
                ref={instructionInputRef}
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Type or speak your instruction... (Ctrl+Enter to submit)"
                disabled={status === 'loading'}
              />
              <button
                type="button"
                className={`mic-button ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                disabled={status === 'loading'}
                title="Record voice instruction"
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                type="submit"
                className={`submit-button ${status === 'loading' ? 'loading' : status === 'success' ? 'success' : status === 'error' ? 'error' : ''}`}
                disabled={status === 'loading' || !instruction.trim()}
              >
                {status === 'loading' ? 'Processing...' : status === 'success' ? <Check size={18} /> : status === 'error' ? <AlertCircle size={18} /> : 'Generate Code'}
              </button>
            </div>

            {transcript && (
              <div className="voice-feedback">
                <p><strong>Transcript:</strong> {transcript}</p>
              </div>
            )}
          </form>

          <div className="history-section">
            <h3>Instruction History</h3>
            <div className="history-list">
              {activeTab.history?.length === 0 ? (
                <p className="no-history">No instructions yet.</p>
              ) : (
                activeTab.history?.map((item, i) => (
                  <div key={i} className="history-item" onClick={() => handleHistoryItemClick(item)}>
                    <div className="history-instruction">{item.instruction}</div>
                    <div className="history-timestamp">{new Date(item.timestamp).toLocaleTimeString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="code-section">
          <div className="code-header">
            <h3>Generated Code</h3>
            <div className="code-actions">
              <div className="export-format">
                <select 
                  value={exportFormat} 
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="format-select"
                >
                  <option value="py">Python (.py)</option>
                  <option value="txt">Text (.txt)</option>
                  <option value="ipynb">Jupyter Notebook (.ipynb)</option>
                </select>
              </div>
              <button className="action-button" onClick={() => copyToClipboard(activeTab.code)} disabled={!activeTab.code}>
                <Copy size={16} /> Copy
              </button>
              <button className="action-button" onClick={() => downloadCode(activeTab.code)} disabled={!activeTab.code}>
                <Download size={16} /> Download
              </button>
              <button className="action-button" onClick={() => runCode(activeTab.code)} disabled={!activeTab.code || status === 'loading'}>
                <Play size={16} /> Run
              </button>
              <button className="action-button danger" onClick={clearCode} disabled={!activeTab.code}>
                <Trash2 size={16} /> Clear
              </button>
            </div>
          </div>
          <div className="code-editor-container">
            <SyntaxHighlighter
              language="python"
              style={darkMode ? dracula : tomorrow}
              className="code-editor"
              wrapLines={true}
              showLineNumbers={true}
            >
              {activeTab.code || '# Your Python code will appear here'}
            </SyntaxHighlighter>
          </div>
        </section>
      </main>

      <footer>
        <p>© {new Date().getFullYear()} AI CodeGen | Keyboard shortcuts: Ctrl+Enter to generate, Ctrl+Shift+N for new tab, Ctrl+R to run code</p>
      </footer>

      {/* Output Modal */}
      <div id="output-modal" className="modal">
        <div className="modal-content">
          <div className="modal-header">
            <h3>Code Output</h3>
            <button className="close-modal" onClick={() => closeModal('output-modal')}>×</button>
          </div>
          <div className="modal-body">
            <pre id="output-content" className="output-content"></pre>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      <div id="keyboard-shortcuts-modal" className={`modal ${keyboardShortcutsVisible ? 'show-modal' : ''}`}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Keyboard Shortcuts</h3>
            <button className="close-modal" onClick={() => setKeyboardShortcutsVisible(false)}>×</button>
          </div>
          <div className="modal-body">
            <table className="shortcuts-table">
              <tbody>
                <tr>
                  <td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td>
                  <td>Generate code</td>
                </tr>
                <tr>
                  <td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>N</kbd></td>
                  <td>New tab</td>
                </tr>
                <tr>
                  <td><kbd>Ctrl</kbd> + <kbd>R</kbd></td>
                  <td>Run code</td>
                </tr>
                <tr>
                  <td><kbd>Esc</kbd></td>
                  <td>Close modal</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <div className={`toast ${toast.visible ? 'show-toast' : ''} ${toast.type}`}>
        <div className="toast-content">
          {toast.type === 'success' && <Check size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          {toast.type === 'info' && <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      </div>
    </div>
  );
}

export default CodeGenerator;
