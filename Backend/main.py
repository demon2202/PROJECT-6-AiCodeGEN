from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import jwt
import secrets
import io
import sys
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# ====== CONFIG ======
# TODO: Replace with your real Gemini API Key
genai.configure(api_key="key here")

SECRET_KEY = secrets.token_hex(32)
USERS = {}

# ====== AUTH HELPERS ======
def token_required(f):
    def wrapper(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        if not token:
            return jsonify({"error": "Missing Token"}), 401
        try:
            data = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            user = USERS.get(data['username'])
            if not user:
                return jsonify({"error": "Invalid Token"}), 401
            return f(user, *args, **kwargs)
        except Exception as e:
            return jsonify({"error": "Invalid Token"}), 401
    wrapper.__name__ = f.__name__
    return wrapper

# ====== AUTH ROUTES ======
@app.route('/api/register', methods=["POST"])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if username in USERS:
        return jsonify({"error": "User already exists"}), 400

    USERS[username] = {
        "username": username,
        "password": password,
        "history": []
    }
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/api/login', methods=["POST"])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    user = USERS.get(username)

    if not user or user['password'] != password:
        return jsonify({"error": "Invalid credentials"}), 401

    token = jwt.encode({
        "username": username,
        "exp": datetime.utcnow() + timedelta(days=1)
    }, SECRET_KEY)

    return jsonify({"token": token}), 200

# ====== CODE GENERATION ======
@app.route('/api/generate-code', methods=["POST"])
def generate_code():
    data = request.get_json()
    instruction = data.get('instruction')
    previous_code = data.get('previousCode', '')
    context = data.get('context', [])

    prompt = create_prompt(instruction, previous_code, context)

    model = genai.GenerativeModel('gemini-1.5-pro')
    response = model.generate_content(prompt)

    code = response.text
    if "```" in code:
        code = code.split("```")[1].replace("python", "").strip()

    return jsonify({"code": code})

def create_prompt(instruction, previous_code, context):
    context_part = ""
    if context:
        for c in context:
            context_part += f"User: {c.get('instruction')}\n"
            if c.get('code'):
                context_part += "AI: [Generated code]\n"

    if previous_code:
        return f"""
Here is the previous Python code:

{previous_code}

Modify it based on the following instruction:

{instruction}

{context_part}

Respond with only valid updated Python code (no explanation).
"""
    else:
        return f"""
Write Python code for the following instruction:

{instruction}

{context_part}

Respond with only valid Python code (no extra explanation).
"""

# ====== RUN CODE ======
@app.route('/api/run-code', methods=["POST"])
def run_code():
    data = request.get_json()
    code = data.get('code')

    old_stdout = sys.stdout
    redirected_output = io.StringIO()
    sys.stdout = redirected_output

    try:
        exec(code, globals())
        output = redirected_output.getvalue()
        if not output.strip():
            output = "✅ Code ran successfully (no output)."
    except Exception as e:
        output = f"❌ Error: {str(e)}"
    finally:
        sys.stdout = old_stdout

    return jsonify({"result": output})

# ====== CHAT ABOUT CODE ======
@app.route('/api/chat-about-code', methods=["POST"])
def chat_about_code():
    data = request.get_json()
    code = data.get('code')
    question = data.get('question')

    if not code or not question:
        return jsonify({"error": "Code and question required"}), 400

    prompt = f"""
Analyze the following Python code:

{code}

Now answer the user's question:

{question}

Format the answer nicely with bullet points, clear explanations, and show code snippets if needed.
"""

    model = genai.GenerativeModel('gemini-1.5-pro')
    response = model.generate_content(prompt)

    return jsonify({"answer": response.text})

# ====== PLUGIN ROUTES ======
@app.route('/api/plugin/<plugin_name>', methods=["POST"])
def plugin(plugin_name):
    data = request.get_json()
    code = data.get('code')

    if not code:
        return jsonify({"error": "Code required"}), 400

    if plugin_name == "optimize":
        prompt = f"Optimize this Python code:\n\n{code}\n\nReturn only optimized valid code."
    elif plugin_name == "debug":
        prompt = f"Find and fix any bugs in this Python code:\n\n{code}\n\nReturn only corrected valid code."
    elif plugin_name == "convert-to-oop":
        prompt = f"Convert this Python code into Object Oriented Programming (using classes):\n\n{code}\n\nReturn only converted valid code."
    else:
        return jsonify({"error": "Unknown plugin"}), 400

    model = genai.GenerativeModel('gemini-1.5-pro')
    response = model.generate_content(prompt)

    result = response.text
    if "```" in result:
        result = result.split("```")[1].replace("python", "").strip()

    return jsonify({"result": result})

# ====== SAVE & GET USER HISTORY ======
@app.route('/api/save-history', methods=["POST"])
@token_required
def save_history(user):
    data = request.get_json()
    history_item = data.get('historyItem')

    if not history_item:
        return jsonify({"error": "History item required"}), 400

    user['history'].append(history_item)
    return jsonify({"message": "Saved"}), 200

@app.route('/api/get-history', methods=["GET"])
@token_required
def get_history(user):
    return jsonify({"history": user['history']}), 200

# ====== MAIN ======
if __name__ == "__main__":
    app.run(port=5000, debug=True)
