import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { docco, atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

function App() {
  const [command, setCommand] = useState('');
  const [code, setCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('explanation');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [executionResult, setExecutionResult] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [complexity, setComplexity] = useState({ time: '', space: '', description: '' });
  const [codeSections, setCodeSections] = useState([]);
  const [isCodePanelOpen, setIsCodePanelOpen] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [templates, setTemplates] = useState([
    { name: '🔄 File Operations', command: 'Create a function to read and write to a CSV file' },
    { name: '🕸️ Web Scraper', command: 'Create a simple web scraper using BeautifulSoup' },
    { name: '📊 Data Analysis', command: 'Create a function to analyze a dataset with pandas' },
    { name: '🌐 API Client', command: 'Create a function to fetch data from a REST API' },
    { name: '🧠 ML Model', command: 'Create a simple machine learning classification model using scikit-learn' },
    { name: '🔍 Text Processing', command: 'Create a function to extract keywords from a text document' },
  ]);
  
  const codeOutputRef = useRef(null);
  const textareaRef = useRef(null);
  const codeSectionsPanelRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.body.classList.add('dark-mode');
    }
    
    // Load from local storage
    const savedCommand = localStorage.getItem('currentCommand');
    const savedCode = localStorage.getItem('currentCode');
    const savedExplanation = localStorage.getItem('currentExplanation');
    
    if (savedCommand) setCommand(savedCommand);
    if (savedCode) setCode(savedCode);
    if (savedExplanation) setExplanation(savedExplanation);
    
    // Add global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Save current state to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('currentCommand', command);
    localStorage.setItem('currentCode', code);
    localStorage.setItem('currentExplanation', explanation);
  }, [command, code, explanation]);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    // Handle click outside the code sections panel
    function handleClickOutside(event) {
      if (codeSectionsPanelRef.current && !codeSectionsPanelRef.current.contains(event.target) && 
          !event.target.classList.contains('code-sections-toggle') &&
          !event.target.closest('.code-sections-toggle')) {
        setIsCodePanelOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Parse code sections whenever code changes
  useEffect(() => {
    if (code) {
      parseCodeSections(code);
      analyzeComplexity(code);
    }
  }, [code]);

  const fetchHistory = async () => {
    try {
      const response = await axios.get('http://localhost:5000/history');
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleGlobalKeyDown = (e) => {
    // Ctrl+G = Generate Code
    if (e.ctrlKey && e.key === 'g') {
      e.preventDefault();
      handleGenerateCode();
    }
    // Ctrl+S = Save Code
    else if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      handleSaveCode();
    }
    // Ctrl+C = Copy Code (only when code area is focused)
    else if (e.ctrlKey && e.key === 'c' && document.activeElement === codeOutputRef.current) {
      e.preventDefault();
      handleCopyCode();
    }
    // Ctrl+F = Toggle Full Screen
    else if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      toggleFullScreen();
    }
    // Ctrl+E = Execute Code
    else if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      executeCode();
    }
    // Ctrl+P = Toggle Code Panel
    else if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      toggleCodePanel();
    }
  };

  const handleGenerateCode = async () => {
    if (!command.trim()) {
      setError('Please enter a command');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const response = await axios.post('http://localhost:5000/generate_code', { command });
      setCode(response.data.code);
      setExplanation(response.data.explanation);
      fetchHistory(); // Refresh history after generating new code
    } catch (error) {
      setError('Error generating code. Please try again.');
      console.error('Error generating code:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (!window.webkitSpeechRecognition && !window.SpeechRecognition) {
      setError('Speech recognition is not supported in your browser');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setError('Listening...');
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setCommand(transcript);
      setError('');
    };
    
    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
    };
    
    recognition.start();
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleCopyCode = () => {
    if (!code) return;
    navigator.clipboard.writeText(code)
      .then(() => {
        setError('Code copied to clipboard!');
        setTimeout(() => setError(''), 2000);
      })
      .catch(() => {
        setError('Failed to copy code');
      });
  };

  const handleSaveCode = () => {
    if (!code) return;
    
    const element = document.createElement('a');
    const file = new Blob([code], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = 'generated_code.py';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleGenerateCode();
    }
  };

  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  const executeCode = async () => {
    if (!code) {
      setError('No code to execute');
      return;
    }
    
    setIsExecuting(true);
    setError('');
    setExecutionResult('');
    setActiveTab('execution');
    
    try {
      // Simulate code execution with a delay
      setTimeout(() => {
        try {
          // For demo purposes, we'll simulate execution
          // In a real app, you'd send to a backend
          let result = '';
          
          // Simple execution simulation for demo purposes
          // This tries to evaluate some basic Python-like code patterns
          if (code.includes('print(')) {
            const printMatches = code.match(/print\((.*?)\)/g);
            if (printMatches) {
              result = printMatches.map(match => {
                const content = match.substring(6, match.length - 1);
                try {
                  // Try to evaluate simple expressions
                  return eval(content);
                } catch {
                  return content.replace(/["']/g, '');
                }
              }).join('\n');
            }
          } else if (code.includes('def ')) {
            result = "Function defined successfully.";
            if (code.includes('class ')) {
              result += "\nClass defined successfully.";
            }
          } else {
            result = "Code executed successfully.";
          }
          
          setExecutionResult(result);
        } catch (err) {
          setExecutionResult(`Execution error: ${err.message}`);
        }
        setIsExecuting(false);
      }, 1500);
    } catch (error) {
      setError('Error executing code. Please check syntax and try again.');
      console.error('Error executing code:', error);
      setExecutionResult(error.message || 'Execution failed');
      setIsExecuting(false);
    }
  };

  const analyzeComplexity = (codeText) => {
    // This is a simplified complexity analyzer for demo purposes
    // In a real app, you would use a more sophisticated algorithm or backend service
    
    let timeComplexity = 'O(1)';
    let spaceComplexity = 'O(1)';
    let description = 'Constant time complexity';
    
    // Simple pattern matching for demo
    if (codeText.includes('for') && codeText.includes('for') && codeText.match(/for.*for/s)) {
      timeComplexity = 'O(n²)';
      description = 'Quadratic time complexity due to nested loops';
    } else if (codeText.includes('for')) {
      timeComplexity = 'O(n)';
      description = 'Linear time complexity due to loop iterations';
    }
    
    if (codeText.includes('append') || codeText.includes('extend')) {
      spaceComplexity = 'O(n)';
    }
    
    if (codeText.includes('recursion') || codeText.includes('recursive')) {
      timeComplexity = 'O(2^n)';
      spaceComplexity = 'O(n)';
      description = 'Exponential time complexity due to recursive calls';
    }
    
    setComplexity({
      time: timeComplexity,
      space: spaceComplexity,
      description: description
    });
  };

  const parseCodeSections = (codeText) => {
    // This is a simplified code section parser for demo purposes
    const sections = [];
    
    // Parse imports
    const importRegex = /^import .*$|^from .* import .*$/gm;
    const imports = codeText.match(importRegex);
    if (imports) {
      sections.push({
        title: 'Imports',
        code: imports.join('\n'),
        description: 'External modules and libraries used in the code'
      });
    }
    
    // Parse function definitions
    const functionRegex = /^def .*?\):/gm;
    const functions = codeText.match(functionRegex);
    if (functions) {
      functions.forEach(func => {
        const funcName = func.split('def ')[1].split('(')[0];
        const funcStart = codeText.indexOf(func);
        let funcEnd = codeText.length;
        
        // Find the end of the function by looking for the next function or class
        const nextFuncMatch = /^def .*?\):/gm.exec(codeText.slice(funcStart + func.length));
        const nextClassMatch = /^class .*?:/gm.exec(codeText.slice(funcStart + func.length));
        
        if (nextFuncMatch) {
          funcEnd = funcStart + func.length + nextFuncMatch.index;
        } else if (nextClassMatch) {
          funcEnd = funcStart + func.length + nextClassMatch.index;
        }
        
        // Extract the function code with proper indentation
        const funcCode = codeText.slice(funcStart, funcEnd).trim();
        
        sections.push({
          title: `Function: ${funcName}`,
          code: funcCode,
          description: `Function that ${funcName.replace(/_/g, ' ')}`
        });
      });
    }
    
    // Parse class definitions
    const classRegex = /^class .*?:/gm;
    const classes = codeText.match(classRegex);
    if (classes) {
      classes.forEach(cls => {
        const className = cls.split('class ')[1].split('(')[0].split(':')[0];
        sections.push({
          title: `Class: ${className}`,
          code: cls,
          description: `Class that defines ${className.replace(/_/g, ' ')}`
        });
      });
    }
    
    // Add main execution section if present
    if (codeText.includes('if __name__ == "__main__"')) {
      const mainCode = codeText.split('if __name__ == "__main__"')[1];
      sections.push({
        title: 'Main Execution',
        code: 'if __name__ == "__main__"' + mainCode,
        description: 'Entry point of the script when executed directly'
      });
    }
    
    // If no sections were identified, add the entire code as one section
    if (sections.length === 0) {
      sections.push({
        title: 'Complete Code',
        code: codeText,
        description: 'Full implementation'
      });
    }
    
    setCodeSections(sections);
  };

  const applyTemplate = (templateCommand) => {
    setCommand(templateCommand);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const toggleCodePanel = () => {
    setIsCodePanelOpen(!isCodePanelOpen);
  };

  const focusOnSection = (index) => {
    setActiveSectionIndex(index);
  };

  const getCodeSectionStyle = (index) => {
    const baseStyle = "code-section-tab";
    return index === activeSectionIndex ? baseStyle + " active" : baseStyle;
  };

  return (
    <div className="app-container">
      <header>
        <div className="app-title">
          <span role="img" aria-label="robot">🤖</span> CodeCraft AI
        </div>
        <div className="theme-toggle">
          <span>☀️</span>
          <label className="switch">
            <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
            <span className="slider round"></span>
          </label>
          <span>🌙</span>
        </div>
      </header>

      <div className="keyboard-shortcuts-info">
        <details>
          <summary>⌨️ Keyboard Shortcuts</summary>
          <div className="shortcuts-list">
            <p><strong>Ctrl+G</strong> - Generate Code</p>
            <p><strong>Ctrl+S</strong> - Save Code</p>
            <p><strong>Ctrl+C</strong> - Copy Code (when code area is focused)</p>
            <p><strong>Ctrl+F</strong> - Toggle Full Screen</p>
            <p><strong>Ctrl+E</strong> - Execute Code</p>
            <p><strong>Ctrl+P</strong> - Toggle Code Sections Panel</p>
            <p><strong>Ctrl+Enter</strong> - Generate Code (when input is focused)</p>
          </div>
        </details>
      </div>

      <div className="templates-section">
        <h3>✨ Code Templates</h3>
        <div className="templates-list">
          {templates.map((template, index) => (
            <button 
              key={index} 
              className="template-btn"
              onClick={() => applyTemplate(template.command)}
            >
              {template.name}
            </button>
          ))}
        </div>
      </div>

      <div className={`main-interface ${isFullScreen ? 'fullscreen' : ''}`}>
        <div className="input-section">
          <div className="section-header">
            <span>💬 Input</span>
            <button onClick={() => setCommand('')} className="action-btn">
              <span role="img" aria-label="Clear">🗑️</span>
            </button>
          </div>
          <div className="input-content">
            <textarea
              ref={textareaRef}
              className="code-input"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Describe what you want to create:&#10;Example: Create a function that calculates the fibonacci sequence"
              onKeyDown={handleKeyDown}
            />
          </div>
          <div className="controls">
            <button 
              className="generate-btn" 
              onClick={handleGenerateCode} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner"></span> Generating...
                </>
              ) : (
                <>
                  <span role="img" aria-label="Generate">✨</span> Generate Code
                </>
              )}
            </button>
            <button className="generate-btn voice-btn" onClick={handleVoiceInput}>
              <span role="img" aria-label="Microphone">🎤</span> Voice Input
            </button>
          </div>
        </div>

        <div className="output-section">
          <div className="section-header">
            <span>💻 Generated Code</span>
            <div className="code-actions">
              <button onClick={toggleCodePanel} className="action-btn code-sections-toggle">
                <span role="img" aria-label="Sections">🧩</span>
              </button>
              <button onClick={handleCopyCode} className="action-btn">
                <span role="img" aria-label="Copy">📋</span>
              </button>
              <button onClick={handleSaveCode} className="action-btn">
                <span role="img" aria-label="Save">💾</span>
              </button>
              <button onClick={executeCode} className="action-btn" disabled={isExecuting}>
                {isExecuting ? 
                  <span className="loading-spinner-small"></span> :
                  <span role="img" aria-label="Run">▶️</span>
                }
              </button>
              <button onClick={toggleFullScreen} className="action-btn">
                {isFullScreen ? 
                  <span role="img" aria-label="Exit Fullscreen">↙️</span> :
                  <span role="img" aria-label="Fullscreen">↗️</span>
                }
              </button>
            </div>
          </div>
          <div className="output-content">
            {code ? (
              <SyntaxHighlighter
                ref={codeOutputRef}
                language="python"
                style={darkMode ? atomOneDark : docco}
                className="code-display"
              >
                {code}
              </SyntaxHighlighter>
            ) : (
              <div className="code-display">
                Your generated code will appear here
              </div>
            )}
            
            {isCodePanelOpen && codeSections.length > 0 && (
              <div className="code-sections-panel" ref={codeSectionsPanelRef}>
                <div className="code-sections-header">
                  <h3>🧩 Code Sections</h3>
                  <button onClick={toggleCodePanel} className="close-panel-btn">✕</button>
                </div>
                <div className="code-sections-tabs">
                  {codeSections.map((section, index) => (
                    <div 
                      key={index}
                      className={getCodeSectionStyle(index)}
                      onClick={() => focusOnSection(index)}
                    >
                      {section.title}
                    </div>
                  ))}
                </div>
                <div className="code-section-content">
                  <h4>{codeSections[activeSectionIndex].title}</h4>
                  <p>{codeSections[activeSectionIndex].description}</p>
                  <SyntaxHighlighter
                    language="python"
                    style={darkMode ? atomOneDark : docco}
                    className="section-code-display"
                  >
                    {codeSections[activeSectionIndex].code}
                  </SyntaxHighlighter>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="explanation-section">
        <div className="footer-tabs">
          <div 
            className={`tab ${activeTab === 'explanation' ? 'active' : ''}`} 
            onClick={() => setActiveTab('explanation')}
          >
            <span role="img" aria-label="Explanation">📝</span> Explanation
          </div>
          <div 
            className={`tab ${activeTab === 'execution' ? 'active' : ''}`} 
            onClick={() => setActiveTab('execution')}
          >
            <span role="img" aria-label="Execution">▶️</span> Execution Result
          </div>
          <div 
            className={`tab ${activeTab === 'complexity' ? 'active' : ''}`} 
            onClick={() => setActiveTab('complexity')}
          >
            <span role="img" aria-label="Complexity">⚙️</span> Complexity
          </div>
        </div>
        
        <div className="explanation-content">
          {activeTab === 'explanation' && (
            <div className="explanation-text">{explanation || 'The explanation will appear here'}</div>
          )}
          {activeTab === 'execution' && (
            <div className="execution-result">
              <h4><span role="img" aria-label="Output">📤</span> Execution Output:</h4>
              {isExecuting ? (
                <div className="executing-animation">
                  <div className="execution-spinner"></div>
                  <p>Executing code...</p>
                </div>
              ) : (
                <pre>{executionResult || 'Code execution results will appear here'}</pre>
              )}
            </div>
          )}
          {activeTab === 'complexity' && (
            <div className="complexity-analysis">
              <h4><span role="img" aria-label="Complexity">📊</span> Code Complexity Analysis</h4>
              <div className="complexity-stats">
                <div className="complexity-card">
                  <h5>Time Complexity</h5>
                  <div className="complexity-value">{complexity.time}</div>
                </div>
                <div className="complexity-card">
                  <h5>Space Complexity</h5>
                  <div className="complexity-value">{complexity.space}</div>
                </div>
              </div>
              <div className="complexity-description">
                <h5>Analysis</h5>
                <p>{complexity.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className={`error-message ${error === 'Listening...' || error === 'Code copied to clipboard!' ? 'info' : ''}`}>
          {error}
        </div>
      )}

      <div className="history-section">
        <h2><span role="img" aria-label="History">📜</span> Command History</h2>
        {history.length === 0 ? (
          <p>No command history yet</p>
        ) : (
          <div className="history-grid">
            {history.map((item, index) => (
              <div className="history-item" key={index}>
                <div className="history-command">
                  <span role="img" aria-label="Command">💬</span> {item.command}
                </div>
                <div className="history-code-preview">
                  {item.code.split('\n').slice(0, 3).join('\n')}
                  {item.code.split('\n').length > 3 && '...'}
                </div>
                <div className="history-actions">
                  <button onClick={() => {
                    setCommand(item.command);
                    setCode(item.code);
                    setExplanation(item.explanation);
                  }} className="history-action-btn">
                    <span role="img" aria-label="Reuse">♻️</span> Reuse
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
