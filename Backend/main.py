from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai
import sys
import io
import re
import json
from functools import wraps
import jwt
from datetime import datetime, timedelta
import secrets

app = Flask(__name__, static_folder="../build", static_url_path="/")
CORS(app)

GEMINI_API_KEY = ""  
genai.configure(api_key=GEMINI_API_KEY)

# Secret key for JWT tokens
SECRET_KEY = secrets.token_hex(32)

# Mock user database (replace with real DB in production)
USERS = {}

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            auth = request.headers['Authorization']
            if auth.startswith('Bearer '):
                token = auth.split(' ')[1]
        
        if not token:
            return jsonify({'error': 'Authentication token is missing'}), 401
        
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            current_user = USERS.get(data['username'])
            if not current_user:
                return jsonify({'error': 'Invalid user'}), 401
        except:
            return jsonify({'error': 'Invalid or expired token'}), 401
            
        return f(current_user, *args, **kwargs)
    
    return decorated

@app.route('/')
def serve():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.json
        username = data.get('username', '')
        password = data.get('password', '')
        
        if not username or not password:
            return jsonify({"error": "Username and password are required"}), 400
            
        if username in USERS:
            return jsonify({"error": "Username already exists"}), 400
            
        USERS[username] = {
            "username": username,
            "password": password,  # In production, hash this password!
            "history": []
        }
        
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username', '')
        password = data.get('password', '')
        
        user = USERS.get(username)
        if not user or user['password'] != password:
            return jsonify({"error": "Invalid username or password"}), 401
            
        token = jwt.encode({
            'username': username,
            'exp': datetime.utcnow() + timedelta(days=1)
        }, SECRET_KEY)
        
        return jsonify({"token": token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/generate-code', methods=['POST'])
def generate_code():
    try:
        data = request.json
        instruction = data.get('instruction', '')
        previous_code = data.get('previousCode', '')
        context = data.get('context', [])  # Chat history/context

        if not instruction:
            return jsonify({"error": "Instruction is required"}), 400

        prompt = create_prompt(instruction, previous_code, context)
        response = generate_python_code(prompt)
        return jsonify({"code": response})

    except Exception as e:
        print(f"Error in /generate-code: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/run-code', methods=['POST'])
def run_code():
    try:
        data = request.json
        code = data.get('code', '')

        if not code:
            return jsonify({"error": "Code is required"}), 400

        old_stdout = sys.stdout
        redirected_output = io.StringIO()
        sys.stdout = redirected_output

        try:
            exec(code, globals())
            redirected_output.seek(0)
            result = redirected_output.read()
            if not result.strip():
                result = "Code executed successfully with no output."
        except Exception as e:
            result = f"Error executing code: {e}"

        sys.stdout = old_stdout
        return jsonify({"result": result})

    except Exception as e:
        print(f"Error in /run-code: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/plugin/<plugin_name>', methods=['POST'])
def run_plugin(plugin_name):
    try:
        data = request.json
        code = data.get('code', '')
        
        if not code:
            return jsonify({"error": "Code is required"}), 400
            
        if plugin_name == "explain":
            result = explain_code(code)
            return jsonify({"result": result})
        elif plugin_name == "optimize":
            result = optimize_code(code)
            return jsonify({"result": result})
        elif plugin_name == "convert-to-oop":
            result = convert_to_oop(code)
            return jsonify({"result": result})
        else:
            return jsonify({"error": f"Unknown plugin: {plugin_name}"}), 404
            
    except Exception as e:
        print(f"Error in plugin {plugin_name}: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/save-history', methods=['POST'])
@token_required
def save_history(current_user):
    try:
        data = request.json
        history_item = data.get('historyItem')
        
        if not history_item:
            return jsonify({"error": "History item is required"}), 400
            
        current_user['history'].append(history_item)
        return jsonify({"message": "History saved successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-history', methods=['GET'])
@token_required
def get_history(current_user):
    try:
        return jsonify({"history": current_user['history']}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def create_prompt(instruction, previous_code, context=None):
    # Include conversation context if available
    context_str = ""
    if context and len(context) > 0:
        context_str = "Previous conversation:\n"
        for i, msg in enumerate(context):
            context_str += f"User: {msg.get('instruction', '')}\n"
            if msg.get('code'):
                context_str += f"AI: [Code generated]\n"
    
    if previous_code:
        return f"""
You are a Python expert. I want you to understand the context of our conversation and merge this instruction into the existing code.

{context_str}
Previous code:
{previous_code}

Instruction:
{instruction}

Return ONLY valid Python code (no markdown, no explanation).
"""
    else:
        return f"""
You are a Python expert. I want you to understand the context of our conversation and write Python code for this instruction:

{context_str}
Instruction:
{instruction}

Return ONLY valid Python code (no markdown, no explanation).
"""

def generate_python_code(prompt):
    model = genai.GenerativeModel('gemini-1.5-pro')

    response = model.generate_content(
        prompt,
        generation_config={
            "temperature": 0.2,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2048
        },
        safety_settings=[
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"}
        ]
    )

    code = response.text.strip()
    if "```" in code:
        code = code.split("```")[1].replace("python", "").strip()
    return code

def explain_code(code):
    prompt = f"""
You are a Python expert. Please explain this code in simple terms. Break down how it works, 
explain any algorithms or libraries used, and highlight important parts. Make your explanation 
clear and educational:

```python
{code}
```

Provide a comprehensive but clear explanation suitable for intermediate programmers.
"""
    model = genai.GenerativeModel('gemini-1.5-pro')
    response = model.generate_content(prompt)
    return response.text

def optimize_code(code):
    prompt = f"""
You are a Python optimization expert. Please optimize this code to make it faster, more efficient, 
and follow best practices. Maintain the same functionality but improve:

```python
{code}
```

Return ONLY the optimized Python code without explanations. If you think the code is already optimal,
make minor improvements or refactoring for better readability.
"""
    model = genai.GenerativeModel('gemini-1.5-pro')
    response = model.generate_content(prompt)
    optimized_code = response.text.strip()
    if "```" in optimized_code:
        optimized_code = optimized_code.split("```")[1].replace("python", "").strip()
    return optimized_code

def convert_to_oop(code):
    prompt = f"""
You are a Python expert. Please convert this code to use Object-Oriented Programming principles.
Create appropriate classes and methods while maintaining the same functionality:

```python
{code}
```

Return ONLY the converted Python code without explanations.
"""
    model = genai.GenerativeModel('gemini-1.5-pro')
    response = model.generate_content(prompt)
    oop_code = response.text.strip()
    if "```" in oop_code:
        oop_code = oop_code.split("```")[1].replace("python", "").strip()
    return oop_code

if __name__ == '__main__':
    app.run(debug=True, port=5000)
