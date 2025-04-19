import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { Moon, Sun, Mic, MicOff, Copy, Play, Download, Trash2 } from 'lucide-react';

function CodeGenerator() {
  const [darkMode, setDarkMode] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState([]);
  const [transcript, setTranscript] = useState('');
  const codeEditorRef = useRef(null);
  const recognitionRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();

      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        console.log('Voice recognition started');
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
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        clearTimeout(timeoutRef.current);
      };
    } else {
      alert('Speech recognition not supported in this browser');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setInstruction('');
      try {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(() => {
          recognitionRef.current.start();
          timeoutRef.current = setTimeout(() => {
            recognitionRef.current.stop();
          }, 5000);
        }).catch((err) => {
          alert('Microphone access denied or not available.');
          console.error('getUserMedia error:', err);
        });
      } catch (error) {
        console.error('Failed to start recognition:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!instruction.trim() || isProcessing) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, previousCode: generatedCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate code');
      }

      setGeneratedCode(data.code);
      setHistory([...history, { instruction, code: data.code }]);
      setInstruction('');
      setTranscript('');
    } catch (error) {
      console.error('Error generating code:', error);
      alert(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCode);
    alert('Code copied to clipboard!');
  };

  const downloadCode = () => {
    const file = new Blob([generatedCode], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = 'generated_code.py';
    a.click();
  };

  const clearCode = () => {
    setGeneratedCode('');
  };

  const runCode = async () => {
    try {
      setIsProcessing(true);
      const response = await fetch('/api/run-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: generatedCode })
      });
  
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        alert('❌ Server error: Expected JSON but received something else.');
        return;
      }
  
      const data = await response.json();
  
      if (!response.ok) {
        throw new Error(data.error || 'Code execution failed');
      }
  
      alert(`✅ Code Output:\n${data.result}`);
    } catch (error) {
      console.error('Error running code:', error);
      alert('❌ Failed to run the code. Please check backend console or response format.');
    } finally {
      setIsProcessing(false);
    }
  };
  

  return (
    <div className="code-generator-container">
      <header>
        <h1>AI CodeGen</h1>
        <button className="theme-toggle" onClick={toggleDarkMode}>
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main>
        <section className="input-section">
          <form onSubmit={handleSubmit}>
            <div className="input-container">
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit(e);
                }}
                placeholder="Type or speak your instruction..."
                disabled={isProcessing}
              />
              <button
                type="button"
                className={`mic-button ${isListening ? 'listening' : ''}`}
                onClick={toggleListening}
                disabled={isProcessing}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button
                type="submit"
                className="submit-button"
                disabled={isProcessing || !instruction.trim()}
              >
                {isProcessing ? 'Processing...' : 'Generate Code'}
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
              {history.length === 0 ? (
                <p className="no-history">No instructions yet.</p>
              ) : (
                history.map((item, i) => (
                <div key={i} className="history-item" onClick={() => setGeneratedCode(item.code)}>
                  <div className="history-instruction">{item.instruction}</div>
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
              <button className="action-button" onClick={copyToClipboard} disabled={!generatedCode}><Copy size={16} /> Copy</button>
              <button className="action-button" onClick={downloadCode} disabled={!generatedCode}><Download size={16} /> Download</button>
              <button className="action-button" onClick={runCode} disabled={!generatedCode || isProcessing}><Play size={16} /> Run</button>
              <button className="action-button" onClick={clearCode} disabled={!generatedCode}><Trash2 size={16} /> Clear</button>
            </div>
          </div>
          <pre className="code-editor" ref={codeEditorRef}>
            <code className="language-python">{generatedCode || '# Your Python code will appear here'}</code>
          </pre>
        </section>
      </main>
    </div>
  );
}

export default CodeGenerator;
